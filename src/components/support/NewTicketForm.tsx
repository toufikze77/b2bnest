import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { validateTicket, validateFile, MAX_TEXT, TICKET_PRIORITIES } from '@/lib/supportTicket';
import * as svc from '@/services/supportService';

export default function NewTicketForm({ org, categories, onCreated }: { org: string; categories: svc.Category[]; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('none');
  const [priority, setPriority] = useState('medium');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(crypto.randomUUID()); // same id on retry => same ticket

  const submit = async () => {
    const err = validateTicket(subject, description) || (file && validateFile(file));
    if (err) return toast({ title: err, variant: 'destructive' });
    if (saving) return;
    setSaving(true);
    try {
      const id = await svc.createTicket(org, subject, description, category === 'none' ? null : category, priority, requestId.current);
      if (file) {
        try { await svc.uploadAttachment(org, id, file, false, null); }
        catch (e) { toast({ title: 'Ticket saved, but the file was not attached', description: (e as Error).message, variant: 'destructive' }); }
      }
      toast({ title: 'Ticket created' });
      requestId.current = crypto.randomUUID();
      onCreated(id);
    } catch (e) {
      toast({ title: 'Ticket not created', description: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
      <Textarea rows={6} placeholder="Describe the problem" value={description} maxLength={MAX_TEXT} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
      <div className="flex flex-wrap gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">No category</SelectItem>
            {categories.filter((c) => !c.archived_at).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36" aria-label="Priority"><SelectValue /></SelectTrigger>
          <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p[0].toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <input type="file" aria-label="Attach file" className="text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <p className="text-xs text-muted-foreground">For everyday IT support. Please don't include patient records or other sensitive personal data.</p>
      <Button className="w-full" disabled={saving} onClick={submit}>{saving ? 'Creating…' : 'Create ticket'}</Button>
    </div>
  );
}
