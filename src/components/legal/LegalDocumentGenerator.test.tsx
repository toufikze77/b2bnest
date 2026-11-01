import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
const exportSpy = vi.hoisted(() => ({ pdf: vi.fn(), docx: vi.fn(), download: vi.fn() }));
vi.mock('@/lib/legalExport', async (orig) => ({
  ...(await orig<object>()),
  buildPdf: (text: string, title: string) => { exportSpy.pdf(text, title); return Promise.resolve(new Blob(['%PDF'])); },
  buildDocx: (text: string, title: string) => { exportSpy.docx(text, title); return Promise.resolve(new Blob(['PK'])); },
  downloadBlob: (blob: Blob, name: string) => exportSpy.download(blob, name),
}));

import ContractGenerator from '@/components/ContractGenerator';
import PrivacyPolicyGenerator from '@/components/PrivacyPolicyGenerator';
import LegalMarkdown from '@/components/legal/LegalMarkdown';
import { AI_DRAFT_BANNER } from '@/lib/legalDocuments';
import { HISTORY_KEY } from '@/lib/legalHistory';
import { aiCreditsMock } from '@/test/aiCreditsMock';

const DOC = `# Service Agreement\n\n1. **Definitions**\n1.1 The Client is Beta Client plc, company number [Company number].\n\n${'Body text. '.repeat(80)}`;
const ok = (over: Record<string, unknown> = {}) => ({ data: { document: DOC, docType: 'service_agreement', jurisdiction: 'england_wales', credits_used: 2, credits_remaining: 46, credits_limit: 50, reset_date: '2026-12-01T00:00:00Z', ...over }, error: null });
const fnError = (status: number, body: Record<string, unknown>) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: () => Promise.resolve(body) } } });

const renderContracts = () => render(<MemoryRouter><ContractGenerator /></MemoryRouter>);
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillServiceAgreement = () => {
  fill(/^Your business name/, 'Acme Ltd');
  fill(/^Client's name/, 'Beta Client plc');
  fill(/^Scope \/ deliverables/, 'Monthly bookkeeping');
};
const generate = () => fireEvent.click(screen.getByRole('button', { name: /Generate with AI/ }));

beforeEach(() => { invoke.mockReset(); toast.mockReset(); Object.values(exportSpy).forEach((f) => f.mockReset()); localStorage.clear(); });

describe('Contract Generator', () => {
  it('grouped types, England and Wales by default, only the fields the type needs', () => {
    renderContracts();
    const type = screen.getByLabelText('Document type') as HTMLSelectElement;
    expect([...type.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Services', 'Employment', 'Commercial', 'Confidentiality and other']);
    expect(within(type).queryByText('Website Privacy Policy')).toBeNull();
    expect((screen.getByLabelText('Jurisdiction') as HTMLSelectElement).value).toBe('england_wales');
    expect(screen.getByLabelText(/^Scope \/ deliverables/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Job title/)).toBeNull();
    fireEvent.change(type, { target: { value: 'employment_contract' } });
    expect(screen.getByLabelText(/^Job title \(required\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Employer name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Scope/)).toBeNull();
    expect(screen.getByTestId('credits-left')).toHaveTextContent('Uses 2 AI credits · you have 200 left');
  });

  it('missing required fields: says which, calls nothing', () => {
    renderContracts();
    generate();
    expect(screen.getByRole('alert')).toHaveTextContent("Fill in: Your business name, Client's name, Scope / deliverables.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it('button disabled while running with a progress message, then the result, banner, credits and history', async () => {
    let resolve!: (v: unknown) => void;
    invoke.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderContracts();
    fillServiceAgreement();
    fireEvent.change(screen.getByLabelText('Jurisdiction'), { target: { value: 'scotland' } });
    generate();
    const button = screen.getByRole('button', { name: /Drafting/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Drafting your document');
    fireEvent.click(button);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('generate-legal-document', { body: {
      kind: 'contract', docType: 'service_agreement', jurisdiction: 'scotland',
      fields: { business_name: 'Acme Ltd', other_party_name: 'Beta Client plc', scope: 'Monthly bookkeeping' },
    } });
    await act(async () => { resolve(ok()); });
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeEnabled();
    expect(screen.getByRole('note')).toHaveTextContent(AI_DRAFT_BANNER);
    // Phase 30c: the shared balance takes the credits_remaining in the reply at once.
    expect(screen.getByTestId('credits-left')).toHaveTextContent('Uses 2 AI credits · you have 46 left');
    expect(aiCreditsMock.updates.at(-1)).toMatchObject({ credits_remaining: 46, credits_limit: 50 });
    expect(screen.getByText('[Company number]').tagName).toBe('MARK');
    expect(screen.getByText(/Saved in this browser only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Service Agreement' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toHaveLength(1);
  });

  it.each([
    ['402 insufficient credits shows the reset date', fnError(402, { error: 'insufficient_credits', reset_date: '2026-12-01T00:00:00Z' }), /reset on 1 December 2026/, 'Compare plans'],
    ['trial ended links to Pricing', fnError(402, { error: 'trial_ended', message: 'Your 14-day trial has ended. Choose a plan on the Pricing page to keep using this feature.' }), /trial has ended/, 'See plans on the Pricing page'],
    ['AI failed says no credit was used', fnError(502, { error: 'ai_failed', credit_refunded: true }), /no credit was used/, null],
    ['refund failed says contact us', fnError(502, { error: 'ai_failed', credit_refunded: false, message: "The AI service didn't produce the document. We couldn't give the credits back automatically; contact us and we'll put it right." }), /contact us/, null],
    ['suspended', fnError(403, { error: 'account_suspended', message: 'This account has been suspended. Contact us if you think this is a mistake.' }), /suspended/, null],
    ['network error', 'reject' as const, /couldn't draft the document just now/, null],
  ])('%s', async (_name, reply, text, link) => {
    invoke.mockImplementation(() => (reply === 'reject' ? Promise.reject(new Error('offline')) : Promise.resolve(reply)));
    renderContracts();
    fillServiceAgreement();
    generate();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(text);
    expect(alert).not.toHaveTextContent('non-2xx');
    if (link) expect(within(alert).getByRole('link', { name: link })).toHaveAttribute('href', '/pricing');
    else expect(within(alert).queryByRole('link')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('edit then export passes the edited text to every export; history keeps the edit', async () => {
    invoke.mockResolvedValue(ok());
    renderContracts();
    fillServiceAgreement();
    generate();
    await screen.findByRole('note');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editor = screen.getByLabelText(/Edit the document/);
    fireEvent.change(editor, { target: { value: '# Edited\n\nMy own words.' } });
    fireEvent.blur(editor);
    for (const [name, n] of [[/PDF/, 1], [/Word/, 2], [/\.md/, 3]] as const) {
      await waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name }));
      await waitFor(() => expect(exportSpy.download).toHaveBeenCalledTimes(n));
    }
    expect(exportSpy.pdf).toHaveBeenCalledWith('# Edited\n\nMy own words.', 'Service Agreement');
    expect(exportSpy.docx).toHaveBeenCalledWith('# Edited\n\nMy own words.', 'Service Agreement');
    const names = exportSpy.download.mock.calls.map((c) => c[1] as string);
    expect(names.every((n) => /^service_agreement_beta_client_plc_\d{4}-\d{2}-\d{2}\.(pdf|docx|md)$/.test(n))).toBe(true);
    const md = exportSpy.download.mock.calls.find((c) => (c[1] as string).endsWith('.md'))![0] as Blob;
    expect(md.size).toBe('# Edited\n\nMy own words.'.length);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('My own words.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)[0].document).toBe('# Edited\n\nMy own words.');
  });

  it('opens and deletes from history', async () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([{ id: 'h1', kind: 'contract', docType: 'nda_mutual', label: 'Non-Disclosure Agreement (mutual)', jurisdiction: 'england_wales', otherParty: 'Gamma', document: '# Old NDA\n\nSaved text.', createdAt: '2026-10-01T10:00:00Z' }]));
    renderContracts();
    fireEvent.click(screen.getByRole('button', { name: 'Open Non-Disclosure Agreement (mutual)' }));
    expect(screen.getByText('Saved text.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Non-Disclosure Agreement (mutual)' }));
    expect(screen.queryByText('Saved text.')).toBeNull();
    expect(screen.getByText('No documents yet.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toEqual([]);
  });

  it('still works when localStorage throws', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    invoke.mockResolvedValue(ok());
    renderContracts();
    fillServiceAgreement();
    generate();
    expect(await screen.findByRole('note')).toBeInTheDocument();
    get.mockRestore(); set.mockRestore();
  });
});

describe('credit balance (Phase 30c)', () => {
  it.each([[1], [0]])('Generate is disabled with a clear message when %i credits are left', (left) => {
    aiCreditsMock.state.credits = { remaining: left, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false };
    renderContracts();
    fillServiceAgreement();
    const button = screen.getByRole('button', { name: /Generate with AI/ });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('credits-left')).toHaveTextContent(`Uses 2 AI credits · you have ${left} left`);
    expect(screen.getByRole('status')).toHaveTextContent(`A document needs 2 AI credits and you have ${left} left. They reset 1 December 2026.`);
    fireEvent.click(button);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('exactly 2 credits is enough; the line then drops to 0 from the reply', async () => {
    aiCreditsMock.state.credits = { remaining: 2, limit: 250, resetDate: '2026-12-01T00:00:00Z', tier: 'Business', notStarted: false };
    invoke.mockResolvedValue(ok({ credits_remaining: 0 }));
    renderContracts();
    fillServiceAgreement();
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeEnabled();
    generate();
    await screen.findByRole('note');
    expect(screen.getByTestId('credits-left')).toHaveTextContent('Uses 2 AI credits · you have 0 left');
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeDisabled();
  });

  it('balance unknown (loading or failed): shows the cost only and leaves the check to the server', () => {
    aiCreditsMock.state = { credits: null, loading: false, error: new Error('mfa') };
    renderContracts();
    expect(screen.getByTestId('credits-left')).toHaveTextContent(/^Uses 2 AI credits$/);
    expect(screen.getByText(/Couldn't load your credits/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(aiCreditsMock.refetch).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeEnabled();
  });

  it('a failed generation asks for a fresh balance', async () => {
    invoke.mockResolvedValue(fnError(502, { error: 'ai_failed', credit_refunded: true }));
    renderContracts();
    fillServiceAgreement();
    generate();
    await screen.findByRole('alert');
    expect(aiCreditsMock.updates).toEqual([null]);
  });
});

describe('Privacy / Legal Notices Generator', () => {
  it('only the legal notices, with the data checkboxes, sent as ids', async () => {
    invoke.mockResolvedValue(ok({ docType: 'website_privacy_policy' }));
    render(<MemoryRouter><PrivacyPolicyGenerator /></MemoryRouter>);
    const type = screen.getByLabelText('Document type') as HTMLSelectElement;
    expect(type.querySelectorAll('option')).toHaveLength(7);
    fill(/^Your business name/, 'Acme Ltd');
    fill(/^Website address/, 'acme.co.uk');
    fill(/^Contact email/, 'privacy@acme.co.uk');
    fireEvent.click(screen.getByLabelText('Cookies'));
    fireEvent.click(screen.getByLabelText('Transfers outside the UK'));
    generate();
    await screen.findByRole('note');
    expect(invoke.mock.calls[0][1].body).toEqual({
      kind: 'legal_notice', docType: 'website_privacy_policy', jurisdiction: 'england_wales',
      fields: { business_name: 'Acme Ltd', website: 'acme.co.uk', contact_email: 'privacy@acme.co.uk', data_collected: 'cookies,international_transfers' },
    });
    fireEvent.change(type, { target: { value: 'website_terms_of_use' } });
    expect(screen.queryByText('Cookies')).toBeNull();
  });
});

describe('Privacy / Legal Notices Generator credits', () => {
  it('Generate disabled below 2 credits', () => {
    aiCreditsMock.state.credits = { remaining: 1, limit: 10, resetDate: null, tier: 'free', notStarted: false };
    render(<MemoryRouter><PrivacyPolicyGenerator /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('A document needs 2 AI credits and you have 1 left.');
  });
});

describe('LegalMarkdown renderer', () => {
  it('shows HTML in the text as text, never as elements', () => {
    const { container } = render(<LegalMarkdown markdown={'# Title <script>alert(1)</script>\n\nHello <img src=x onerror="alert(2)"> **bold** [Fee]'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<img src=x onerror="alert(2)">');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('mark[data-placeholder]')?.textContent).toBe('[Fee]');
  });
});
