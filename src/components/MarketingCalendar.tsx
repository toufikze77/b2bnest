import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalIcon, Plus, Trash2 } from 'lucide-react';

type Promo = {
  id: string;
  title: string;
  start: string; // YYYY-MM-DD
  end?: string;
  channel: string; // e.g., email, sms, social
};

const STORAGE_KEY = 'marketing_calendar_state_v1';

const MarketingCalendar = () => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [title, setTitle] = useState<string>('Spring Sale');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [channel, setChannel] = useState<string>('email');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPromos((JSON.parse(raw) as Promo[]) || []);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(promos));
    } catch {}
  }, [promos]);

  const addPromo = () => {
    if (!title.trim() || !start) return;
    const p: Promo = { id: crypto.randomUUID(), title: title.trim(), start, end: end || undefined, channel };
    setPromos(prev => [p, ...prev].sort((a, b) => a.start.localeCompare(b.start)));
  };

  const remove = (id: string) => setPromos(prev => prev.filter(p => p.id !== id));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2"><CalIcon className="h-6 w-6"/> Marketing Calendar</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge>Campaign planning</Badge>
          <Badge variant="secondary">Channels</Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New Promo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <Label className="mb-1 block">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Start</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">End</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Channel</Label>
            <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="email, sms, social" />
          </div>
          <div className="md:col-span-5">
            <Button onClick={addPromo}><Plus className="h-4 w-4 mr-2"/> Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promotions ({promos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {promos.length === 0 ? (
            <div className="text-gray-500 text-sm">No promos yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Title</th>
                    <th className="py-2 pr-2">Channel</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{p.start}{p.end ? ` → ${p.end}` : ''}</td>
                      <td className="py-2 pr-2">{p.title}</td>
                      <td className="py-2 pr-2">{p.channel}</td>
                      <td className="py-2 pr-2">
                        <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4"/></Button>
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

export default MarketingCalendar;

