import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Coins, TrendingUp, Lock, Award, Sparkles, Gift, ShieldCheck, Wallet, Info, Calendar, Calculator, Building2, Flame } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import { WalletConnector } from '@/components/staking/WalletConnector';
import { StakingTxTimeline } from '@/components/staking/StakingTxTimeline';
import { useWeb3Wallet } from '@/hooks/useWeb3Wallet';
import { createStakingTx, simulateChainSubmission, updateStakingTx } from '@/services/stakingTxService';

interface Tier {
  id: string;
  name: string;
  min_stake_amount: number;
  apy_percentage: number; // Now represents revenue share weight (multiplier)
  monthly_credits: number;
  perks: string[];
  badge_color: string;
  sort_order: number;
}

interface Stake {
  id: string;
  amount: number;
  lock_period_days: number;
  apy_percentage: number; // Final share weight at time of stake
  status: string;
  staked_at: string;
  unlocks_at: string;
  unstaked_at?: string | null;
  wallet_address: string | null;
  transaction_hash?: string | null;
}

interface Reward {
  id: string;
  reward_type: string;
  amount: number;
  description: string | null;
  claimed: boolean;
  earned_at: string;
}

const LOCK_OPTIONS = [
  { days: 30, label: '30 days', multiplier: 1 },
  { days: 90, label: '90 days', multiplier: 1.25 },
  { days: 180, label: '180 days', multiplier: 1.5 },
  { days: 365, label: '1 year', multiplier: 2 },
];

const tierColorClass = (color: string) => {
  const map: Record<string, string> = {
    amber: 'from-amber-500/20 to-amber-700/10 border-amber-500/40 text-amber-700 dark:text-amber-400',
    slate: 'from-slate-400/20 to-slate-600/10 border-slate-400/40 text-slate-700 dark:text-slate-300',
    yellow: 'from-yellow-400/20 to-yellow-600/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-400',
    cyan: 'from-cyan-400/20 to-cyan-600/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-400',
  };
  return map[color] || 'from-muted to-muted/50 border-border text-foreground';
};

const Staking = () => {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [currentTier, setCurrentTier] = useState<{ tier_name: string; total_staked: number; monthly_credits: number; apy_percentage: number; badge_color: string; perks: string[] } | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState('30');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const { data: tiersData } = await supabase
      .from('staking_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (tiersData) setTiers(tiersData as any);

    if (!user) return;

    const { data: stakesData } = await supabase
      .from('user_stakes')
      .select('*')
      .eq('user_id', user.id)
      .order('staked_at', { ascending: false });
    if (stakesData) setStakes(stakesData as any);

    const { data: rewardsData } = await supabase
      .from('staking_rewards')
      .select('*')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false });
    if (rewardsData) setRewards(rewardsData as any);

    const { data: tierData } = await supabase.rpc('get_user_staking_tier', { _user_id: user.id });
    if (tierData && tierData.length > 0) setCurrentTier(tierData[0] as any);
    else setCurrentTier(null);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleStake = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to stake B2BN tokens.', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a valid stake amount.', variant: 'destructive' });
      return;
    }
    if (amount < 1000) {
      toast({ title: 'Minimum stake', description: 'Minimum stake is 1,000 B2BN.', variant: 'destructive' });
      return;
    }

    const lockDays = parseInt(lockPeriod);
    const lockOption = LOCK_OPTIONS.find(o => o.days === lockDays)!;
    const matchingTier = [...tiers].reverse().find(t => amount >= t.min_stake_amount);
    const baseWeight = matchingTier?.apy_percentage ?? 1;
    const finalWeight = baseWeight * lockOption.multiplier;

    setLoading(true);
    const unlocksAt = new Date(Date.now() + lockDays * 86400 * 1000).toISOString();

    const { error } = await supabase.from('user_stakes').insert({
      user_id: user.id,
      amount,
      lock_period_days: lockDays,
      apy_percentage: finalWeight,
      status: 'active',
      unlocks_at: unlocksAt,
      wallet_address: walletAddress || null,
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Stake failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Stake recorded', description: `You staked ${amount.toLocaleString()} B2BN with ${finalWeight}x revenue share weight.` });
    setStakeAmount('');
    loadData();
  };

  const handleUnstake = async (stake: Stake) => {
    const isUnlocked = new Date(stake.unlocks_at).getTime() <= Date.now();
    if (!isUnlocked) {
      toast({ title: 'Still locked', description: `Unlocks on ${new Date(stake.unlocks_at).toLocaleDateString()}`, variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('user_stakes')
      .update({ status: 'unstaked', unstaked_at: new Date().toISOString() })
      .eq('id', stake.id);
    if (error) {
      toast({ title: 'Unstake failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Unstaked', description: `${stake.amount.toLocaleString()} B2BN released.` });
    loadData();
  };

  const handleClaim = async (reward: Reward) => {
    const { error } = await supabase
      .from('staking_rewards')
      .update({ claimed: true, claimed_at: new Date().toISOString() })
      .eq('id', reward.id);
    if (error) {
      toast({ title: 'Claim failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reward claimed', description: `+${reward.amount} ${reward.reward_type} added.` });
    loadData();
  };

  const totalStaked = stakes.filter(s => s.status === 'active').reduce((sum, s) => sum + Number(s.amount), 0);
  const totalRewards = rewards.filter(r => !r.claimed).reduce((sum, r) => sum + Number(r.amount), 0);
  const activeStakeCount = stakes.filter(s => s.status === 'active').length;

  const nextTier = tiers.find(t => t.min_stake_amount > totalStaked);
  const progressToNext = nextTier ? Math.min(100, (totalStaked / nextTier.min_stake_amount) * 100) : 100;

  return (
    <>
      <SEOHead
        title="B2BN Staking & Profit Share | Earn From Real Platform Revenue"
        description="Stake B2BN to earn from real platform revenue — not interest. Halal-compatible profit-sharing model with variable monthly rewards, AI credits, and tier perks. Bronze, Silver, Gold, Diamond tiers."
        keywords="B2BN staking, halal crypto staking, profit sharing, revenue share, no interest, ethical crypto, B2BNEST tier, holder benefits"
      />

      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Halal-Compatible · Profit-Share Model</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-cyan-500 bg-clip-text text-transparent">
              Earn from real business activity, not interest.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Lock B2BN tokens to receive a share of <span className="font-bold text-foreground">real platform revenue</span> — variable monthly profit drops, AI credits, and tier perks.
              No fixed APY. No artificial yield. Only value generated through usage.
            </p>
          </div>

          {/* Halal Model Explainer */}
          <Card className="mb-10 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-primary/5">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="font-semibold mb-1">Users stake tokens</p>
                    <p className="text-sm text-muted-foreground">Lock B2BN to access tools and support the platform.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="font-semibold mb-1">Platform generates revenue</p>
                    <p className="text-sm text-muted-foreground">Real income from SaaS subscriptions, AI tools, and services.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="font-semibold mb-1">Revenue is shared with participants</p>
                    <p className="text-sm text-muted-foreground">Variable monthly profit drops — proportional to your stake and tier weight.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!user && (
            <Alert className="mb-8 border-primary/30 bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertTitle>Sign in to start staking</AlertTitle>
              <AlertDescription>
                <Link to="/auth" className="text-primary underline font-medium">Create a free account</Link> to stake tokens and earn revenue share.
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Overview */}
          {user && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <Card className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Staked</p>
                      <p className="text-2xl font-bold mt-1">{totalStaked.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">B2BN</p>
                    </div>
                    <Coins className="h-8 w-8 text-primary opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Stakes</p>
                      <p className="text-2xl font-bold mt-1">{activeStakeCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">positions</p>
                    </div>
                    <Lock className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending Rewards</p>
                      <p className="text-2xl font-bold mt-1">{totalRewards.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">to claim</p>
                    </div>
                    <Gift className="h-8 w-8 text-emerald-500 opacity-60" />
                  </div>
                </CardContent>
              </Card>
              <Card className={currentTier ? `bg-gradient-to-br ${tierColorClass(currentTier.badge_color)}` : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider opacity-75">Current Tier</p>
                      <p className="text-2xl font-bold mt-1">{currentTier?.tier_name || 'None'}</p>
                      <p className="text-xs opacity-75 mt-1">{currentTier ? `+${currentTier.monthly_credits} credits/mo` : 'Stake to unlock'}</p>
                    </div>
                    <Award className="h-8 w-8 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Progress to next tier */}
          {user && nextTier && (
            <Card className="mb-10">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress to {nextTier.name} tier</span>
                  <span className="text-sm text-muted-foreground">
                    {totalStaked.toLocaleString()} / {nextTier.min_stake_amount.toLocaleString()} B2BN
                  </span>
                </div>
                <Progress value={progressToNext} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  Stake {(nextTier.min_stake_amount - totalStaked).toLocaleString()} more B2BN to unlock {nextTier.apy_percentage}x revenue share weight and {nextTier.monthly_credits} monthly credits.
                </p>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="stake" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
              <TabsTrigger value="stake">Stake</TabsTrigger>
              <TabsTrigger value="tiers">Tiers</TabsTrigger>
              <TabsTrigger value="positions">My Stakes</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>

            {/* Stake Tab */}
            <TabsContent value="stake">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      New Stake
                    </CardTitle>
                    <CardDescription>Lock B2BN to earn from real platform revenue. Minimum 1,000 B2BN.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount (B2BN)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="1000"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        min="1000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lock">Lock Period</Label>
                      <Select value={lockPeriod} onValueChange={setLockPeriod}>
                        <SelectTrigger id="lock">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCK_OPTIONS.map((o) => (
                            <SelectItem key={o.days} value={String(o.days)}>
                              {o.label} — {o.multiplier}x share weight
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="wallet">Wallet Address (optional)</Label>
                      <Input
                        id="wallet"
                        placeholder="0x... or Solana address"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleStake} disabled={loading || !user} className="w-full" size="lg">
                      {loading ? 'Staking...' : user ? 'Stake B2BN' : 'Sign in to Stake'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/5 to-primary/5 border-emerald-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      How Profit-Sharing Works
                    </CardTitle>
                    <CardDescription>That's profit-sharing, not interest.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">1</div>
                      <div>
                        <p className="font-medium">Lock B2BN tokens</p>
                        <p className="text-muted-foreground">Choose amount and lock period. Longer locks earn higher share weight multipliers.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">2</div>
                      <div>
                        <p className="font-medium">Platform generates real revenue</p>
                        <p className="text-muted-foreground">SaaS subscriptions, AI tool usage, and service fees create the reward pool.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">3</div>
                      <div>
                        <p className="font-medium">Variable monthly profit drops</p>
                        <p className="text-muted-foreground">Your share = (your stake × tier weight) / (total weighted stakes) × monthly revenue pool. No fixed returns.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">4</div>
                      <div>
                        <p className="font-medium">Unstake anytime after lock</p>
                        <p className="text-muted-foreground">Tokens release automatically when the lock period ends.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tiers Tab */}
            <TabsContent value="tiers">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {tiers.map((tier) => {
                  const isCurrent = currentTier?.tier_name === tier.name;
                  return (
                    <Card
                      key={tier.id}
                      className={`bg-gradient-to-br ${tierColorClass(tier.badge_color)} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-2xl">{tier.name}</CardTitle>
                          {isCurrent && <Badge>Current</Badge>}
                        </div>
                        <CardDescription className="text-foreground/70">
                          From {tier.min_stake_amount.toLocaleString()} B2BN
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-bold text-xl">{tier.apy_percentage}x</span>
                          <span className="text-sm opacity-75">revenue share weight</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span className="font-bold">+{tier.monthly_credits.toLocaleString()}</span>
                          <span className="text-sm opacity-75">credits/month</span>
                        </div>
                        <div className="pt-3 border-t border-current/10 space-y-1.5">
                          {(tier.perks as string[]).map((perk, i) => (
                            <div key={i} className="flex gap-2 text-sm">
                              <span>✓</span>
                              <span>{perk}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Alert className="mt-6 border-emerald-500/30 bg-emerald-500/5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <AlertTitle>Why this is halal-compatible</AlertTitle>
                <AlertDescription>
                  No fixed APY. No guaranteed returns. Rewards come from <strong>real platform revenue</strong> shared proportionally with stakers — that's profit-sharing (mudarabah-style), not interest (riba).
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions">
              <Card>
                <CardHeader>
                  <CardTitle>My Stakes</CardTitle>
                  <CardDescription>Active and historical positions with transaction timeline</CardDescription>
                </CardHeader>
                <CardContent>
                  {stakes.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Coins className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No stakes yet. Start earning from real platform revenue by staking B2BN.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {stakes.map((stake) => {
                        const now = Date.now();
                        const stakedAt = new Date(stake.staked_at).getTime();
                        const unlocksAt = new Date(stake.unlocks_at).getTime();
                        const isUnlocked = unlocksAt <= now;
                        const isActive = stake.status === 'active';
                        const isUnstaked = stake.status === 'unstaked';
                        const isConfirmed = now - stakedAt > 60 * 1000;

                        const steps = [
                          {
                            key: 'submitted',
                            label: 'Submitted',
                            description: `Staking transaction recorded${stake.transaction_hash ? ` · ${stake.transaction_hash.slice(0, 10)}…` : ''}`,
                            timestamp: stake.staked_at,
                            done: true,
                            icon: CircleDot,
                          },
                          {
                            key: 'confirmed',
                            label: 'Confirmed',
                            description: isConfirmed ? 'Stake is active and earning revenue share' : 'Awaiting on-chain confirmation',
                            timestamp: isConfirmed ? new Date(stakedAt + 60 * 1000).toISOString() : null,
                            done: isConfirmed,
                            icon: CheckCircle2,
                          },
                          {
                            key: 'unlocked',
                            label: isUnstaked ? 'Unstaked' : 'Unlocked',
                            description: isUnstaked
                              ? `Tokens released back to wallet`
                              : isUnlocked
                                ? 'Lock period complete · ready to unstake'
                                : `Lock ends ${new Date(stake.unlocks_at).toLocaleDateString()}`,
                            timestamp: isUnstaked
                              ? stake.unstaked_at ?? null
                              : isUnlocked
                                ? stake.unlocks_at
                                : null,
                            done: isUnlocked || isUnstaked,
                            icon: isUnstaked ? Unlock : isUnlocked ? Unlock : Clock,
                          },
                        ];

                        return (
                          <div key={stake.id} className="border rounded-lg p-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-lg">{Number(stake.amount).toLocaleString()} B2BN</span>
                                  <Badge variant={isActive ? 'default' : 'secondary'}>{stake.status}</Badge>
                                  <Badge variant="outline">{stake.apy_percentage}x weight</Badge>
                                  <Badge variant="outline">{stake.lock_period_days}d lock</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Staked {new Date(stake.staked_at).toLocaleDateString()}
                                  {stake.wallet_address ? ` · ${stake.wallet_address.slice(0, 6)}…${stake.wallet_address.slice(-4)}` : ''}
                                </p>
                              </div>
                              {isActive && (
                                <Button
                                  variant={isUnlocked ? 'default' : 'outline'}
                                  onClick={() => handleUnstake(stake)}
                                  disabled={!isUnlocked}
                                >
                                  {isUnlocked ? 'Unstake' : 'Locked'}
                                </Button>
                              )}
                            </div>

                            {/* Transaction Timeline */}
                            <div className="pt-2 border-t">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Transaction Timeline
                              </p>
                              <ol className="relative space-y-4">
                                {steps.map((step, idx) => {
                                  const StepIcon = step.icon;
                                  const isLast = idx === steps.length - 1;
                                  return (
                                    <li key={step.key} className="flex gap-3 relative">
                                      {!isLast && (
                                        <span
                                          className={`absolute left-[15px] top-8 bottom-[-18px] w-px ${step.done ? 'bg-primary/40' : 'bg-border'}`}
                                          aria-hidden="true"
                                        />
                                      )}
                                      <div
                                        className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 ${
                                          step.done
                                            ? 'bg-primary/10 border-primary text-primary'
                                            : 'bg-muted border-border text-muted-foreground'
                                        }`}
                                      >
                                        <StepIcon className="h-4 w-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <p className={`text-sm font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step.label}
                                          </p>
                                          {step.timestamp && (
                                            <p className="text-xs text-muted-foreground">
                                              {new Date(step.timestamp).toLocaleString()}
                                            </p>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rewards Tab */}
            <TabsContent value="rewards" className="space-y-6">
              {/* Accrual Preview — now shows estimated profit-share, not fixed APY */}
              {user && (() => {
                const activeStakes = stakes.filter((s) => s.status === 'active');
                // Estimate: tier credits accrue evenly; profit share is variable so we show stake weight only
                const totalWeightedStake = activeStakes.reduce(
                  (sum, s) => sum + Number(s.amount) * Number(s.apy_percentage),
                  0,
                );
                const lastReward = rewards[0];
                const anchorDate = lastReward
                  ? new Date(lastReward.earned_at)
                  : activeStakes.length > 0
                    ? new Date(Math.min(...activeStakes.map((s) => new Date(s.staked_at).getTime())))
                    : null;
                const daysSinceAnchor = anchorDate
                  ? Math.max(0, Math.floor((Date.now() - anchorDate.getTime()) / 86400000))
                  : 0;
                const monthlyCredits = currentTier?.monthly_credits ?? 0;
                const dailyTierCredits = monthlyCredits / 30;
                const estimatedTierCredits = dailyTierCredits * daysSinceAnchor;
                const nextClaimDate = anchorDate
                  ? new Date(anchorDate.getTime() + 30 * 86400000)
                  : null;
                const daysToNextClaim = nextClaimDate
                  ? Math.max(0, Math.ceil((nextClaimDate.getTime() - Date.now()) / 86400000))
                  : null;
                const claimReady = nextClaimDate ? nextClaimDate.getTime() <= Date.now() : false;

                return (
                  <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-emerald-600" />
                        Profit-Share Preview
                      </CardTitle>
                      <CardDescription>
                        Estimated tier credits and your share weight in the next monthly revenue distribution.
                        Actual B2BN profit share is <strong>variable</strong> — depends on platform revenue that month.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {activeStakes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No active stakes. Stake B2BN to begin earning revenue share and tier credits.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Share Weight</p>
                              <p className="text-2xl font-bold flex items-center gap-1">
                                <Building2 className="h-5 w-5 opacity-60" />
                                {totalWeightedStake.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">stake × tier multiplier</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Tier Credits</p>
                              <p className="text-2xl font-bold">{Math.floor(estimatedTierCredits).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{currentTier?.tier_name ?? 'No tier'} · {monthlyCredits}/mo</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Profit Share</p>
                              <p className="text-2xl font-bold">Variable</p>
                              <p className="text-xs text-muted-foreground">based on monthly revenue</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Next Drop</p>
                              <p className="text-2xl font-bold flex items-center gap-1">
                                <Calendar className="h-5 w-5 opacity-60" />
                                {claimReady ? 'Ready' : `${daysToNextClaim}d`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {nextClaimDate?.toLocaleDateString() ?? '—'}
                              </p>
                            </div>
                          </div>

                          {nextClaimDate && !claimReady && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                                <span>Cycle progress</span>
                                <span>{daysSinceAnchor}/30 days</span>
                              </div>
                              <Progress value={(daysSinceAnchor / 30) * 100} className="h-2" />
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              <Card>
                <CardHeader>
                  <CardTitle>Rewards History</CardTitle>
                  <CardDescription>Profit share, tier credits, and bonuses from real platform revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  {rewards.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No rewards yet. Profit-share drops happen monthly based on platform revenue, your stake amount, and tier weight.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rewards.map((reward) => (
                        <div key={reward.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">+{Number(reward.amount).toLocaleString()}</span>
                              <Badge variant="outline">{reward.reward_type}</Badge>
                              {reward.claimed && <Badge variant="secondary">Claimed</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {reward.description || 'Profit share from platform revenue'} · {new Date(reward.earned_at).toLocaleDateString()}
                            </p>
                          </div>
                          {!reward.claimed && (
                            <Button onClick={() => handleClaim(reward)}>Claim</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Disclaimer */}
          <Alert className="mt-12">
            <Info className="h-4 w-4" />
            <AlertTitle>Important · Halal-Compatible Disclosure</AlertTitle>
            <AlertDescription>
              This staking model is <strong>profit-sharing</strong>, not interest-bearing. There is no fixed APY and no guaranteed return.
              Monthly distributions depend on actual platform revenue and may be zero in any given period.
              Stake records track tier benefits and revenue allocation; on-chain settlement is processed by the B2BN smart contract. Not financial advice.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </>
  );
};

export default Staking;
