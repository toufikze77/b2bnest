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
import { Coins, TrendingUp, Lock, Award, Sparkles, Gift, ShieldCheck, Wallet, Info, CheckCircle2, Clock, Unlock, CircleDot, Calendar, Calculator } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

interface Tier {
  id: string;
  name: string;
  min_stake_amount: number;
  apy_percentage: number;
  monthly_credits: number;
  perks: string[];
  badge_color: string;
  sort_order: number;
}

interface Stake {
  id: string;
  amount: number;
  lock_period_days: number;
  apy_percentage: number;
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
    const baseApy = matchingTier?.apy_percentage ?? 5;
    const finalApy = baseApy * lockOption.multiplier;

    setLoading(true);
    const unlocksAt = new Date(Date.now() + lockDays * 86400 * 1000).toISOString();

    const { error } = await supabase.from('user_stakes').insert({
      user_id: user.id,
      amount,
      lock_period_days: lockDays,
      apy_percentage: finalApy,
      status: 'active',
      unlocks_at: unlocksAt,
      wallet_address: walletAddress || null,
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Stake failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Stake recorded', description: `You staked ${amount.toLocaleString()} B2BN at ${finalApy}% APY.` });
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
        title="B2BN Staking & Rewards Portal | Earn APY, Credits & Tier Perks"
        description="Stake B2BN tokens to earn up to 18% APY, monthly AI credits, premium feature access, revenue share, and exclusive tier perks. Bronze, Silver, Gold, and Diamond tiers available."
        keywords="B2BN staking, crypto staking, token rewards, APY, B2BNEST tier, holder benefits, revenue share"
      />

      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Live on B2BNEST</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-cyan-500 bg-clip-text text-transparent">
              Stake B2BN. Earn Everything.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Lock B2BN tokens to earn up to <span className="font-bold text-foreground">18% APY</span>,
              monthly AI credits, premium features, and revenue share.
            </p>
          </div>

          {!user && (
            <Alert className="mb-8 border-primary/30 bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertTitle>Sign in to start staking</AlertTitle>
              <AlertDescription>
                <Link to="/auth" className="text-primary underline font-medium">Create a free account</Link> to stake tokens and earn rewards.
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
                  Stake {(nextTier.min_stake_amount - totalStaked).toLocaleString()} more B2BN to unlock {nextTier.apy_percentage}% APY and {nextTier.monthly_credits} monthly credits.
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
                    <CardDescription>Lock B2BN to earn APY + tier perks. Minimum 1,000 B2BN.</CardDescription>
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
                              {o.label} — {o.multiplier}x APY multiplier
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

                <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      How Staking Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">1</div>
                      <div>
                        <p className="font-medium">Lock B2BN tokens</p>
                        <p className="text-muted-foreground">Choose amount and lock period. Longer locks earn higher APY multipliers.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">2</div>
                      <div>
                        <p className="font-medium">Earn rewards monthly</p>
                        <p className="text-muted-foreground">APY accrues + monthly AI credits drop based on your tier.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">3</div>
                      <div>
                        <p className="font-medium">Unlock tier perks</p>
                        <p className="text-muted-foreground">Premium features, Discord access, governance, revenue share at Diamond.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">4</div>
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
                          <span className="font-bold text-xl">{tier.apy_percentage}%</span>
                          <span className="text-sm opacity-75">APY</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span className="font-bold">+{tier.monthly_credits}</span>
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
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions">
              <Card>
                <CardHeader>
                  <CardTitle>My Stakes</CardTitle>
                  <CardDescription>Active and historical positions</CardDescription>
                </CardHeader>
                <CardContent>
                  {stakes.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Coins className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No stakes yet. Start earning rewards by staking B2BN.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stakes.map((stake) => {
                        const isUnlocked = new Date(stake.unlocks_at).getTime() <= Date.now();
                        const isActive = stake.status === 'active';
                        return (
                          <div key={stake.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">{Number(stake.amount).toLocaleString()} B2BN</span>
                                <Badge variant={isActive ? 'default' : 'secondary'}>{stake.status}</Badge>
                                <Badge variant="outline">{stake.apy_percentage}% APY</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Locked {stake.lock_period_days} days · {isActive ? (isUnlocked ? 'Ready to unstake' : `Unlocks ${new Date(stake.unlocks_at).toLocaleDateString()}`) : 'Closed'}
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
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rewards Tab */}
            <TabsContent value="rewards">
              <Card>
                <CardHeader>
                  <CardTitle>Rewards</CardTitle>
                  <CardDescription>Earned credits, tokens, and bonuses</CardDescription>
                </CardHeader>
                <CardContent>
                  {rewards.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No rewards yet. Rewards drop monthly based on your active stakes and tier.</p>
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
                              {reward.description || 'Staking reward'} · {new Date(reward.earned_at).toLocaleDateString()}
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
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Staking records on B2BNEST track your commitment for tier benefits and reward distribution.
              On-chain settlement is processed by the B2BN smart contract. APY and rewards are projections;
              actual yield depends on protocol performance. Not financial advice.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </>
  );
};

export default Staking;
