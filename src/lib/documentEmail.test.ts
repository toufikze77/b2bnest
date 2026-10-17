import { describe, expect, it, vi } from 'vitest';
import { attachmentName, bytesToBase64, defaultEmailMessage, defaultEmailSubject, documentEmailApi, emailAvailability, formatBytes } from './documentEmail';

describe('emailAvailability', () => {
  const draft = { status: 'draft', client_email: 'accounts@client.example', archived_at: null };
  it('not configured: "not available yet" with an honest reason, whatever the document', () => {
    for (const c of [false, null]) {
      const a = emailAvailability('invoice', draft, c);
      expect(a).toMatchObject({ label: 'Email to customer (not available yet)', enabled: false });
      expect(a.reason).toMatch(/isn’t switched on yet\. Download the PDF and send it yourself/);
    }
  });
  it('disabled with a reason: archived, paid invoice, no email, invalid email', () => {
    expect(emailAvailability('invoice', { ...draft, archived_at: '2026-10-16T00:00:00Z' }, true)).toMatchObject({ enabled: false, reason: 'Archived invoices can’t be emailed. Restore it first.' });
    expect(emailAvailability('invoice', { ...draft, status: 'paid' }, true)).toMatchObject({ enabled: false, reason: 'This invoice is paid, so it isn’t emailed.' });
    expect(emailAvailability('quote', { ...draft, client_email: '  ' }, true)).toMatchObject({ enabled: false, reason: 'Add the customer’s email address first (Edit the quote).' });
    for (const bad of ['nope', 'a@b', 'a@b.com, c@d.com', 'Name <a@b.com>', 'a@b.com\nBcc: x@y.com']) {
      expect(emailAvailability('invoice', { ...draft, client_email: bad }, true)).toMatchObject({ enabled: false, reason: 'The customer email address isn’t valid. Edit the invoice to fix it.' });
    }
  });
  it('drafts: Email to customer; already sent (or overdue): Email again with the extra line', () => {
    expect(emailAvailability('invoice', draft, true)).toEqual({ label: 'Email to customer', enabled: true, again: false });
    expect(emailAvailability('invoice', { ...draft, status: null }, true)).toEqual({ label: 'Email to customer', enabled: true, again: false });
    expect(emailAvailability('invoice', { ...draft, status: 'sent' }, true)).toEqual({ label: 'Email again', enabled: true, again: true });
    expect(emailAvailability('quote', { ...draft, status: 'sent' }, true)).toEqual({ label: 'Email again', enabled: true, again: true });
  });
});

describe('default wording (same as the server)', () => {
  const inv = { kind: 'invoice' as const, number: 'INV-1001', clientName: 'Priya Shah', business: 'Acme Trading Ltd', total: 1250, currency: 'GBP', date: '2026-11-01' };
  it('subject and message', () => {
    expect(defaultEmailSubject(inv)).toBe('Invoice INV-1001 from Acme Trading Ltd');
    expect(defaultEmailMessage(inv)).toBe('Hello Priya Shah,\n\nPlease find invoice INV-1001 attached, total 1,250.00 GBP, due 1 Nov 2026.\n\nSent by Acme Trading Ltd using B2BNEST.');
    expect(defaultEmailMessage({ ...inv, kind: 'quote', number: 'Q-501', date: '2026-11-15', clientName: null }))
      .toBe('Hello there,\n\nPlease find quote Q-501 attached, total 1,250.00 GBP, valid until 15 Nov 2026.\n\nSent by Acme Trading Ltd using B2BNEST.');
    expect(defaultEmailSubject({ ...inv, kind: 'quote', number: 'Q-501', business: null })).toBe('Quote Q-501');
    expect(defaultEmailSubject({ ...inv, business: 'Evil\r\nBcc: x@y.com <a>' })).toBe('Invoice INV-1001 from Evil Bcc: x@y.com a');
  });
  it('attachment name and size', () => {
    expect(attachmentName('invoice', 'INV-1001')).toBe('INV-1001.pdf');
    expect(attachmentName('invoice', '../../etc/pass wd\r\n"x')).toBe('etc-pass-wd-x.pdf');
    expect(attachmentName('quote', null)).toBe('quote.pdf');
    expect([formatBytes(900), formatBytes(34_000), formatBytes(2_500_000)]).toEqual(['900 bytes', '33 KB', '2.4 MB']);
    expect(atob(bytesToBase64(new TextEncoder().encode('%PDF-1.4')))).toBe('%PDF-1.4');
  });
});

describe('documentEmailApi', () => {
  const client = (invoke: (name: string, opts?: { method?: string; body?: unknown }) => Promise<{ data: unknown; error: unknown }>) => ({ functions: { invoke: vi.fn(invoke) } });
  it('configured(): a GET to send-document-email; anything but {configured:true} means not available', async () => {
    const c = client(async () => ({ data: { configured: true }, error: null }));
    expect(await documentEmailApi(c).configured()).toBe(true);
    expect(c.functions.invoke).toHaveBeenCalledWith('send-document-email', { method: 'GET' });
    expect(await documentEmailApi(client(async () => ({ data: { configured: false }, error: null }))).configured()).toBe(false);
    expect(await documentEmailApi(client(async () => ({ data: null, error: { message: 'Function not found' } }))).configured()).toBe(false); // not deployed
    expect(await documentEmailApi(client(async () => { throw new Error('offline'); })).configured()).toBe(false);
  });
  it('send(): only kind, id, subject, message and the PDF are sent, never an address', async () => {
    const c = client(async () => ({ data: { success: true, status: 'accepted_by_provider', recipient: 'accounts@client.example' }, error: null }));
    const r = await documentEmailApi(c).send({ kind: 'invoice', id: 'i1', subject: 'S', message: 'M', pdfBase64: 'JVBERg==' });
    expect(r).toEqual({ ok: true, recipient: 'accounts@client.example' });
    const body = c.functions.invoke.mock.calls[0][1]!.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['id', 'kind', 'message', 'pdf_base64', 'subject']);
  });
  it('send(): the server’s plain reason is passed on; unknown outcomes are never shown as success', async () => {
    const httpError = (b: unknown) => ({ data: null, error: { context: { json: async () => b } } });
    let r = await documentEmailApi(client(async () => httpError({ success: false, code: 'provider_auth_rejected', sent: 'not_sent', error: 'Wrong password' }))).send({ kind: 'invoice', id: 'i', subject: 's', message: 'm', pdfBase64: 'x' });
    expect(r).toEqual({ ok: false, error: 'Wrong password', code: 'provider_auth_rejected', sent: 'not_sent' });
    r = await documentEmailApi(client(async () => httpError({ success: false, code: 'uncertain', sent: 'unknown', error: 'Check first' }))).send({ kind: 'invoice', id: 'i', subject: 's', message: 'm', pdfBase64: 'x' });
    expect(r).toMatchObject({ ok: false, sent: 'unknown', error: 'Check first' });
    r = await documentEmailApi(client(async () => ({ data: null, error: { context: { json: async () => { throw new Error('not json'); } } } }))).send({ kind: 'invoice', id: 'i', subject: 's', message: 'm', pdfBase64: 'x' });
    expect(r).toMatchObject({ ok: false, sent: 'not_sent' });
    r = await documentEmailApi(client(async () => ({ data: { success: true }, error: null }))).send({ kind: 'invoice', id: 'i', subject: 's', message: 'm', pdfBase64: 'x' });
    expect(r).toMatchObject({ ok: false, sent: 'unknown' });
    r = await documentEmailApi(client(async () => { throw new Error('offline'); })).send({ kind: 'invoice', id: 'i', subject: 's', message: 'm', pdfBase64: 'x' });
    expect(r).toMatchObject({ ok: false, sent: 'not_sent' });
  });
});
