import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/data/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { STATUS_LABEL, customerCanReopen, customerCanReply, validateFile, MAX_TEXT, type TicketStatus } from '@/lib/supportTicket';
import * as svc from '@/services/supportService';
import { EMAIL_SENDING_ENABLED } from '@/services/onboardingService';
import { Lock, Paperclip } from 'lucide-react';

/** Conversation for one ticket. Staff see private notes (database decides); customers never receive them. */
export default function TicketThread({ ticketId, staff, onChanged }: { ticketId: string; staff: boolean; onChanged?: () => void }) {
  const { toast } = useToast();
  const [ticket, setTicket] = useState<svc.Ticket | null>(null);
  const [messages, setMessages] = useState<svc.Message[]>([]);
  const [files, setFiles] = useState<svc.Attachment[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const latest = useRef(0);

  const load = async () => {
    const token = ++latest.current;
    try {
      const [t, m, a] = await Promise.all([svc.getTicket(ticketId), svc.listMessages(ticketId), svc.listAttachments(ticketId)]);
      if (token !== latest.current) return; // ignore stale responses
      if (!t) { setTicket(null); setState('missing'); return; }
      setTicket(t); setMessages(m); setFiles(a); setState('ready');
    } catch { if (token === latest.current) setState('error'); }
  };
  useEffect(() => { setTicket(null); setMessages([]); setFiles([]); setState('loading'); setBody(''); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ticketId]);

  const send = async () => {
    if (!ticket || saving || !body.trim()) return;
    if (file) { const err = validateFile(file); if (err) return toast({ title: err, variant: 'destructive' }); }
    setSaving(true);
    try {
      const id = await svc.addMessage(ticket.id, body, staff && internal, requestId.current);
      if (file) {
        try { await svc.uploadAttachment(ticket.organization_id, ticket.id, file, staff && internal, id); }
        catch (e) { toast({ title: 'Reply saved, but the file was not attached', description: (e as Error).message, variant: 'destructive' }); }
      }
      requestId.current = crypto.randomUUID();
      setBody(''); setFile(null); setInternal(false);
      toast({ title: staff && internal ? 'Private note saved' : 'Reply saved' });
      await load(); onChanged?.();
    } catch (e) {
      toast({ title: 'Not saved', description: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const setStatus = async (status: TicketStatus) => {
    if (!ticket) return;
    try { await svc.updateTicket(ticket.id, { status }); await load(); onChanged?.(); toast({ title: `Status: ${STATUS_LABEL[status]}` }); }
    catch (e) { toast({ title: 'Status not changed', description: (e as Error).message, variant: 'destructive' }); }
  };

  const open = async (path: string) => {
    try { window.open(await svc.downloadUrl(path), '_blank', 'noopener'); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };

  if (state === 'loading') return <p className="p-4 text-sm text-muted-foreground">Loading ticket…</p>;
  if (state === 'error') return <div className="p-4 text-sm"><p className="text-destructive">Could not load this ticket.</p><Button size="sm" variant="outline" className="mt-2" onClick={load}>Try again</Button></div>;
  if (state === 'missing' || !ticket) return <p className="p-4 text-sm text-muted-foreground">Ticket not found, or you no longer have access to it.</p>;

  const filesFor = (mid: string | null) => files.filter((f) => f.message_id === mid);
  const FileList = ({ list }: { list: svc.Attachment[] }) => list.length ? (
    <ul className="mt-2 space-y-1">{list.map((f) => (
      <li key={f.id}><button className="inline-flex items-center gap-1 text-xs text-primary underline" onClick={() => open(f.storage_path)}>
        <Paperclip className="h-3 w-3" />{f.file_name} ({Math.ceil(f.size_bytes / 1024)} KB)</button></li>))}</ul>) : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{ticket.reference}</span>
          <Badge variant="outline">{STATUS_LABEL[ticket.status]}</Badge>
          <PriorityBadge value={ticket.priority} />
          <span>Opened {new Date(ticket.created_at).toLocaleString()}</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold">{ticket.subject}</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{ticket.description}</p>
        <FileList list={filesFor(null)} />
      </div>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={`rounded-md border p-3 text-sm ${m.is_internal ? 'border-accent bg-accent/30' : 'border-border bg-surface'}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              {m.is_internal && <span className="inline-flex items-center gap-1 font-medium text-foreground"><Lock className="h-3 w-3" />Private staff note</span>}
              <span>{m.author_id === ticket.requester_id ? 'Customer' : 'Support'}</span>
              <span>{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <FileList list={filesFor(m.id)} />
          </li>
        ))}
        {messages.length === 0 && <li className="text-sm text-muted-foreground">No replies yet.</li>}
      </ol>

      {(staff || customerCanReply(ticket.status)) ? (
        <div className="space-y-2">
          {staff && (
            <div className="inline-flex rounded-md border border-border p-0.5 text-sm" role="group" aria-label="Message type">
              <button className={`rounded px-3 py-1 ${!internal ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setInternal(false)}>Reply to customer</button>
              <button className={`rounded px-3 py-1 ${internal ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setInternal(true)}>Private note</button>
            </div>
          )}
          <Textarea rows={4} maxLength={MAX_TEXT} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={internal ? 'Only staff can see this note' : 'Write a reply…'} aria-label="Message" />
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" aria-label="Attach file" className="text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button disabled={saving || !body.trim()} onClick={send}>{saving ? 'Saving…' : internal ? 'Save note' : 'Send reply'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Up to 10 MB: images, PDF, text, CSV, Word or Excel. Please don't include patient records or other sensitive personal data.</p>
          {staff && !internal && !EMAIL_SENDING_ENABLED && <p className="text-xs text-muted-foreground">The customer sees replies in their portal with an in-app notice. Support emails are switched off, so no email is sent.</p>}
        </div>
      ) : <p className="text-sm text-muted-foreground">This ticket is closed.</p>}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {staff ? (['open', 'waiting_customer', 'resolved', 'closed'] as TicketStatus[]).filter((s) => s !== ticket.status).map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => setStatus(s)}>Mark {STATUS_LABEL[s]}</Button>
        )) : customerCanReopen(ticket.status) && <Button size="sm" variant="outline" onClick={() => setStatus('open')}>Reopen ticket</Button>}
      </div>
    </div>
  );
}
