import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, Copy, Check, Users, Download } from 'lucide-react';

type Referral = {
  id: string;
  code: string;
  clicks: number;
  signups: number;
  conversions: number;
};

const STORAGE_KEY = 'referrals_state_v1';

const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';

const ReferralProgramBuilder = () => {
  const [rewardText, setRewardText] = useState<string>('Get $10 for you and a friend');
  const [domain, setDomain] = useState<string>(baseUrl);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copiedId, setCopiedId] = useState<string>('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { rewardText: string; domain: string; referrals: Referral[] };
        setRewardText(parsed.rewardText ?? rewardText);
        setDomain(parsed.domain ?? domain);
        setReferrals(parsed.referrals ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rewardText, domain, referrals }));
    } catch {}
  }, [rewardText, domain, referrals]);

  const createReferral = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const newRef: Referral = { id: crypto.randomUUID(), code, clicks: 0, signups: 0, conversions: 0 };
    setReferrals(prev => [newRef, ...prev]);
  };

  const linkFor = (code: string) => `${domain.replace(/\/$/, '')}/?ref=${code}`;

  const copyLink = async (code: string, id: string) => {
    await navigator.clipboard.writeText(linkFor(code));
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1500);
  };

  const exportCSV = () => {
    const headers = ['code','clicks','signups','conversions'];
    const rows = referrals.map(r => [r.code, r.clicks, r.signups, r.conversions]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'referrals.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><Users className="h-6 w-6"/> Referral Program</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>Unique links</Badge>
          <Badge variant="secondary">CSV export</Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Program Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label className="mb-1 block">Reward message</Label>
            <Input value={rewardText} onChange={(e) => setRewardText(e.target.value)} placeholder="e.g., Get $10 for you and a friend" />
          </div>
          <div>
            <Label className="mb-1 block">Domain</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Button onClick={createReferral}><LinkIcon className="h-4 w-4 mr-2"/> Create referral link</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral Links ({referrals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-3">
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2"/> Export</Button>
          </div>
          {referrals.length === 0 ? (
            <div className="text-gray-500 text-sm">No links yet. Create one above.</div>
          ) : (
            <div className="space-y-2">
              {referrals.map(r => (
                <div key={r.id} className="border rounded p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-mono truncate">{linkFor(r.code)}</div>
                    <div className="text-xs text-gray-500">Code: {r.code} • Clicks: {r.clicks} • Signups: {r.signups} • Conversions: {r.conversions}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyLink(r.code, r.id)} className="shrink-0">
                    {copiedId === r.id ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralProgramBuilder;

