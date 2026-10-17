import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { invitableRoles, staffInviteLink, staffInvitationState, emailStatusLabel, seatSummaryText, EMAIL_OFF_NOTICE, type StaffInvitation, type EmailStatus, type SeatSummary } from '@/lib/onboarding';
import * as svc from '@/services/onboardingService';

/** Owner/admin invitation of colleagues (company members, paid seats). All rules are enforced by the database RPCs. */
export default function InviteMembers() {
  const { toast } = useToast();
  const { organizationId, organization } = useActiveOrganization();
  const roles = invitableRoles(organization?.role);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('member');
  const [rows, setRows] = useState<StaffInvitation[]>([]);
  const [mail, setMail] = useState<Record<string, EmailStatus>>({});
  const [seats, setSeats] = useState<SeatSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_installed' | 'error'>('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || roles.length === 0) return;
    try {
      const [inv, st, s] = await Promise.all([svc.listStaffInvitations(organizationId), svc.emailStatuses(organizationId), svc.seatSummary(organizationId)]);
      setRows(inv); setMail(Object.fromEntries(st.map((r) => [r.invitation_id, r.status]))); setSeats(s ?? null); setState('ready');
    } catch (e) { setState(e instanceof svc.NotInstalledError ? 'not_installed' : 'error'); }
  }, [organizationId, roles.length]);
  useEffect(() => { load(); }, [load]);

  if (!organizationId || roles.length === 0) return null;

  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(staffInviteLink(window.location.origin, await svc.invitationToken(id))); toast({ title: 'Invitation link copied', description: 'It only works for the invited email address once verified.' }); }
    catch (e) { toast({ title: 'Could not copy link', description: (e as Error).message, variant: 'destructive' }); }
  };
  const invite = async () => {
    setBusy(true);
    try {
      const r = await svc.inviteMember(organizationId, email, role);
      if (r?.outcome === 'already_member') toast({ title: `${email} is already a member` });
      else if (r?.outcome === 'already_pending') toast({ title: `${email} is already invited`, description: 'Use "Copy invitation link" on their row.' });
      else { toast({ title: 'Invitation saved — email not sent', description: `${email} is in the list below. Copy the link and send it yourself.` }); setEmail(''); }
      await load();
    } catch (e) { toast({ title: 'Invitation not saved', description: (e as Error).message, variant: 'destructive' }); }
    setBusy(false);
  };
  const manage = async (id: string, action: 'revoke' | 'extend') => {
    try { await svc.manageInvitation(id, action); await load(); } catch (e) { toast({ title: 'Not changed', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite colleagues · {organization?.name}</CardTitle>
        <CardDescription>Colleagues join as company members and use a seat. Support customers are invited from the Support desk instead and never use a seat.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'not_installed' && <p className="text-sm text-muted-foreground">Inviting colleagues isn't switched on yet. It needs an approved database update.</p>}
        {state === 'error' && <p role="alert" className="text-sm text-destructive">Could not load invitations. <Button size="sm" variant="outline" onClick={load}>Try again</Button></p>}
        {state === 'ready' && (
          <>
            {!svc.EMAIL_SENDING_ENABLED && <p role="note" className="rounded-md border border-border bg-muted/40 p-2 text-sm">{EMAIL_OFF_NOTICE}</p>}
            {seats && <p className="text-sm text-muted-foreground">{seatSummaryText(seats)}</p>}
            <div className="flex flex-wrap gap-2">
              <Input type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" aria-label="Colleague email" />
              <Select value={role} onValueChange={setRole}><SelectTrigger className="w-36" aria-label="Role"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
              <Button onClick={invite} disabled={busy || !email.trim()}>Invite</Button>
            </div>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">No invitations yet.</p> : (
              <ul className="divide-y divide-border">{rows.map((i) => {
                const s = staffInvitationState(i);
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><span className="font-medium">{i.email}</span> <Badge variant="outline" className="capitalize">{i.role}</Badge> <Badge variant="secondary">{s}</Badge>
                      {s === 'Pending' && <span className="ml-2 text-muted-foreground">{emailStatusLabel(mail[i.id], svc.EMAIL_SENDING_ENABLED)}</span>}</span>
                    <span className="flex gap-2">
                      {s === 'Pending' && <Button size="sm" variant="outline" onClick={() => copy(i.id)}>Copy invitation link</Button>}
                      {(s === 'Pending' || s === 'Expired') && <Button size="sm" variant="outline" onClick={() => manage(i.id, 'extend')}>Extend 7 days</Button>}
                      {(s === 'Pending' || s === 'Expired') && <Button size="sm" variant="ghost" onClick={() => manage(i.id, 'revoke')}>Revoke</Button>}
                    </span>
                  </li>);
              })}</ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
