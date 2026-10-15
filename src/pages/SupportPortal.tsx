import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TicketThread from '@/components/support/TicketThread';
import NewTicketForm from '@/components/support/NewTicketForm';
import { STATUS_LABEL } from '@/lib/supportTicket';
import * as svc from '@/services/supportService';

/** Customer portal: only the signed-in customer's own tickets, for companies that invited them. */
export default function SupportPortal() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'disabled' | 'none'>('loading');
  const [orgs, setOrgs] = useState<svc.SupportSettings[]>([]);
  const [org, setOrg] = useState<string | null>(null);
  const [tickets, setTickets] = useState<svc.Ticket[]>([]);
  const [categories, setCategories] = useState<svc.Category[]>([]);
  const [creating, setCreating] = useState(false);
  const latest = useRef(0);
  const selected = params.get('ticket');

  useEffect(() => {
    const token = ++latest.current;
    setOrgs([]); setOrg(null); setTickets([]); setState('loading');
    if (!user) return;
    (async () => {
      try {
        await svc.claimInvitations();
        const rows = await svc.myCustomerCompanies(user.id);
        const s = (await Promise.all(rows.map((r) => svc.getSettings(r.organization_id)))).filter(Boolean) as svc.SupportSettings[];
        if (token !== latest.current) return;
        setOrgs(s); setOrg(s[0]?.organization_id ?? null); setState(s.length ? 'ready' : 'none');
      } catch (e) { if (token === latest.current) setState(e instanceof svc.NotEnabledError ? 'disabled' : 'error'); }
    })();
  }, [user]);

  const loadTickets = useCallback(async () => {
    if (!org) return;
    const token = ++latest.current;
    try {
      const [t, c] = await Promise.all([svc.listTickets(org), svc.listCategories(org)]);
      if (token === latest.current) { setTickets(t); setCategories(c); }
    } catch { if (token === latest.current) setState('error'); }
  }, [org]);
  useEffect(() => { setTickets([]); loadTickets(); }, [loadTickets]);

  const current = orgs.find((o) => o.organization_id === org);
  const pick = (id: string | null) => { const n = new URLSearchParams(params); if (id) n.set('ticket', id); else n.delete('ticket'); setParams(n); };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">{current?.support_name || 'Support portal'}</h1>
        {current?.support_hours && <p className="text-sm text-muted-foreground">Support hours: {current.support_hours}{current.time_zone ? ` (${current.time_zone})` : ''}</p>}
      </header>
      {state === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {state === 'disabled' && <Card className="p-4 text-sm">The support portal is not switched on yet.</Card>}
      {state === 'error' && <Card className="p-4 text-sm text-destructive">Could not load your tickets. Please refresh to try again.</Card>}
      {state === 'none' && <Card className="p-4 text-sm">There's no support access for {user?.email}. Ask the company that supports you to invite this email address.</Card>}
      {state === 'ready' && (
        <>
          {orgs.length > 1 && (
            <div className="flex flex-wrap gap-2">{orgs.map((o) => (
              <Button key={o.organization_id} size="sm" variant={o.organization_id === org ? 'default' : 'outline'} onClick={() => { pick(null); setOrg(o.organization_id); }}>{o.support_name}</Button>))}</div>
          )}
          {selected ? (
            <Card className="p-4"><Button size="sm" variant="ghost" onClick={() => pick(null)}>← All my tickets</Button><TicketThread ticketId={selected} staff={false} onChanged={loadTickets} /></Card>
          ) : creating && org ? (
            <Card className="p-4"><h2 className="mb-3 font-semibold">New ticket</h2>
              <NewTicketForm org={org} categories={categories} onCreated={(id) => { setCreating(false); loadTickets(); pick(id); }} />
              <Button variant="ghost" className="mt-2" onClick={() => setCreating(false)}>Cancel</Button></Card>
          ) : (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">My tickets</h2><Button onClick={() => setCreating(true)}>New ticket</Button></div>
              {tickets.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">You haven't raised any tickets yet.</p> : (
                <ul className="divide-y divide-border">{tickets.map((t) => (
                  <li key={t.id}><button className="w-full py-2 text-left text-sm hover:bg-muted" onClick={() => pick(t.id)}>
                    <span className="font-mono text-xs text-muted-foreground">{t.reference}</span> <Badge variant="outline">{STATUS_LABEL[t.status]}</Badge>
                    <div className="font-medium">{t.subject}</div></button></li>))}</ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
