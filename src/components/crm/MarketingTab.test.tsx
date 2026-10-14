import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const save = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/contexts/OrganizationContext', () => ({ useActiveOrganization: () => ({ organizationId: 'o1', organization: { name: 'Sample Co' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }));
vi.mock('@/services/marketingPlanService', () => ({
  NotEnabledError: class extends Error {},
  listAll: vi.fn(async () => ({ audiences: [], campaigns: [], content: [] })),
  visibleTasks: vi.fn(async () => ({})),
  save: (...a: unknown[]) => save(...a),
  setArchived: vi.fn(), createFollowUpTask: vi.fn(),
}));
import MarketingTab from './MarketingTab';

const contacts = [{ id: 'c1', name: 'Sample Lead', status: 'lead', email: 'a@b.co' }];
const ui = () => render(<MemoryRouter><MarketingTab contacts={contacts} /></MemoryRouter>);

describe('MarketingTab', () => {
  beforeEach(() => save.mockReset());

  it('saves an audience once even when clicked repeatedly', async () => {
    let resolve!: () => void;
    save.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    ui();
    fireEvent.change(screen.getByLabelText('Audience name'), { target: { value: 'UK leads' } });
    const btn = screen.getByRole('button', { name: 'Save audience' });
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe('marketing_audiences');
    resolve();
  });

  it('keeps typed input after a failed save', async () => {
    save.mockRejectedValue(new Error('Network down'));
    ui();
    fireEvent.change(screen.getByLabelText('Audience name'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network down'));
    expect(screen.getByLabelText('Audience name')).toHaveValue('Keep me');
  });

  it('rejects a blank audience name without saving', () => {
    ui();
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Give the audience a name.');
  });
});
