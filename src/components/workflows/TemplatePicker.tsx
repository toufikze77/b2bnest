import { useState } from 'react';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { COMING_SOON_REASON, COMING_SOON_TEMPLATES, WORKING_TEMPLATES, WorkingTemplate } from '@/lib/workflowEmailTemplates';

/** Pick a working template, see exactly what it contains, then use it. "Coming soon" ones can't be chosen. */
export function TemplatePicker({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (t: WorkingTemplate) => void }) {
  const [preview, setPreview] = useState<WorkingTemplate | null>(null);
  const close = () => { setPreview(null); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        {preview ? (
          <>
            <DialogHeader>
              <DialogTitle>{preview.name}</DialogTitle>
              <DialogDescription>{preview.description} Starts when you press "Run now". You can change every word before you run it.</DialogDescription>
            </DialogHeader>
            {preview.steps.map((s, i) => (
              <div key={i} className="rounded-md border border-border p-3 text-sm" data-testid="template-preview">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Step {i + 1} · Send an email</p>
                <p className="mb-2"><span className="text-muted-foreground">Subject: </span><span className="font-medium">{s.subject}</span></p>
                <p className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2">{s.body}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Words in double braces, such as {'{{name}}'}, are filled in when you run it. "To" starts as your own email address so you
              can try it on yourself first; change it to your customer's address. When your customer replies, the reply goes to your
              own verified account email.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}><ArrowLeft className="mr-2 h-4 w-4" />All templates</Button>
              <Button onClick={() => { onUse(preview); close(); }}>Use this template</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" />Templates</DialogTitle>
              <DialogDescription>Each template is one email you send with "Run now". Preview it before you use it.</DialogDescription>
            </DialogHeader>
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Working templates">
              {WORKING_TEMPLATES.map((t) => (
                <li key={t.id} className="flex flex-col rounded-md border border-border p-3">
                  <span className="font-medium">{t.name}</span>
                  <span className="mt-1 flex-1 text-sm text-muted-foreground">{t.description}</span>
                  <Button size="sm" variant="outline" className="mt-3 self-start" onClick={() => setPreview(t)} aria-label={`Preview ${t.name}`}>Preview</Button>
                </li>
              ))}
            </ul>
            <section aria-labelledby="coming-soon" className="space-y-2">
              <h3 id="coming-soon" className="text-sm font-semibold">Coming soon</h3>
              <p className="text-xs text-muted-foreground">{COMING_SOON_REASON}</p>
              <ul className="flex flex-wrap gap-2" aria-label="Templates coming soon">
                {COMING_SOON_TEMPLATES.map((t) => (
                  <li key={t.id}><Badge variant="outline" className="font-normal text-muted-foreground" aria-disabled="true">{t.name} · Coming soon</Badge></li>
                ))}
              </ul>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
