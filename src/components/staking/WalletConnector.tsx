import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Wallet, ShieldCheck, Trash2, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useWeb3Wallet } from '@/hooks/useWeb3Wallet';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  56: 'BNB Chain',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  11155111: 'Sepolia',
};

export const WalletConnector = ({ onActiveChange }: { onActiveChange?: (id: string | null, address: string | null) => void }) => {
  const w = useWeb3Wallet();

  const activeWallet = w.verifiedWallets.find((v) => v.id === w.activeVerifiedId);

  if (!w.hasMetaMask) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No Web3 wallet detected</AlertTitle>
        <AlertDescription>
          Install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="underline">MetaMask</a> (or any EVM wallet) to verify your address and stake B2BN.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet
        </CardTitle>
        <CardDescription>
          Verify ownership of your wallet by signing a free message — this proves the address is yours without authorizing any transaction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {w.address && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Connected</p>
                <p className="font-mono text-sm font-medium">
                  {w.address.slice(0, 6)}…{w.address.slice(-4)}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline">{CHAIN_NAMES[w.chainId ?? 0] ?? `Chain ${w.chainId}`}</Badge>
                {w.balanceEth && (
                  <p className="text-xs text-muted-foreground mt-1">{Number(w.balanceEth).toFixed(4)} ETH</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={w.connect} disabled={w.isConnecting} variant="outline">
            {w.isConnecting ? 'Connecting…' : w.address ? 'Reconnect' : 'Connect Wallet'}
          </Button>
          <Button onClick={w.verifyAndLink} disabled={w.isVerifying}>
            <ShieldCheck className="h-4 w-4" />
            {w.isVerifying ? 'Awaiting signature…' : 'Verify & Link'}
          </Button>
        </div>

        {w.verifiedWallets.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Verified wallets
            </p>
            <div className="space-y-2">
              {w.verifiedWallets.map((v) => {
                const isActive = v.id === w.activeVerifiedId;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-md border transition ${
                      isActive ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        w.setActive(v.id);
                        onActiveChange?.(v.id, v.wallet_address);
                      }}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      {isActive && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                      <span className="font-mono text-sm truncate">{v.wallet_address}</span>
                      <Badge variant="outline" className="ml-auto">
                        {CHAIN_NAMES[v.chain_id] ?? `Chain ${v.chain_id}`}
                      </Badge>
                    </button>
                    <a
                      href={`https://etherscan.io/address/${v.wallet_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      aria-label="View on explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => w.unlinkWallet(v.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label="Unlink wallet"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            {activeWallet && (
              <p className="text-xs text-muted-foreground mt-2">
                Active wallet will be associated with new stakes.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
