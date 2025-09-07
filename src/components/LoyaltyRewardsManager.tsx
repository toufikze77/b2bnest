import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trophy, Plus, Download, Trash2 } from 'lucide-react';

type Tier = {
  id: string;
  name: string;
  thresholdPoints: number;
  multiplier: number; // points earn multiplier at this tier
};

const STORAGE_KEY = 'loyalty_rewards_state_v1';

const LoyaltyRewardsManager = () => {
  const [pointsPerCurrency, setPointsPerCurrency] = useState<number>(1);
  const [currencyPerPoint, setCurrencyPerPoint] = useState<number>(0.01);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [newTierName, setNewTierName] = useState<string>('Silver');
  const [newTierThreshold, setNewTierThreshold] = useState<number>(1000);
  const [newTierMultiplier, setNewTierMultiplier] = useState<number>(1.0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          pointsPerCurrency: number;
          currencyPerPoint: number;
          tiers: Tier[];
        };
        setPointsPerCurrency(parsed.pointsPerCurrency ?? 1);
        setCurrencyPerPoint(parsed.currencyPerPoint ?? 0.01);
        setTiers(parsed.tiers ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const data = { pointsPerCurrency, currencyPerPoint, tiers };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [pointsPerCurrency, currencyPerPoint, tiers]);

  const addTier = () => {
    const tier: Tier = {
      id: crypto.randomUUID(),
      name: newTierName.trim() || 'Tier',
      thresholdPoints: Math.max(0, newTierThreshold),
      multiplier: Math.max(0.1, newTierMultiplier),
    };
    setTiers(prev => [...prev, tier].sort((a, b) => a.thresholdPoints - b.thresholdPoints));
  };

  const removeTier = (id: string) => setTiers(prev => prev.filter(t => t.id !== id));

  const exportCSV = () => {
    const headers = ['name','thresholdPoints','multiplier'];
    const rows = tiers.map(t => [t.name, String(t.thresholdPoints), String(t.multiplier)]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'loyalty-tiers.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const examplePurchase = 120;
  const earnedPoints = Math.round(examplePurchase * pointsPerCurrency);
  const redeemValue = (100 * currencyPerPoint).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Trophy className="h-6 w-6"/> Loyalty & Rewards</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>Points engine</Badge>
          <Badge variant="secondary">Tiers</Badge>
          <Badge variant="secondary">CSV export</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Points Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-1 block">Points per 1 currency</Label>
                <Input type="number" min={0} step={0.1} value={pointsPerCurrency} onChange={(e) => setPointsPerCurrency(Number(e.target.value))} />
              </div>
              <div>
                <Label className="mb-1 block">Currency per point</Label>
                <Input type="number" min={0} step={0.001} value={currencyPerPoint} onChange={(e) => setCurrencyPerPoint(Number(e.target.value))} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={exportCSV} className="w-full"><Download className="h-4 w-4 mr-2"/> Export tiers</Button>
              </div>
            </div>

            <div className="mt-2 text-sm text-gray-600">Example: {examplePurchase} purchase earns {earnedPoints} points. 100 points ≈ {redeemValue} value.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New Tier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="mb-1 block">Name</Label>
              <Input value={newTierName} onChange={(e) => setNewTierName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Threshold (points)</Label>
              <Input type="number" min={0} value={newTierThreshold} onChange={(e) => setNewTierThreshold(Number(e.target.value))} />
            </div>
            <div>
              <Label className="mb-1 block">Earn multiplier</Label>
              <Input type="number" min={0.1} step={0.1} value={newTierMultiplier} onChange={(e) => setNewTierMultiplier(Number(e.target.value))} />
            </div>
            <Button onClick={addTier}><Plus className="h-4 w-4 mr-2"/> Add tier</Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Tier List ({tiers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tiers.length === 0 ? (
              <div className="text-gray-500 text-sm">No tiers yet. Add your first tier.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Name</th>
                      <th className="py-2 pr-2">Threshold</th>
                      <th className="py-2 pr-2">Multiplier</th>
                      <th className="py-2 pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map(t => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">{t.name}</td>
                        <td className="py-2 pr-2">{t.thresholdPoints}</td>
                        <td className="py-2 pr-2">{t.multiplier}x</td>
                        <td className="py-2 pr-2">
                          <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => removeTier(t.id)}><Trash2 className="h-4 w-4"/></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoyaltyRewardsManager;

