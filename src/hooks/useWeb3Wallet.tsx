import { useCallback, useEffect, useState } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface VerifiedWallet {
  id: string;
  wallet_address: string;
  chain_id: number;
  verified_at: string;
  is_active: boolean;
}

export interface WalletState {
  address: string | null;
  chainId: number | null;
  balanceEth: string | null;
  isConnecting: boolean;
  isVerifying: boolean;
  hasMetaMask: boolean;
  verifiedWallets: VerifiedWallet[];
  activeVerifiedId: string | null;
}

const SIGN_MESSAGE = (address: string, nonce: string) =>
  `B2BNEST Staking — verify wallet ownership.\n\nWallet: ${address}\nNonce: ${nonce}\n\nThis signature does not authorize any transaction or transfer of funds.`;

export const useWeb3Wallet = () => {
  const { user } = useAuth();
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    balanceEth: null,
    isConnecting: false,
    isVerifying: false,
    hasMetaMask: typeof window !== 'undefined' && !!window.ethereum,
    verifiedWallets: [],
    activeVerifiedId: null,
  });

  const loadVerifiedWallets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('staking_wallet_links')
      .select('id, wallet_address, chain_id, verified_at, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('verified_at', { ascending: false });
    if (data) {
      setState((s) => ({
        ...s,
        verifiedWallets: data,
        activeVerifiedId: data[0]?.id ?? null,
      }));
    }
  }, [user]);

  useEffect(() => {
    loadVerifiedWallets();
  }, [loadVerifiedWallets]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accs: string[]) => {
      setState((s) => ({ ...s, address: accs[0] ?? null }));
    };
    const onChain = (chainHex: string) => {
      setState((s) => ({ ...s, chainId: parseInt(chainHex, 16) }));
    };
    window.ethereum.on?.('accountsChanged', onAccounts);
    window.ethereum.on?.('chainChanged', onChain);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', onAccounts);
      window.ethereum?.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      toast({
        title: 'No wallet detected',
        description: 'Install MetaMask or another EVM wallet to continue.',
        variant: 'destructive',
      });
      return null;
    }
    setState((s) => ({ ...s, isConnecting: true }));
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      const address = accounts[0];
      const balance = await provider.getBalance(address);
      setState((s) => ({
        ...s,
        address,
        chainId: Number(network.chainId),
        balanceEth: formatEther(balance),
        isConnecting: false,
      }));
      return { address, chainId: Number(network.chainId), provider };
    } catch (e: any) {
      setState((s) => ({ ...s, isConnecting: false }));
      toast({
        title: 'Connection rejected',
        description: e?.message ?? 'User denied wallet connection',
        variant: 'destructive',
      });
      return null;
    }
  }, []);

  const verifyAndLink = useCallback(async () => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return null;
    }
    const conn = await connect();
    if (!conn) return null;

    setState((s) => ({ ...s, isVerifying: true }));
    try {
      const nonce = crypto.randomUUID();
      const message = SIGN_MESSAGE(conn.address, nonce);
      const signer = await conn.provider.getSigner();
      const signature = await signer.signMessage(message);

      const { data, error } = await supabase
        .from('staking_wallet_links')
        .upsert(
          {
            user_id: user.id,
            wallet_address: conn.address.toLowerCase(),
            chain_id: conn.chainId,
            signature,
            signed_message: message,
            verified_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: 'user_id,wallet_address,chain_id' },
        )
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Wallet verified',
        description: `${conn.address.slice(0, 6)}…${conn.address.slice(-4)} linked to your account.`,
      });
      await loadVerifiedWallets();
      setState((s) => ({ ...s, isVerifying: false, activeVerifiedId: data.id }));
      return data;
    } catch (e: any) {
      setState((s) => ({ ...s, isVerifying: false }));
      toast({
        title: 'Verification failed',
        description: e?.message ?? 'Signature was rejected',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, connect, loadVerifiedWallets]);

  const unlinkWallet = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('staking_wallet_links')
        .update({ is_active: false })
        .eq('id', id);
      if (error) {
        toast({ title: 'Unlink failed', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Wallet unlinked' });
      await loadVerifiedWallets();
    },
    [loadVerifiedWallets],
  );

  const setActive = useCallback((id: string) => {
    setState((s) => ({ ...s, activeVerifiedId: id }));
  }, []);

  return { ...state, connect, verifyAndLink, unlinkWallet, setActive, refresh: loadVerifiedWallets };
};
