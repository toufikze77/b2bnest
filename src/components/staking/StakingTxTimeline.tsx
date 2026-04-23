import { useEffect, useState } from 'react';
import { CircleDot, CheckCircle2, Clock, Unlock, ExternalLink, XCircle, Loader2 } from 'lucide-react';
import { listStakeTxs, type StakingTx } from '@/services/stakingTxService';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  stakeId: string;
  unlocksAt: string;
  unstakedAt?: string | null;
  status: string;
}

export const StakingTxTimeline = ({ stakeId, unlocksAt, unstakedAt, status }: Props) => {
  const [txs, setTxs] = useState<StakingTx[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await listStakeTxs(stakeId);
      setTxs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // realtime updates so submitted → confirmed pops in
    const channel = supabase
      .channel(`stake-tx-${stakeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staking_transactions', filter: `stake_id=eq.${stakeId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeId]);

  const stakeTx = txs.find((t) => t.tx_type === 'stake');
  const unstakeTx = txs.find((t) => t.tx_type === 'unstake');
  const isUnlocked = new Date(unlocksAt).getTime() <= Date.now();
  const isUnstaked = status === 'unstaked';

  const steps: Array<{
    key: string;
    label: string;
    description: string;
    timestamp: string | null;
    state: 'done' | 'active' | 'pending' | 'failed';
    icon: typeof CircleDot;
    txHash?: string | null;
  }> = [
    {
      key: 'submitted',
      label: 'Submitted',
      description: stakeTx?.tx_hash
        ? `Tx ${stakeTx.tx_hash.slice(0, 10)}…${stakeTx.tx_hash.slice(-6)}`
        : stakeTx
          ? 'Stake transaction submitted to chain'
          : 'Stake recorded',
      timestamp: stakeTx?.submitted_at ?? stakeTx?.created_at ?? null,
      state: stakeTx?.status === 'failed' ? 'failed' : stakeTx ? 'done' : 'pending',
      icon: stakeTx?.status === 'failed' ? XCircle : CircleDot,
      txHash: stakeTx?.tx_hash,
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      description:
        stakeTx?.status === 'confirmed'
          ? `Block #${stakeTx.block_number?.toLocaleString() ?? '—'} · earning revenue share`
          : stakeTx?.status === 'submitted'
            ? 'Awaiting on-chain confirmation…'
            : stakeTx?.status === 'failed'
              ? stakeTx.error_message ?? 'Transaction reverted'
              : 'Pending submission',
      timestamp: stakeTx?.confirmed_at ?? null,
      state:
        stakeTx?.status === 'confirmed'
          ? 'done'
          : stakeTx?.status === 'submitted'
            ? 'active'
            : stakeTx?.status === 'failed'
              ? 'failed'
              : 'pending',
      icon:
        stakeTx?.status === 'confirmed'
          ? CheckCircle2
          : stakeTx?.status === 'submitted'
            ? Loader2
            : stakeTx?.status === 'failed'
              ? XCircle
              : CheckCircle2,
    },
    {
      key: 'unlocked',
      label: isUnstaked ? 'Unstaked' : 'Unlocked',
      description: isUnstaked
        ? unstakeTx?.tx_hash
          ? `Tx ${unstakeTx.tx_hash.slice(0, 10)}…${unstakeTx.tx_hash.slice(-6)}`
          : 'Tokens released back to wallet'
        : isUnlocked
          ? 'Lock period complete · ready to unstake'
          : `Lock ends ${new Date(unlocksAt).toLocaleDateString()}`,
      timestamp: isUnstaked ? unstakedAt ?? unstakeTx?.confirmed_at ?? null : isUnlocked ? unlocksAt : null,
      state: isUnstaked ? 'done' : isUnlocked ? 'active' : 'pending',
      icon: isUnstaked ? Unlock : isUnlocked ? Unlock : Clock,
    },
  ];

  if (loading && txs.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading timeline…</p>;
  }

  return (
    <div className="pt-2 border-t">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Transaction Timeline
      </p>
      <ol className="relative space-y-4">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isLast = idx === steps.length - 1;
          const ringClass =
            step.state === 'done'
              ? 'bg-primary/10 border-primary text-primary'
              : step.state === 'active'
                ? 'bg-amber-500/10 border-amber-500 text-amber-600'
                : step.state === 'failed'
                  ? 'bg-destructive/10 border-destructive text-destructive'
                  : 'bg-muted border-border text-muted-foreground';
          const lineClass = step.state === 'done' ? 'bg-primary/40' : 'bg-border';
          return (
            <li key={step.key} className="flex gap-3 relative">
              {!isLast && (
                <span
                  className={`absolute left-[15px] top-8 bottom-[-18px] w-px ${lineClass}`}
                  aria-hidden="true"
                />
              )}
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${ringClass}`}>
                <StepIcon className={`h-4 w-4 ${step.state === 'active' ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${step.state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {step.label}
                  </p>
                  {step.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(step.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${step.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
