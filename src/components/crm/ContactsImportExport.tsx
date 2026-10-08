import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  exportContactsXlsx, downloadContactsTemplate, readSheet, mapSheetToContacts, splitAgainstExisting, extractLinkedIn,
  type ContactRow, type MapResult,
} from '@/lib/crmContactsExcel';

interface Props {
  contacts: (ContactRow & { email?: string | null })[];
  onImported?: () => Promise<void> | void;
}

type Preview = MapResult & { fileName: string; fresh: ContactRow[]; overlap: ContactRow[] };

export default function ContactsImportExport({ contacts, onImported }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const handleFile = async (file: File) => {
    if (!user) return toast.error('Please sign in to import contacts.');
    if (file.size > 10 * 1024 * 1024) return toast.error('File is larger than 10 MB.');
    setBusy(true);
    try {
      const mapped = mapSheetToContacts(await readSheet(file));
      const { fresh, overlap } = splitAgainstExisting(mapped.contacts, contacts as any);
      setPreview({ ...mapped, fileName: file.name, fresh, overlap });
    } catch (e: any) {
      toast.error(e?.message || 'Could not read that file. Use .xlsx or .csv.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!preview || !user) return;
    setBusy(true);
    let inserted = 0, failed = 0;
    for (let i = 0; i < preview.fresh.length; i += 200) {
      const batch = preview.fresh.slice(i, i + 200).map((r) => ({ ...r, name: String(r.name), user_id: user.id }));
      const { error } = await supabase.from('crm_contacts').insert(batch as any);
      if (error) failed += batch.length; else inserted += batch.length;
    }
    setBusy(false);
    const skipped = preview.skipped + preview.overlap.length;
    const msg = `${inserted} inserted, 0 updated, ${skipped} skipped (already in CRM, duplicate in file or no name), ${failed} failed.`;
    failed ? toast.error(msg) : toast.success(msg);
    setPreview(null);
    await onImported?.();
  };

  const sample = preview?.fresh.slice(0, 5) ?? [];

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Import / Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Import from Excel or CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (contacts.length ? exportContactsXlsx(contacts) : toast.info('No contacts to export yet.'))}>
            <Download className="w-4 h-4 mr-2" /> Export contacts to Excel
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => downloadContactsTemplate()}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Download blank template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!preview} onOpenChange={(o) => !o && !busy && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Check import: {preview?.fileName}</DialogTitle>
            <DialogDescription>Nothing is saved until you confirm.</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                <li><strong>{preview.fresh.length}</strong> new contacts will be added</li>
                <li><strong>{preview.overlap.length}</strong> already in your CRM — skipped</li>
                <li><strong>{preview.skipped}</strong> skipped (no name or repeated in file)</li>
                <li><strong>{preview.withLinkedIn}</strong> have a LinkedIn profile</li>
              </ul>
              {preview.placeholders > 0 && (
                <p className="flex gap-2 rounded-md border border-border bg-muted p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {preview.placeholders} email cells are not real addresses (for example “likely @… — unverified”). They won't be saved as emails; the text is kept in Notes and these contacts show “Email unavailable — not verified”.
                </p>
              )}
              {preview.unsupportedColumns.length > 0 && (
                <p className="flex gap-2 rounded-md border border-border bg-muted p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  These columns have no matching CRM field and won't be imported: {preview.unsupportedColumns.join(', ')}
                </p>
              )}
              {sample.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted"><tr>{['Name', 'Company', 'Position', 'Source', 'LinkedIn', 'Notes'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
                    <tbody>
                      {sample.map((r, i) => (
                        <tr key={i} className="border-t align-top">
                          <td className="p-2">{r.name}</td><td className="p-2">{r.company || '—'}</td><td className="p-2">{r.position || '—'}</td>
                          <td className="p-2">{r.source || '—'}</td><td className="p-2 break-all">{extractLinkedIn(r.notes as string) || '—'}</td>
                          <td className="p-2 whitespace-pre-wrap">{String(r.notes || '—').slice(0, 160)}{String(r.notes || '').length > 160 ? '…' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Cancel</Button>
            <Button disabled={busy || !preview?.fresh.length} onClick={confirmImport}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {preview?.fresh.length ?? 0} contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
