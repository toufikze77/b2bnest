import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeSteps } from '@/lib/workflowSteps';

// Mocked server only — nothing is sent.
const invoke = vi.fn();
const saved = [{
  id: 'w1', name: 'Email me', description: null, updated_at: '2026-10-04T00:00:00Z',
  workflow_steps: serializeSteps([{ id: 's1', kind: 'email', config: { to: 'me@example.com', subject: 'Hi', body: 'Hello' } }]),
}];
const chain: any = { select: () => chain, eq: () => chain, order: () => Promise.resolve({ data: saved, error: null }) };
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => chain, functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WorkflowStudio from './WorkflowStudio';

const httpError = (status: number, body: unknown) => Object.assign(new Error(`Edge function returned ${status}`), {
  name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }),
});

async function openAndRun() {
  render(<MemoryRouter><WorkflowStudio /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Email me/ }));
  const run = screen.getByRole('button', { name: /Run now/ });
  await waitFor(() => expect(run).toBeEnabled());
  fireEvent.click(run);
  return run;
}

beforeEach(() => { invoke.mockReset(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

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
});
