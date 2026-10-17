import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useUserSettings', () => ({ useUserSettings: () => ({ settings: { currency_code: 'GBP' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) } }));

import DealsView from './DealsView';

const base = { contact_id: null, probability: null, close_date: null, user_id: 'u1', notes: null, created_at: '', updated_at: '', currency: 'GBP' };
const deals = [
  { ...base, id: 'a', title: 'Website build', stage: 'proposal', value: 5000, probability: 60, contact_id: 'c1' },
  { ...base, id: 'b', title: 'Audit', stage: 'lead', value: 1200 },
  { ...base, id: 'c', title: 'Old deal', stage: 'closed won', value: 800, currency: 'USD' },
  { ...base, id: 'd', title: 'Mystery', stage: null, value: null },
];
const contacts = [{ id: 'c1', name: 'Priya Shah', company: 'Acme' }];

const ui = (onUpdateDeal = vi.fn(async () => ({}))) => (
  <MemoryRouter><DealsView deals={deals} contacts={contacts} onRefresh={() => {}} onAddDeal={vi.fn()} onUpdateDeal={onUpdateDeal} /></MemoryRouter>
);
const openBoard = () => fireEvent.click(screen.getByRole('button', { name: 'Board' }));
const column = (name: string) => screen.getByRole('region', { name });
// Radix dropdowns open on pointerdown/keyboard in jsdom.
const openMenu = (el: HTMLElement) => { fireEvent.pointerDown(el, { button: 0, pointerType: 'mouse' }); };

beforeEach(() => { localStorage.clear(); toast.mockClear(); });

describe('DealsView board', () => {
  it('Table is the default; the switch is a labelled group with aria-pressed and the choice is remembered per user', () => {
    const { unmount } = render(ui());
    const group = screen.getByRole('group', { name: 'Deals layout' });
    expect(within(group).getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
    openBoard();
    expect(within(group).getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('b2bnest.crm.dealsView.u1')).toBe('board');
    unmount();
    render(ui());
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows columns from the loaded stages in order, with counts, per-currency totals and card details', () => {
    render(ui());
    openBoard();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Lead', 'Proposal', 'Closed won', 'No stage']);
    const proposal = within(column('Proposal'));
    expect(proposal.getByLabelText('1 deal')).toBeInTheDocument();
    expect(proposal.getAllByText('£5,000').length).toBeGreaterThan(0);
    expect(proposal.getByText('Priya Shah · Acme')).toBeInTheDocument();
    expect(proposal.getByText('60% likely')).toBeInTheDocument();
    expect(within(column('Closed won')).getAllByText('US$800').length).toBeGreaterThan(0);
    // Missing values are left out, not guessed.
    expect(within(column('No stage')).queryByText(/likely|Closes/)).toBeNull();
    // Open pipeline excludes the won deal and never mixes currencies.
    const summary = within(screen.getByLabelText('Pipeline summary'));
    expect(summary.getByText('£6,200')).toBeInTheDocument();
  });

  it('moves a deal with the existing update handler, sending only the stage', async () => {
    const onUpdateDeal = vi.fn(async () => ({ id: 'b' }));
    render(ui(onUpdateDeal));
    openBoard();
    openMenu(screen.getByRole('button', { name: 'Actions for Audit' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Proposal' }));
    await waitFor(() => expect(onUpdateDeal).toHaveBeenCalledWith('b', { stage: 'proposal' }, { quiet: true }));
    expect(within(column('Proposal')).getByText('Audit')).toBeInTheDocument();
    // The emptied column stays, with a message and an Add deal button.
    expect(within(column('Lead')).getByText('No deals in this stage.')).toBeInTheDocument();
    expect(within(column('Lead')).getByRole('button', { name: 'Add deal' })).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it('puts the card back and shows an error when the save fails', async () => {
    let finish: (v: unknown) => void = () => {};
    const onUpdateDeal = vi.fn(() => new Promise((r) => { finish = r; }));
    render(ui(onUpdateDeal));
    openBoard();
    openMenu(screen.getByRole('button', { name: 'Actions for Audit' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Proposal' }));
    // Updated on screen straight away…
    await waitFor(() => expect(within(column('Proposal')).getByText('Audit')).toBeInTheDocument());
    // …and back where it was when the save fails.
    await act(async () => { finish(undefined); });
    expect(within(column('Lead')).getByText('Audit')).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't move the deal", variant: 'destructive' }));
  });

  it('"No stage" is never offered as a move target', async () => {
    render(ui());
    openBoard();
    openMenu(screen.getByRole('button', { name: 'Actions for Audit' }));
    await screen.findByRole('menuitem', { name: 'Proposal' });
    expect(screen.queryByRole('menuitem', { name: 'No stage' })).toBeNull();
  });

  it('an empty pipeline shows a message and Add deal', () => {
    render(<MemoryRouter><DealsView deals={[]} onRefresh={() => {}} onAddDeal={vi.fn()} /></MemoryRouter>);
    openBoard();
    expect(screen.getByText('Your pipeline is empty.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add deal' }).length).toBeGreaterThan(0);
  });

  it('summary: open pipeline and weighted forecast per currency, and a link to deals with no probability', async () => {
    render(ui());
    const summary = within(screen.getByLabelText('Pipeline summary'));
    // Open (not won): proposal £5,000 + lead £1,200 + no-stage (no value) → £6,200; won USD deal excluded.
    expect(summary.getByText('£6,200')).toBeInTheDocument();
    // Weighted: only "Website build" has a probability (60% of £5,000).
    expect(summary.getByText('£3,000')).toBeInTheDocument();
    expect(screen.getByText(/2 open deals have no probability yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show them' }));
    const table = await screen.findByRole('table', { name: 'Your deals' });
    expect(within(table).queryByText('Website build')).toBeNull();
    expect(within(table).getByText('Audit')).toBeInTheDocument();
    expect(within(table).getByText('Mystery')).toBeInTheDocument();
  });

  it('table shows each deal in its own stored currency, never the account currency', () => {
    render(ui());
    const table = screen.getByRole('table', { name: 'Your deals' });
    expect(within(table).getByText('US$800')).toBeInTheDocument();
    expect(within(table).getByText('£5,000')).toBeInTheDocument();
  });

  it('add deal: currency defaults to the account currency; blank probability is sent as null; 0 stays 0', async () => {
    const onAddDeal = vi.fn(async () => ({ id: 'n' }));
    render(<MemoryRouter><DealsView deals={deals} onRefresh={() => {}} onAddDeal={onAddDeal} /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add deal' })[0]);
    expect(screen.getByLabelText('Probability (%)')).toHaveValue(null);
    expect(screen.getByText('Optional. Leave blank if you have not estimated it.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Deal title *'), { target: { value: 'New deal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Deal' }));
    await waitFor(() => expect(onAddDeal).toHaveBeenCalledWith(expect.objectContaining({ title: 'New deal', currency: 'GBP', probability: null })));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add deal' })[0]);
    fireEvent.change(screen.getByLabelText('Deal title *'), { target: { value: 'Zero' } });
    fireEvent.change(screen.getByLabelText('Probability (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Deal' }));
    await waitFor(() => expect(onAddDeal).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Zero', probability: 0 })));
  });

  it('edit deal opens with the stored currency and saves through the update handler', async () => {
    const onUpdateDeal = vi.fn(async () => ({ id: 'c' }));
    render(ui(onUpdateDeal));
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit Old deal' })[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Edit deal');
    expect(screen.getByLabelText('Currency')).toHaveTextContent('USD');
    fireEvent.click(screen.getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(onUpdateDeal).toHaveBeenCalledWith('c', expect.objectContaining({ currency: 'USD', probability: null, title: 'Old deal' })));
  });
});
