import { supabase } from '@/integrations/supabase/client';

export type TxStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';
export type TxType = 'stake' | 'unstake' | 'claim';

export interface StakingTx {
  id: string;
  user_id: string;
  stake_id: string | null;
  tx_type: TxType;
  status: TxStatus;
  amount: number;
  wallet_address: string | null;
  chain_id: number | null;
  tx_hash: string | null;
  block_number: number | null;
  error_message: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export const createStakingTx = async (params: {
  user_id: string;
  stake_id?: string | null;
  tx_type: TxType;
  amount: number;
  wallet_address?: string | null;
  chain_id?: number | null;
}) => {
  const { data, error } = await supabase
    .from('staking_transactions')
    .insert({
      user_id: params.user_id,
      stake_id: params.stake_id ?? null,
      tx_type: params.tx_type,
      amount: params.amount,
      wallet_address: params.wallet_address ?? null,
      chain_id: params.chain_id ?? null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data as StakingTx;
};

export const updateStakingTx = async (
  id: string,
  patch: Partial<Pick<StakingTx, 'status' | 'tx_hash' | 'block_number' | 'error_message'>> & {
    submitted_at?: string;
    confirmed_at?: string;
  },
) => {
  const { error } = await supabase.from('staking_transactions').update(patch).eq('id', id);
  if (error) throw error;
};

export const listStakeTxs = async (stake_id: string) => {
  const { data, error } = await supabase
    .from('staking_transactions')
    .select('*')
    .eq('stake_id', stake_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StakingTx[];
};

/**
 * Simulates the off-chain "submission" lifecycle.
 * In production, replace the simulated delays with real ethers contract calls:
 *   const tx = await contract.stake(amount);
 *   await updateStakingTx(id, { status: 'submitted', tx_hash: tx.hash, submitted_at: now });
 *   const receipt = await tx.wait();
 *   await updateStakingTx(id, { status: 'confirmed', block_number: receipt.blockNumber, confirmed_at: now });
 */
export const simulateChainSubmission = async (txId: string, opts?: { fakeHash?: string }) => {
  const fakeHash =
    opts?.fakeHash ??
    '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

  await updateStakingTx(txId, {
    status: 'submitted',
    tx_hash: fakeHash,
    submitted_at: new Date().toISOString(),
  });

  // Simulate a confirmation after a short delay (in real life this is await tx.wait())
  setTimeout(async () => {
    try {
      await updateStakingTx(txId, {
        status: 'confirmed',
        block_number: Math.floor(Math.random() * 1_000_000) + 19_000_000,
        confirmed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('confirm tx failed', e);
    }
  }, 3500);

  return fakeHash;
};
