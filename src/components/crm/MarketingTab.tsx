import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CalendarDays, Megaphone, Info, Lock, Archive, ArchiveRestore, Pencil, Plus, ListTodo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { filterAudience, parseFilter, resolveSelected, DEFAULT_FILTER, type AudienceContact, type AudienceFilter } from '@/lib/marketingAudience';
import {
  listAll, save, setArchived, visibleTasks, createFollowUpTask, NotEnabledError,
  type Audience, type Campaign, type ContentItem, type Channel, type CampaignStatus, type Table,
} from '@/services/marketingPlanService';

type C = AudienceContact & { id: string; name: string; company?: string | null };

const CHANNELS: Channel[] = ['email', 'linkedin', 'phone', 'event', 'other'];
const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Draft', planned: 'Planned', completed: 'Completed (marked by you)' };

/**
 * Marketing planning workspace. Planning only: nothing here sends email, SMS or social posts.
 * All records are private to the signed-in user, independent of the selected company.
 */
const MarketingTab = ({ contacts }: { contacts: C[] }) => {
  const { user } = useAuth();
  const { organizationId, organization } = useActiveOrganization();
  const { toast } = useToast();
  const [f, setF] = useState<AudienceFilter>(DEFAULT_FILTER);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [tasks, setTasks] = useState<Record<string, { title: string }>>({});
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [audName, setAudName] = useState('');
  const [editAud, setEditAud] = useState<Audience | null>(null);
  const [camp, setCamp] = useState<Partial<Campaign> | null>(null);
  const [item, setItem] = useState<Partial<ContentItem> | null>(null);
  const [formError, setFormError] = useState('');

  const sources = useMemo(() => Array.from(new Set(contacts.map((c) => c.source).filter(Boolean) as string[])).sort(), [contacts]);
  const audience = useMemo(() => filterAudience(contacts, f), [contacts, f]);

  const load = useCallback(async () => {
    try {
      const r = await listAll();
      setAudiences(r.audiences.map((a) => ({ ...a, filter: parseFilter(a.filter) })));
      setCampaigns(r.campaigns); setContent(r.content); setEnabled(true);
      setTasks(await visibleTasks(r.content.map((i) => i.todo_id).filter(Boolean) as string[]));
    } catch (e) {
      if (e instanceof NotEnabledError) setEnabled(false);
      else toast({ title: 'Could not load marketing plans', description: (e as Error).message, variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A linked task may be deleted on another screen or tab. The database clears the
  // link automatically (ON DELETE SET NULL), so re-read when the user comes back.
  useEffect(() => {
    const onBack = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => { window.removeEventListener('focus', onBack); document.removeEventListener('visibilitychange', onBack); };
  }, [load]);

  // Clear everything on sign-out / user change so a previous user's plans never show.
  useEffect(() => {
    setAudiences([]); setCampaigns([]); setContent([]); setTasks({}); setCamp(null); setItem(null); setAudName(''); setEditAud(null);
    setF(DEFAULT_FILTER); setEnabled(null);
    if (user) load();
  }, [user?.id, load]);

  /** Single-flight wrapper: blocks double clicks; keeps the form open with input on failure. */
  const run = async (fn: () => Promise<void>, ok: string, onDone?: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError('');
    try { await fn(); toast({ title: ok }); onDone?.(); await load(); }
    catch (e) { setFormError((e as Error).message); toast({ title: 'Not saved', description: (e as Error).message, variant: 'destructive' }); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const archive = (table: Table, id: string, a: boolean) => run(() => setArchived(table, id, a), a ? 'Archived' : 'Restored');
  const visible = <T extends { archived_at: string | null }>(xs: T[]) => xs.filter((x) => showArchived || !x.archived_at);

  const saveAudience = () => {
    const name = (editAud ? editAud.name : audName).trim();
    if (!name) { setFormError('Give the audience a name.'); return; }
    run(() => save('marketing_audiences', { id: editAud?.id, name, filter: f }), 'Audience saved', () => { setAudName(''); setEditAud(null); });
  };

  const saveCampaign = () => {
    if (!camp) return;
    if (!camp.name?.trim()) { setFormError('Give the campaign a name.'); return; }
    if (camp.start_date && camp.end_date && camp.end_date < camp.start_date) { setFormError('The end date cannot be before the start date.'); return; }
    const ids = resolveSelected(camp.contact_ids || [], contacts).found.map((c) => c.id); // drop deleted contacts
    run(() => save('marketing_campaigns', {
      id: camp.id, name: camp.name!.trim(), objective: camp.objective || null, channel: camp.channel || 'email',
      content: camp.content || null, status: camp.status || 'draft', start_date: camp.start_date || null,
      end_date: camp.end_date || null, audience_id: camp.audience_id || null, contact_ids: ids,
    }), 'Campaign saved', () => setCamp(null));
  };

  const saveItem = () => {
    if (!item) return;
    if (!item.title?.trim()) { setFormError('Give the content a title.'); return; }
    run(() => save('marketing_content_items', {
      id: item.id, title: item.title!.trim(), channel: item.channel || null, planned_for: item.planned_for || null, campaign_id: item.campaign_id || null,
    }), 'Planned content saved', () => setItem(null));
  };

  const makeTask = (i: ContentItem) => {
    if (!user || !organizationId) { toast({ title: 'Choose a company first', description: 'Tasks are created in the company selected in the top bar.', variant: 'destructive' }); return; }
    run(() => createFollowUpTask(i, user.id, organizationId), `Task created in ${organization?.name || 'the selected company'}`);
  };

  const fillFromAudience = (a: Audience) => setCamp((c) => c && ({ ...c, audience_id: a.id, contact_ids: filterAudience(contacts, a.filter).map((x) => x.id) }));
  const off = enabled === false;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1">
            <p>Marketing is for planning. It never sends email, SMS or social posts, and it shows no opens, clicks or replies, because none are recorded.</p>
            <p className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Audiences, campaigns and planned content are private to you. Switching company does not share them.</p>
          </div>
        </CardContent>
      </Card>

      {off && (
        <Card className="border-dashed"><CardContent className="p-4 text-sm">
          Saving plans isn't switched on yet — it needs an approved database update. You can still use the audience builder below.
        </CardContent></Card>
      )}

      <div className="flex items-center justify-end gap-2 text-sm">
        <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
        <Label htmlFor="show-archived">Show archived</Label>
      </div>

      {/* Audiences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Audiences</CardTitle>
          <CardDescription>A saved audience stores the filter, not a fixed list. Its members are recalculated from your current contacts, so the count can change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={f.status} onValueChange={(status) => setF({ ...f, status })}>
              <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={f.source} onValueChange={(source) => setF({ ...f, source })}>
              <SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.reach} onValueChange={(reach) => setF({ ...f, reach: reach as AudienceFilter['reach'] })}>
              <SelectTrigger aria-label="Reachable by"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any contact details</SelectItem>
                <SelectItem value="email">Has an email address</SelectItem>
                <SelectItem value="linkedin">Has a LinkedIn profile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm"><span className="text-2xl font-semibold">{audience.length}</span> of {contacts.length} contacts match.</p>
          <p className="text-xs text-muted-foreground">"Has an email address" means a correctly formatted address. It does not mean the address is verified or that the person has agreed to marketing.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Audience name" placeholder={editAud ? 'Audience name' : 'Name this audience, e.g. UK leads with email'} maxLength={120}
              value={editAud ? editAud.name : audName}
              onChange={(e) => editAud ? setEditAud({ ...editAud, name: e.target.value }) : setAudName(e.target.value)} disabled={off} />
            <Button onClick={saveAudience} disabled={off || busy}>{editAud ? 'Save changes' : 'Save audience'}</Button>
            {editAud && <Button variant="ghost" onClick={() => { setEditAud(null); setF(DEFAULT_FILTER); }}>Cancel</Button>}
          </div>
          {!camp && !item && formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          {visible(audiences).length > 0 && (
            <ul className="divide-y rounded-md border text-sm">
              {visible(audiences).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{a.name} {a.archived_at && <Badge variant="secondary">Archived</Badge>}</span>
                  <span className="text-muted-foreground">{filterAudience(contacts, a.filter).length} contacts now</span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Edit ${a.name}`} onClick={() => { setEditAud(a); setF(a.filter); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label={a.archived_at ? `Restore ${a.name}` : `Archive ${a.name}`} disabled={busy} onClick={() => archive('marketing_audiences', a.id, !a.archived_at)}>
                      {a.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Megaphone className="h-5 w-5" /> Campaign drafts</CardTitle>
            <CardDescription>Each campaign keeps its own chosen contacts. Editing an audience later does not change them.</CardDescription>
          </div>
          <Button size="sm" disabled={off} onClick={() => { setFormError(''); setCamp({ channel: 'email', status: 'draft', contact_ids: [] }); }}><Plus className="h-4 w-4" /> New</Button>
        </CardHeader>
        <CardContent>
          {visible(campaigns).length === 0 ? <p className="text-sm text-muted-foreground">No campaigns yet.</p> : (
            <ul className="divide-y rounded-md border text-sm">
              {visible(campaigns).map((c) => {
                const sel = resolveSelected(c.contact_ids, contacts);
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{c.name}</span> <Badge variant="outline">{STATUS_LABEL[c.status]}</Badge> {c.archived_at && <Badge variant="secondary">Archived</Badge>}
                      <span className="block text-xs text-muted-foreground">
                        {c.channel} · {sel.found.length} contacts{sel.missing ? ` (${sel.missing} no longer in your CRM)` : ''}{c.start_date ? ` · ${c.start_date}${c.end_date ? ` → ${c.end_date}` : ''}` : ''}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => { setFormError(''); setCamp(c); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label={c.archived_at ? `Restore ${c.name}` : `Archive ${c.name}`} disabled={busy} onClick={() => archive('marketing_campaigns', c.id, !c.archived_at)}>
                        {c.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Planned content */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5" /> Planned content</CardTitle>
            <CardDescription>
              Plan posts or messages by date. "Create task" adds one task, with the planned date as its due date, to the company selected in the top bar
              ({organization?.name || 'none selected'}) so it shows in your existing tasks and calendar. People in that company can see that task.
            </CardDescription>
          </div>
          <Button size="sm" disabled={off} onClick={() => { setFormError(''); setItem({}); }}><Plus className="h-4 w-4" /> New</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {visible(content).length === 0 ? <p className="text-sm text-muted-foreground">No planned content yet.</p> : (
            <ul className="divide-y rounded-md border text-sm">
              {visible(content).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{i.title}</span> {i.archived_at && <Badge variant="secondary">Archived</Badge>}
                    <span className="block text-xs text-muted-foreground">
                      {i.planned_for || 'No date'}{i.channel ? ` · ${i.channel}` : ''}{i.campaign_id ? ` · ${campaigns.find((c) => c.id === i.campaign_id)?.name || 'campaign'}` : ''}
                      {' · '}{i.todo_id ? (tasks[i.todo_id] ? 'Task linked' : 'Linked task not available to you') : 'No linked task'}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    {!i.todo_id && <Button size="sm" variant="outline" disabled={busy || !!i.archived_at} onClick={() => makeTask(i)}><ListTodo className="h-4 w-4" /> Create task</Button>}
                    <Button size="sm" variant="ghost" aria-label={`Edit ${i.title}`} onClick={() => { setFormError(''); setItem(i); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label={i.archived_at ? `Restore ${i.title}` : `Archive ${i.title}`} disabled={busy} onClick={() => archive('marketing_content_items', i.id, !i.archived_at)}>
                      {i.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="px-0"><Link to="/project-management">Open tasks and calendar</Link></Button>
        </CardContent>
      </Card>

      {/* Campaign dialog */}
      <Dialog open={!!camp} onOpenChange={(o) => !o && !busy && setCamp(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{camp?.id ? 'Edit campaign' : 'New campaign'}</DialogTitle>
            <DialogDescription>A private plan. Saving does not send anything.</DialogDescription>
          </DialogHeader>
          {camp && (
            <div className="grid gap-3">
              <div><Label htmlFor="c-name">Name</Label><Input id="c-name" maxLength={160} value={camp.name || ''} onChange={(e) => setCamp({ ...camp, name: e.target.value })} /></div>
              <div><Label htmlFor="c-obj">Objective</Label><Input id="c-obj" maxLength={2000} value={camp.objective || ''} onChange={(e) => setCamp({ ...camp, objective: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Channel</Label>
                  <Select value={camp.channel} onValueChange={(v) => setCamp({ ...camp, channel: v as Channel })}>
                    <SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Status</Label>
                  <Select value={camp.status} onValueChange={(v) => setCamp({ ...camp, status: v as CampaignStatus })}>
                    <SelectTrigger aria-label="Campaign status"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(STATUS_LABEL) as CampaignStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label htmlFor="c-start">Start date</Label><Input id="c-start" type="date" value={camp.start_date || ''} onChange={(e) => setCamp({ ...camp, start_date: e.target.value })} /></div>
                <div><Label htmlFor="c-end">End date</Label><Input id="c-end" type="date" value={camp.end_date || ''} onChange={(e) => setCamp({ ...camp, end_date: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">"Completed" means you marked the plan as done. It does not mean anything was sent.</p>
              <div><Label htmlFor="c-content">Content</Label><Textarea id="c-content" rows={4} maxLength={20000} value={camp.content || ''} onChange={(e) => setCamp({ ...camp, content: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Contacts ({resolveSelected(camp.contact_ids || [], contacts).found.length} chosen)</Label>
                {audiences.filter((a) => !a.archived_at).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {audiences.filter((a) => !a.archived_at).map((a) => (
                      <Button key={a.id} type="button" size="sm" variant="outline" onClick={() => fillFromAudience(a)}>Fill from "{a.name}"</Button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Filling from an audience copies today's matching contacts into this campaign. Later audience changes won't alter it.</p>
                <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
                  {contacts.map((c) => {
                    const on = (camp.contact_ids || []).includes(c.id);
                    return (
                      <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
                        <Checkbox id={`cc-${c.id}`} checked={on} onCheckedChange={(v) => setCamp({ ...camp, contact_ids: v ? [...(camp.contact_ids || []), c.id] : (camp.contact_ids || []).filter((x) => x !== c.id) })} />
                        <label htmlFor={`cc-${c.id}`} className="flex-1 truncate">{c.name}<span className="text-muted-foreground"> · {c.company || '—'}</span></label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCamp(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveCampaign} disabled={busy}>{busy ? 'Saving…' : 'Save campaign'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content dialog */}
      <Dialog open={!!item} onOpenChange={(o) => !o && !busy && setItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{item?.id ? 'Edit planned content' : 'New planned content'}</DialogTitle>
            <DialogDescription>Private to you. A task is only created when you click "Create task".</DialogDescription>
          </DialogHeader>
          {item && (
            <div className="grid gap-3">
              <div><Label htmlFor="i-title">Title</Label><Input id="i-title" maxLength={160} value={item.title || ''} onChange={(e) => setItem({ ...item, title: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="i-date">Planned for</Label><Input id="i-date" type="date" value={item.planned_for || ''} onChange={(e) => setItem({ ...item, planned_for: e.target.value })} /></div>
                <div><Label>Channel</Label>
                  <Select value={item.channel || 'none'} onValueChange={(v) => setItem({ ...item, channel: v === 'none' ? null : (v as Channel) })}>
                    <SelectTrigger aria-label="Content channel"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Not set</SelectItem>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div><Label>Campaign</Label>
                <Select value={item.campaign_id || 'none'} onValueChange={(v) => setItem({ ...item, campaign_id: v === 'none' ? null : v })}>
                  <SelectTrigger aria-label="Campaign"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{campaigns.filter((c) => !c.archived_at || c.id === item.campaign_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select></div>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItem(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveItem} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketingTab;
