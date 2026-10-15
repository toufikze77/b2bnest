import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { eligibleAgents } from '@/lib/supportTicket';
import * as svc from '@/services/supportService';

/** Owners/admins appoint or remove support agents. Only active members of this company can be picked. */
export default function AgentManager({ org, me }: { org: string; me: string }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<svc.Member[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const token = ++latest.current;
    setState('loading'); setMembers([]); setAgents([]);
    try {
      const [m, a] = await Promise.all([svc.listCompanyMembers(org), svc.listAgents(org)]);
      if (token !== latest.current) return;
      setMembers(m); setAgents(a.map((x) => x.user_id)); setState('ready');
    } catch { if (token === latest.current) setState('error'); }
  }, [org]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return; setBusy(true);
    try { await fn(); toast({ title: ok }); setPick(''); await load(); }
    catch (e) { toast({ title: 'Not saved', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  if (state === 'loading') return <p className="text-sm text-muted-foreground">Loading team…</p>;
  if (state === 'error') return <p className="text-sm text-destructive">Could not load the team. <Button size="sm" variant="outline" onClick={load}>Try again</Button></p>;

  const eligible = eligibleAgents(members, agents);
  const admins = members.filter((m) => m.role === 'owner' || m.role === 'admin');
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Owners and admins always handle tickets: {admins.map((a) => a.name).join(', ') || '—'}.</p>
      <div className="flex flex-wrap gap-2">
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger className="w-64" aria-label="Choose a team member"><SelectValue placeholder={eligible.length ? 'Choose a team member' : 'No other members to add'} /></SelectTrigger>
          <SelectContent>{eligible.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button disabled={busy || !pick} onClick={() => act(() => svc.addAgent(org, pick, me), 'Agent added')}>Add agent</Button>
      </div>
      {eligible.length === 0 && <p className="text-xs text-muted-foreground">{members.length <= admins.length
        ? <>This company has {members.length} active member{members.length === 1 ? '' : 's'}, all owners or admins (who already handle tickets). Add colleagues in <a className="underline" href="/settings?tab=members">Members &amp; roles</a> first; they will then appear here. Customers are never added as members.</>
        : 'Every other active member is already an agent.'}</p>}
      <ul className="divide-y divide-border text-sm">
        {agents.map((id) => {
          const m = members.find((x) => x.user_id === id);
          return (
            <li key={id} className="flex items-center justify-between py-2">
              <span>{m?.name ?? 'Former member'}{!m && <span className="ml-2 text-xs text-muted-foreground">no longer in the company — has no access</span>}</span>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => svc.removeAgent(org, id), 'Agent removed — access ends immediately')}>Remove</Button>
            </li>
          );
        })}
        {agents.length === 0 && <li className="py-2 text-muted-foreground">No extra agents yet.</li>}
      </ul>
    </div>
  );
}
