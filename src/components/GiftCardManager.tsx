import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Download, Plus, Trash2 } from 'lucide-react';

type GiftCard = {
  id: string;
  code: string;
  balance: number;
  currency: string;
  expiresAt?: string;
  isActive: boolean;
};

const STORAGE_KEY = 'giftcards_state_v1';

const GiftCardManager = () => {
  const [currency, setCurrency] = useState<string>('USD');
  const [amount, setAmount] = useState<number>(50);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [cards, setCards] = useState<GiftCard[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { currency: string; cards: GiftCard[] };
        setCurrency(parsed.currency || 'USD');
        setCards(parsed.cards || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ currency, cards }));
    } catch {}
  }, [currency, cards]);

  const createCard = () => {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const gc: GiftCard = {
      id: crypto.randomUUID(),
      code,
      balance: Math.max(1, amount),
      currency,
      expiresAt: expiresAt || undefined,
      isActive: true,
    };
    setCards(prev => [gc, ...prev]);
  };

  const deactivate = (id: string) => setCards(prev => prev.map(c => c.id === id ? { ...c, isActive: false } : c));
  const remove = (id: string) => setCards(prev => prev.filter(c => c.id !== id));

  const exportCSV = () => {
    const headers = ['code','balance','currency','expiresAt','isActive'];
    const rows = cards.map(c => [c.code, c.balance, c.currency, c.expiresAt || '', c.isActive ? 'true' : 'false']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'giftcards.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><CreditCard className="h-6 w-6"/> Gift Cards</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>Codes</Badge>
          <Badge variant="secondary">Export</Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Gift Card</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="mb-1 block">Amount</Label>
            <Input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label className="mb-1 block">Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Expires at</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={createCard} className="w-full"><Plus className="h-4 w-4 mr-2"/> Create</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gift Cards ({cards.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-3">
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2"/> Export</Button>
          </div>
          {cards.length === 0 ? (
            <div className="text-gray-500 text-sm">No gift cards yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Code</th>
                    <th className="py-2 pr-2">Balance</th>
                    <th className="py-2 pr-2">Expires</th>
                    <th className="py-2 pr-2">Active</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map(c => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-mono">{c.code}</td>
                      <td className="py-2 pr-2">{c.currency} {c.balance.toFixed(2)}</td>
                      <td className="py-2 pr-2">{c.expiresAt || '—'}</td>
                      <td className="py-2 pr-2">{c.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-2">
                          {c.isActive && <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => deactivate(c.id)}>Deactivate</Button>}
                          <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
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
  );
};

export default GiftCardManager;

