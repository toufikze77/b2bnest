import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Download, Loader2, Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  attachmentName, bytesToBase64, defaultEmailMessage, defaultEmailSubject, EmailDocInfo, formatBytes, MESSAGE_MAX, PDF_MAX_BYTES,
  SendResult, SUBJECT_MAX,
} from '@/lib/documentEmail';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: EmailDocInfo & { clientEmail: string };
  /** Already sent: show the extra "your customer gets it again" line. */
  again: boolean;
  /** Where customer replies go (the signed-in owner's email). */
  ownerEmail: string | null;
  /** The address the server sends from (its SMTP_FROM / SMTP_USER), as the server reported it. */
  sender?: string;
  /** Builds the same PDF as "Download PDF". */
  preparePdf: () => Promise<Uint8Array>;
  /** Sends; the parent records the status only after a success reply. The dialog closes on success. */
  onSend: (input: { subject: string; message: string; pdfBase64: string }) => Promise<SendResult>;
  onEditCustomer: () => void;
  onDownload: () => void;
}

/**
 * Preview and send. Nothing is sent until "Send email"; a failure keeps the dialog open with the reason
 * and the manual option. Radix Dialog traps focus and closes on Escape (not while sending).
 */
export function EmailDocumentDialog({ open, onOpenChange, info, again, ownerEmail, sender, preparePdf, onSend, onEditCustomer, onDownload }: Props) {
  const ids = { to: useId(), subject: useId(), message: useId(), count: useId(), note: useId() };
  const noun = info.kind === 'invoice' ? 'invoice' : 'quote';
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [pdf, setPdf] = useState<{ b64: string; size: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<{ error: string; sent?: string } | null>(null);
  const prepare = useRef(preparePdf);
  prepare.current = preparePdf;

  // Fresh defaults and a fresh PDF each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSubject(defaultEmailSubject(info));
    setMessage(defaultEmailMessage(info));
    setPdf(null); setPdfError(null); setFailure(null); setSending(false);
    let live = true;
    prepare.current().then((bytes) => {
      if (!live) return;
      if (bytes.length > PDF_MAX_BYTES) setPdfError('The PDF is larger than 5 MB, so it can’t be emailed. Download it and send it yourself.');
      else setPdf({ b64: bytesToBase64(bytes), size: bytes.length });
    }).catch(() => { if (live) setPdfError('The PDF couldn’t be created, so nothing can be sent. Try again, or download it and send it yourself.'); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const blank = !subject.trim() || !message.trim();
  const send = async () => {
    if (!pdf || blank || sending) return;
    setSending(true); setFailure(null);
    const r = await onSend({ subject: subject.trim(), message, pdfBase64: pdf.b64 });
    // On success the parent closes the dialog; only a failure keeps it open for a retry.
    if ('error' in r) { setSending(false); setFailure({ error: r.error, sent: r.sent }); }
  };
  const file = attachmentName(info.kind, info.number);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto" aria-describedby={ids.note}
        onEscapeKeyDown={(e) => { if (sending) e.preventDefault(); }} onInteractOutside={(e) => { if (sending) e.preventDefault(); }}>
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{again ? 'Email again' : 'Email to customer'}: {noun} {info.number}</DialogTitle>
          <DialogDescription id={ids.note}>
            This email is sent from {sender || 'the B2BNEST sending address'} on your behalf. Replies go to {ownerEmail || 'your account email'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {again && (
            <p className="flex gap-2 rounded-control border border-warning/40 bg-warning/10 p-3 text-small text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              This {noun} was already sent. Your customer will receive it again.
            </p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor={ids.to}>To</Label>
              <Button type="button" variant="link" className="h-auto min-h-touch p-0 md:min-h-0" onClick={onEditCustomer} disabled={sending}>Edit customer</Button>
            </div>
            <Input id={ids.to} value={info.clientEmail} readOnly aria-readonly="true" className="h-11 bg-muted md:h-10" />
            <p className="text-small text-muted-foreground">The address saved on this {noun}. To change it, edit the customer.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.subject}>Subject</Label>
            <Input id={ids.subject} value={subject} maxLength={SUBJECT_MAX} onChange={(e) => setSubject(e.target.value.replace(/[\r\n]+/g, ' '))} disabled={sending} className="h-11 md:h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.message}>Message</Label>
            <Textarea id={ids.message} value={message} maxLength={MESSAGE_MAX} rows={7} onChange={(e) => setMessage(e.target.value)} disabled={sending} aria-describedby={ids.count} />
            <p id={ids.count} className="text-small text-muted-foreground">Plain text. {message.length.toLocaleString('en-GB')} / {MESSAGE_MAX.toLocaleString('en-GB')} characters.</p>
          </div>
          <p className="flex items-center gap-2 text-small text-foreground">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Attachment: <strong>{file}</strong>{' '}
              <span className="text-muted-foreground">{pdf ? `(${formatBytes(pdf.size)})` : pdfError ? '' : '(preparing…)'}</span></span>
          </p>
          {pdfError && <p role="alert" className="text-small text-destructive">{pdfError}</p>}
          {blank && <p className="text-small text-muted-foreground">Add a subject and a message to send.</p>}
          {failure && (
            <div role="alert" className="space-y-2 rounded-control border border-destructive/40 bg-destructive/10 p-3 text-small text-foreground">
              <p className="font-semibold text-destructive">{failure.sent === 'unknown' ? 'Not sure the email was sent' : 'The email wasn’t sent'}</p>
              <p>{failure.error}</p>
              <p className="text-muted-foreground">The {noun} is unchanged.</p>
              <Button type="button" variant="outline" size="sm" className="min-h-touch md:min-h-0" onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />Download PDF and send it yourself
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="min-h-touch md:min-h-10" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button type="button" className="min-h-touch md:min-h-10" onClick={() => { void send(); }} disabled={!pdf || blank || sending} aria-busy={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
            {sending ? 'Sending…' : 'Send email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
