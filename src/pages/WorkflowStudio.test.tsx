
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeSteps } from '@/lib/workflowSteps';

// Mocked server only — nothing is sent.
const invoke = vi.fn();
const W1 = '0f0f0f0f-0000-4000-8000-000000000001';
let saved: unknown[] = [];
let history: { data: unknown[] | null; error: unknown } = { data: [], error: null };
const inserts: unknown[] = [];
let accessRow: () => { data: unknown; error: unknown } = () => ({ data: null, error: { code: 'XX000', message: 'not read' } });
const query = (result: () => { data: unknown; error: unknown }) => {
  const q: any = {
    select: () => q, eq: () => q, order: () => q, limit: () => Promise.resolve(result()),
    then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad),
    insert: (row: unknown) => { inserts.push(row); return Promise.resolve({ data: null, error: null }); },
  };
  return q;
};
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => (t === 'workflow_run_logs' ? query(() => history) : query(() => ({ data: saved, error: null }))),
    // my_access_state() (Phase 19 plan rule). Default: not readable → editor shown, the server decides.
    rpc: (fn: string) => Promise.resolve(fn === 'my_access_state' ? accessRow() : { data: false, error: null }),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));
const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'owner@example.com', email_confirmed_at: '2026-10-01T10:00:00Z' as string | null } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WorkflowStudio from './WorkflowStudio';
import { clearAccessCache } from '@/hooks/useAccess';
import { toast } from 'sonner';

const wf = (subject = 'Hi', body = 'Hello', to = 'me@example.com') => [{
  id: W1, name: 'Email me', description: null, updated_at: '2026-10-04T00:00:00Z',
  workflow_steps: serializeSteps([{ id: 's1', kind: 'email', config: { to, subject, body } }]),
}];
const httpError = (status: number, body: unknown) => Object.assign(new Error(`Edge function returned ${status}`), {
  name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }),
});

async function openWorkflow() {
  render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Email me/ }));
  const run = screen.getByRole('button', { name: /Run now/ });
  await waitFor(() => expect(run).toBeEnabled());
  return run;
}
async function openAndRun() {
  const run = await openWorkflow();
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole('button', { name: /Send 1 email/ }));
  return run;
}

beforeEach(() => {
  auth.user = { id: 'u1', email: 'owner@example.com', email_confirmed_at: '2026-10-01T10:00:00Z' };
  invoke.mockReset(); inserts.length = 0; clearAccessCache();
  accessRow = () => ({ data: null, error: { code: 'XX000', message: 'not read' } }); saved = wf(); history = { data: [], error: null };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Workflow screen with a failing email step', () => {
  it('keeps the workflow visible, shows the reason inline and re-enables Run after a 502', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502, { success: false, code: 'provider_auth_rejected', sent: 'not_sent', error: "The email provider rejected the sender account's sign-in (534 5.7.9). Nothing was sent." }) });
    const run = await openAndRun();
    expect(await screen.findByRole('status')).toHaveTextContent('rejected the sender account');
    expect(screen.getByLabelText('Workflow name')).toHaveValue('Email me');
    expect(screen.getByDisplayValue('me@example.com')).toBeInTheDocument();
    await waitFor(() => expect(run).toBeEnabled());
    expect(screen.queryByText(/Accepted by the email provider/)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1); // no automatic retry
  });

  it('shows "Delivery status unknown" when the server gives no readable answer', async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error('Failed to send a request'), { name: 'FunctionsFetchError' }) });
    const run = await openAndRun();
    expect(await screen.findByRole('status')).toHaveTextContent('Delivery status unknown. Check your inbox before trying again.');
    await waitFor(() => expect(run).toBeEnabled());
  });

  it('shows "Delivery status unknown" after a server timeout (504)', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(504, { success: false, code: 'timeout', sent: 'unknown', error: 'Delivery status unknown. Check your inbox before trying again.' }) });
    await openAndRun();
    expect(await screen.findByRole('status')).toHaveTextContent('Delivery status unknown');
  });

  it('rate limit: shows the friendly message, not a code', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(429, { success: false, code: 'rate_limited', sent: 'not_sent', error: "You've sent a lot of emails in the last minute. Nothing was sent. Wait a minute, then try again." }) });
    await openAndRun();
    expect(await screen.findByRole('status')).toHaveTextContent('Wait a minute, then try again.');
  });
});

describe('Run: confirm, details and preview (Phase 15)', () => {
  it('"Run now" sends nothing until the user confirms "This will send 1 email to 1 recipient."', async () => {
    const run = await openWorkflow();
    fireEvent.click(run);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('run-summary')).toHaveTextContent('This will send 1 email to 1 recipient.');
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(invoke).not.toHaveBeenCalled();
  });

  it('asks only for the placeholders used, previews exactly what will be sent, and sends the filled-in email', async () => {
    saved = wf('Invoice {{invoice_number}}', 'Hi {{name}}, {{name}} again.', 'a@example.com, b@example.com');
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    fireEvent.click(await openWorkflow());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Run with these details')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Customer's name/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Invoice number/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Due date/)).toBeNull();
    expect(within(dialog).getByTestId('run-summary')).toHaveTextContent('This will send 1 email to 2 recipients.');
    // Missing values: a clear error, and Send stays disabled (the literal {{name}} is never sent).
    const send = within(dialog).getByRole('button', { name: /Send 1 email/ });
    expect(send).toBeDisabled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent("Customer's name ({{name}}) needs a value.");
    fireEvent.change(within(dialog).getByLabelText(/Customer's name/), { target: { value: 'Sam' } });
    fireEvent.change(within(dialog).getByLabelText(/Invoice number/), { target: { value: 'INV-9' } });
    const preview = within(dialog).getByTestId('email-preview');
    expect(preview).toHaveTextContent('Invoice INV-9');
    expect(preview).toHaveTextContent('Hi Sam, Sam again.');
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [fn, { body }] = invoke.mock.calls[0];
    expect(fn).toBe('workflow-send-email');
    expect(body).toMatchObject({
      to: 'a@example.com, b@example.com', subject: 'Invoice INV-9', body: 'Hi Sam, Sam again.',
      template: { subject: 'Invoice {{invoice_number}}', body: 'Hi {{name}}, {{name}} again.' }, values: { invoice_number: 'INV-9', name: 'Sam' },
      workflowId: W1, stepIndex: 0,
    });
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // (A text box can't hold a line break; that case is tested in _shared/placeholders_test.ts and on the server.)
  it('a value that is itself a placeholder is refused in the preview, never expanded', async () => {
    saved = wf('Hello {{name}}', 'Body');
    fireEvent.click(await openWorkflow());
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Customer's name/), { target: { value: '{{company}}' } });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('can\'t contain "{{" or "}}"');
    expect(within(dialog).getByRole('button', { name: /Send 1 email/ })).toBeDisabled();
  });
});

describe('guide link (Phase 17)', () => {
  // Phase 18: replies go to the sender's own verified account email, and the preview says so before anything is sent.
  it('the preview and confirm show "Replies go to" the signed-in sender\'s own email, never another address', async () => {
    saved = wf('Hi', 'Hello', 'customer@client.example');
    invoke.mockResolvedValue({ data: { success: true, status: 'accepted', replyTo: 'owner@example.com' }, error: null });
    fireEvent.click(await openWorkflow());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('reply-to')).toHaveTextContent('Replies go to owner@example.com.');
    expect(within(dialog).getByTestId('run-reply-to')).toHaveTextContent('Replies go to owner@example.com.');
    expect(within(dialog).queryByText(/Replies go to customer@client\.example/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /Send 1 email/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    // The browser never sends a reply address: the server takes it from the signed-in account.
    const body = invoke.mock.calls[0][1].body as Record<string, unknown>;
    expect(Object.keys(body).some((k) => /reply/i.test(k))).toBe(false);
    expect(await screen.findByText(/Replies go to owner@example\.com\./)).toBeInTheDocument();
  });

  it('an unverified account email is not shown as the reply address; the preview says replies go to B2BNEST', async () => {
    auth.user = { id: 'u1', email: 'owner@example.com', email_confirmed_at: null };
    fireEvent.click(await openWorkflow());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('reply-to')).toHaveTextContent("Your account email address isn't verified, so replies will go to B2BNEST's sending address.");
    expect(within(dialog).queryByText(/Replies go to owner@example\.com/)).toBeNull();
  });

  it('"How workflows work" links to the guide', async () => {
    render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'How workflows work' })).toHaveAttribute('href', '/knowledge-base/workflows');
  });
});

describe('Run history panel (Phase 15)', () => {
  it('empty state', async () => {
    await openWorkflow();
    expect(await screen.findByText(/No runs yet/)).toBeInTheDocument();
  });

  it('error state with retry', async () => {
    history = { data: null, error: { message: 'boom' } };
    await openWorkflow();
    expect(await screen.findByText(/Couldn't load the run history/)).toBeInTheDocument();
  });

  it('shows each step plainly: Sent / Failed with the reason / Delivery status unknown / Skipped; no addresses', async () => {
    const at = '2026-10-28T14:05:00Z';
    history = { data: [
      { id: 'r3', created_at: at, user_id: 'u1', workflow_id: W1, run_id: 'run-1', step_index: 3, step: 'x.post', status: 'skipped', provider: 'none' },
      { id: 'r2', created_at: at, user_id: 'u1', workflow_id: W1, run_id: 'run-1', step_index: 2, step: 'email.send', status: 'unknown', provider: 'smtp', response_summary: { code: 'timeout' } },
      { id: 'r1', created_at: at, user_id: 'u1', workflow_id: W1, run_id: 'run-1', step_index: 1, step: 'email.send', status: 'error', provider: 'smtp', request_summary: { recipients: 1 }, response_summary: { code: 'provider_rejected', message: 'The email provider refused the message (550 5.1.1). Nothing was sent.' } },
      { id: 'r0', created_at: at, user_id: 'u1', workflow_id: W1, run_id: 'run-1', step_index: 0, step: 'email.send', status: 'ok', provider: 'smtp', request_summary: { recipients: 2 } },
    ], error: null };
    await openWorkflow();
    const list = await screen.findByRole('list', { name: 'Run history' });
    const items = within(list).getAllByRole('listitem').filter((li) => li.textContent?.startsWith('Step'));
    expect(items.map((li) => li.textContent)).toEqual([
      "Step 1 · Send an email · 2 recipients: SentAccepted by the email provider. Inbox delivery isn't confirmed.",
      'Step 2 · Send an email · 1 recipient: FailedThe email provider refused the message (550 5.1.1). Nothing was sent.',
      'Step 3 · Send an email: Delivery status unknownDelivery status unknown. Check your inbox before trying again.',
      "Step 4 · Post on X (Twitter): Skipped (step not available)This step hasn't been verified yet, so it was not run.",
    ]);
    expect(within(list).getByText('Run by you')).toBeInTheDocument();
    expect(list.textContent).not.toMatch(/@/);
  });
});

describe('Templates (Phase 15)', () => {
  it('previews a template before use, then loads its email step with the user\'s own address in To', async () => {
    render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Start from a template/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/· Coming soon/).length).toBeGreaterThan(10);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview Overdue invoice reminder' }));
    expect(within(dialog).getByTestId('template-preview')).toHaveTextContent('Invoice {{invoice_number}} is overdue');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this template' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByLabelText('Workflow name')).toHaveValue('Overdue invoice reminder');
    expect(screen.getByDisplayValue('owner@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Invoice {{invoice_number}} is overdue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run now/ })).toBeEnabled();
  });

  it('"Coming soon" templates have no button to use or run them', async () => {
    render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Start from a template/ }));
    const soon = await screen.findByRole('list', { name: 'Templates coming soon' });
    expect(within(soon).queryAllByRole('button')).toEqual([]);
  });
});

describe('Workflow Studio by plan (Phase 19)', () => {
  const plan = (state: string, plan_key: string | null, via = 'self') => () =>
    ({ data: [{ state, plan_key, via, trial_ends_at: null, days_left: 0, subscription_status: plan_key ? 'active' : null }], error: null });

  it('Solo: the upgrade panel instead of the editor; saved workflows are paused and past runs stay readable; no error toast', async () => {
    accessRow = plan('subscribed', 'starter');
    vi.mocked(toast.error).mockClear();
    history = { data: [{ id: 'h1', created_at: '2026-10-20T10:00:00Z', user_id: 'u1', workflow_id: W1, run_id: 'r1', step_index: 0, step: 'email.send', status: 'ok', provider: 'smtp', request_summary: { recipients: 1 } }], error: null };
    render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
    const panel = await screen.findByTestId('workflows-upgrade');
    expect(panel).toHaveTextContent('Workflows are included in the Business and Scale plans.');
    expect(within(panel).getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
    expect(panel).toHaveTextContent('paused, not deleted');
    expect(screen.queryByRole('button', { name: /New workflow/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Start from a template/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Email me/ }));
    expect(screen.getByRole('button', { name: /Email me/ })).toHaveTextContent('Paused');
    const card = await screen.findByTestId('paused-workflow');
    expect(card).toHaveTextContent('Send an email: Hi');
    expect(within(card).queryByRole('button', { name: /Run now|Save|Delete/ })).toBeNull();
    expect(await within(card).findByText('Sent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run now/ })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('a company member on a Solo company plan sees the company wording', async () => {
    accessRow = plan('subscribed', 'starter', 'company');
    render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
    expect(await screen.findByTestId('workflows-upgrade')).toHaveTextContent("Your company's plan doesn't include them.");
  });

  it.each([['subscribed', 'professional'], ['subscribed', 'enterprise'], ['trial', null], ['owner', null]])('%s %s: the editor, no upgrade panel', async (state, key) => {
    accessRow = plan(state, key);
    await openWorkflow();
    expect(screen.getByRole('button', { name: /New workflow/ })).toBeInTheDocument();
    expect(screen.queryByTestId('workflows-upgrade')).toBeNull();
  });
});
