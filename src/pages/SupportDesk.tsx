import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PriorityBadge } from '@/components/data/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import TicketThread from '@/components/support/TicketThread';
import NewTicketForm from '@/components/support/NewTicketForm';
import AgentManager from '@/components/support/AgentManager';
import { STATUS_LABEL, TICKET_STATUSES, invitationState, type TicketStatus } from '@/lib/supportTicket';
import * as svc from '@/services/supportService';
import OrganizationSwitcher from '@/components/OrganizationSwitcher';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { readSupportTab, writeSupportTab, isValidTimeZone, listTimeZones, timeZoneOffsetLabel, portalInviteLink, type SupportTab } from '@/lib/supportSetup';

export default function SupportDesk() {
  const { organizationId, organization, memberships, loading: orgLoading } = useActiveOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'disabled'>('loading');
  const [settings, setSettings] = useState<svc.SupportSettings | null>(null);
  const [tickets, setTickets] = useState<svc.Ticket[]>([]);
  const [categories, setCategories] = useState<svc.Category[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'all' | TicketStatus>('active');
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const latest = useRef(0);
  const selected = params.get('ticket');
  const isManager = organization?.role === 'owner' || organization?.role === 'admin';

  const tab = readSupportTab(params, isManager);
  const setTab = (t: string) => setParams(writeSupportTab(params, t as SupportTab));

  // Soft reloads (after a save) keep the screen mounted so the open tab and form text survive.
  const load = useCallback(async (soft = false) => {
    const token = ++latest.current;
    if (!soft) { setSettings(null); setTickets([]); setCategories([]); setState('loading'); }
    if (!organizationId) return;
    try {
      const [s, t, c] = await Promise.all([svc.getSettings(organizationId), svc.listTickets(organizationId), svc.listCategories(organizationId)]);
      if (token !== latest.current) return; // company changed meanwhile
      setSettings(s); setTickets(t); setCategories(c); setState('ready');
    } catch (e) {
      if (token !== latest.current) return;
      setState(e instanceof svc.NotEnabledError ? 'disabled' : 'error');
    }
  }, [organizationId]);
  useEffect(() => { load(); }, [load, user?.id]);

  const shown = useMemo(() => tickets.filter((t) =>
    (status === 'all' || (status === 'active' ? !['resolved', 'closed'].includes(t.status) : t.status === status))
    && (!mine || t.assignee_id === user?.id)
    && (!q || `${t.reference} ${t.subject}`.toLowerCase().includes(q.toLowerCase()))), [tickets, status, mine, q, user?.id]);

  const selectTicket = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('ticket', id); else next.delete('ticket');
    setParams(next);
  };

  if (orgLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your companies…</p>;
  if (memberships.length === 0) return <Card className="m-6 p-4 text-sm">You aren't a member of any company yet, so there is no support desk to show. Ask a company owner to add you.</Card>;
  if (!organizationId) return (
    <Card className="m-6 space-y-3 p-4 text-sm"><p>You belong to {memberships.length} companies. Choose which company's support desk to open:</p><OrganizationSwitcher /></Card>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{settings?.support_name || 'Support tickets'}</h1>
          <p className="text-sm text-muted-foreground">Customers only see their own tickets and never your private notes.</p>
        </div>
        <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Company:</span><OrganizationSwitcher /></div>
        {state === 'ready' && settings && <Button onClick={() => setCreating(true)}>New ticket</Button>}
      </header>

      {state === 'disabled' && <Card className="p-4 text-sm">Support ticketing is ready in preview but not switched on yet. It needs an approved database update before tickets can be saved.</Card>}
      {state === 'error' && <Card className="p-4 text-sm text-destructive">Could not load tickets. <Button size="sm" variant="outline" onClick={() => load()}>Try again</Button></Card>}
      {state === 'loading' && <p className="text-sm text-muted-foreground">Loading tickets…</p>}

      {state === 'ready' && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="tickets">Tickets</TabsTrigger>{isManager && <TabsTrigger value="setup">Setup & access</TabsTrigger>}</TabsList>
          <TabsContent value="tickets">
            {!settings ? (
              <Card className="p-4 text-sm">Support isn't set up for this company yet. {isManager ? 'Open "Setup & access" to start.' : 'Ask a company admin to set it up.'}</Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Card className="p-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Input placeholder="Search reference or subject" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-40 flex-1" aria-label="Search tickets" />
                    <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                      <SelectTrigger className="w-44" aria-label="Status filter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Not resolved</SelectItem><SelectItem value="all">All</SelectItem>
                        {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm"><Switch checked={mine} onCheckedChange={setMine} />Assigned to me</label>
                  </div>
                  {shown.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{tickets.length ? 'No tickets match these filters.' : 'No tickets yet.'}</p> : (
                    <ul className="divide-y divide-border">{shown.map((t) => (
                      <li key={t.id}><button onClick={() => selectTicket(t.id)} className={`w-full px-2 py-2 text-left text-sm hover:bg-muted ${selected === t.id ? 'bg-muted' : ''}`}>
                        <div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{t.reference}</span>
                          <Badge variant="outline">{STATUS_LABEL[t.status]}</Badge><PriorityBadge value={t.priority} /></div>
                        <div className="truncate font-medium">{t.subject}</div>
                        <div className="text-xs text-muted-foreground">Updated {new Date(t.updated_at).toLocaleString()}{categories.find((c) => c.id === t.category_id) ? ` · ${categories.find((c) => c.id === t.category_id)?.name}` : ''}</div>
                      </button></li>))}</ul>
                  )}
                </Card>
                <Card className="p-4">
                  {selected ? <TicketThread ticketId={selected} staff onChanged={() => load(true)} /> : <p className="text-sm text-muted-foreground">Select a ticket to see the conversation.</p>}
                </Card>
              </div>
            )}
          </TabsContent>
          {isManager && <TabsContent value="setup"><SupportSetup org={organizationId} me={user?.id ?? ''} settings={settings} categories={categories} onSaved={() => load(true)} toast={toast} /></TabsContent>}
        </Tabs>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent><DialogHeader><DialogTitle>New ticket</DialogTitle></DialogHeader>
          <NewTicketForm org={organizationId} categories={categories} onCreated={(id) => { setCreating(false); load(true); selectTicket(id); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupportSetup({ org, me, settings, categories, onSaved, toast }: {
  org: string; me: string; settings: svc.SupportSettings | null; categories: svc.Category[]; onSaved: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [name, setName] = useState(settings?.support_name ?? '');
  const [hours, setHours] = useState(settings?.support_hours ?? '');
  const [tz, setTz] = useState(settings?.time_zone ?? '');
  const [portal, setPortal] = useState(settings?.portal_enabled ?? false);
  const [cat, setCat] = useState('');
  const [email, setEmail] = useState('');
  const [client, setClient] = useState('');
  const [customers, setCustomers] = useState<svc.Customer[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { svc.listCustomers(org).then(setCustomers).catch(() => setCustomers([])); }, [org]);

  const act = async (fn: () => Promise<unknown>, ok: string, description?: string) => {
    if (busy) return; setBusy(true);
    try { await fn(); toast({ title: ok, description }); onSaved(); setCustomers(await svc.listCustomers(org)); }
    catch (e) { toast({ title: 'Not saved', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Support details</h2>
        <Input placeholder="Support name shown to customers" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Support name" />
        <Input placeholder="Support hours (optional, leave blank to hide)" value={hours} maxLength={300} onChange={(e) => setHours(e.target.value)} aria-label="Support hours" />
        <TimeZonePicker value={tz} onChange={setTz} />
        <label className="flex items-center gap-2 text-sm"><Switch checked={portal} onCheckedChange={setPortal} />Customer portal on</label>
        <Button disabled={busy || !name.trim() || (!!tz && !isValidTimeZone(tz))} onClick={() => act(() => svc.saveSettings({ organization_id: org, support_name: name.trim(), support_hours: hours.trim() || null, time_zone: isValidTimeZone(tz) ? tz : null, portal_enabled: portal }, !!settings), 'Support details saved')}>Save</Button>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Categories</h2>
        {!settings && <p className="text-sm text-muted-foreground">Save support details first.</p>}
        <div className="flex gap-2"><Input placeholder="New category" value={cat} maxLength={60} onChange={(e) => setCat(e.target.value)} aria-label="New category" />
          <Button disabled={busy || !cat.trim() || !settings} onClick={() => act(async () => { await svc.addCategory(org, cat); setCat(''); }, 'Category added')}>Add</Button></div>
        {settings && categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet. Added categories appear here and in the New ticket form.</p>}
        <ul className="space-y-1 text-sm">{categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between"><span className={c.archived_at ? 'text-muted-foreground line-through' : ''}>{c.name}</span>
            <Button size="sm" variant="ghost" onClick={() => act(() => svc.setCategoryArchived(c.id, !c.archived_at), c.archived_at ? 'Restored' : 'Archived')}>{c.archived_at ? 'Restore' : 'Archive'}</Button></li>))}</ul>
      </Card>
      <Card className="space-y-3 p-4 md:col-span-2">
        <h2 className="font-semibold">Customer access</h2>
        <p className="text-xs text-muted-foreground">Invited customers sign in with this email (it must be verified; invitations expire after 14 days unless used) and see only their own tickets. They are not company members: no projects, CRM, finance or staff notes, and they don't use a staff seat. </p>
        <p className="rounded-md border border-border bg-muted p-2 text-xs">Email sending is switched off: inviting saves the invitation but sends no email. Use "Copy invitation link" and send it yourself. The link holds no password or code — it only works when the person signs in with the invited, verified email.</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="customer@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-48 flex-1" aria-label="Customer email" />
          <Input placeholder="Client business (optional)" value={client} maxLength={120} onChange={(e) => setClient(e.target.value)} className="min-w-40 flex-1" aria-label="Client business" />
          <Button disabled={busy || !settings || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} onClick={() => act(async () => { await svc.inviteCustomer(org, email, me, undefined, client); setEmail(''); setClient(''); }, 'Invitation saved — email not sent', 'Use "Copy invitation link" and share it yourself.')}>Invite</Button>
        </div>
        <ul className="divide-y divide-border text-sm">{customers.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{c.email}{c.client_name ? ` · ${c.client_name}` : ''} <span className="text-xs text-muted-foreground">{invitationState(c)}</span></span>
            <span className="flex gap-2">{!c.revoked_at && !c.user_id && <Button size="sm" variant="ghost" onClick={async () => {
              try { await navigator.clipboard.writeText(portalInviteLink(window.location.origin)); toast({ title: 'Invitation link copied', description: `Send it to ${c.email}. No email was sent.` }); }
              catch { toast({ title: 'Could not copy', description: portalInviteLink(window.location.origin), variant: 'destructive' }); }
            }}>Copy invitation link</Button>}{invitationState(c) === 'Invitation expired' && <Button size="sm" variant="ghost" onClick={() => act(() => svc.extendInvitation(c.id), 'Invitation extended 14 days')}>Extend 14 days</Button>}
            <Button size="sm" variant="outline" onClick={() => act(() => svc.setCustomerRevoked(c.id, !c.revoked_at), c.revoked_at ? 'Access restored' : 'Access removed')}>{c.revoked_at ? 'Restore access' : 'Remove access'}</Button></span>
          </li>))}
          {customers.length === 0 && <li className="py-2 text-muted-foreground">No customers invited yet.</li>}</ul>
      </Card>
      <Card className="space-y-3 p-4 md:col-span-2">
        <h2 className="font-semibold">Support agents</h2>
        {settings ? <AgentManager org={org} me={me} /> : <p className="text-sm text-muted-foreground">Save support details first.</p>}
      </Card>
    </div>
  );
}

function TimeZonePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => listTimeZones(), []);
  const invalid = !!value && !isValidTimeZone(value);
  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-label="Time zone" className="w-full justify-between font-normal">
            {value && !invalid ? `${value} (${timeZoneOffsetLabel(value)} now)` : 'Time zone (optional)'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search, e.g. London" />
            <CommandList>
              <CommandEmpty>No time zone found.</CommandEmpty>
              {value && <CommandItem value="__clear" onSelect={() => { onChange(''); setOpen(false); }}>No time zone</CommandItem>}
              {zones.map((z) => <CommandItem key={z} value={z} onSelect={() => { onChange(z); setOpen(false); }}>{z}</CommandItem>)}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {invalid && <p className="text-xs text-destructive">The saved value "{value}" isn't a recognised time zone. Choose one from the list (for the UK: Europe/London) and save.</p>}
      {!invalid && value && <p className="text-xs text-muted-foreground">Daylight saving is applied automatically.</p>}
    </div>
  );
}
