import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { exportContactsXlsx, downloadContactsTemplate, readSheet, mapSheetToContacts, type ContactRow } from '@/lib/crmContactsExcel';

interface Props {
  contacts: (ContactRow & { email?: string | null })[];
  onImported?: () => Promise<void> | void;
}

export default function ContactsImportExport({ contacts, onImported }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!user) return toast.error('Please sign in to import contacts.');
    if (file.size > 10 * 1024 * 1024) return toast.error('File is larger than 10 MB.');
    setBusy(true);
    try {
      const { contacts: rows, skipped } = mapSheetToContacts(await readSheet(file));
      const existing = new Set(contacts.map((c) => (c.email || '').toLowerCase()).filter(Boolean));
      const fresh = rows.filter((r) => !r.email || !existing.has(String(r.email)));
      const dup = rows.length - fresh.length;
      if (!fresh.length) {
        toast.error(`No new contacts found. ${skipped + dup} rows skipped (missing name or duplicate email).`);
        return;
      }
      let inserted = 0;
      for (let i = 0; i < fresh.length; i += 200) {
        const batch = fresh.slice(i, i + 200).map((r) => ({ ...r, name: String(r.name), user_id: user.id }));
        const { error } = await supabase.from('crm_contacts').insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }
      toast.success(`${inserted} contacts imported. ${skipped + dup} skipped (missing name or duplicate email).`);
      await onImported?.();
    } catch (e: any) {
      toast.error(e?.message || 'Could not read that file. Use .xlsx or .csv.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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
          <DropdownMenuItem
            onClick={() => (contacts.length ? exportContactsXlsx(contacts) : toast.info('No contacts to export yet.'))}
          >
            <Download className="w-4 h-4 mr-2" /> Export contacts to Excel
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => downloadContactsTemplate()}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Download blank template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
