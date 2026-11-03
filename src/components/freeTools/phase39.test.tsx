// Phase 39: "use first, sign up to save" on the free Business Tools, with an in-memory stand-in for
// public.free_tool_items (own rows, 50 per tool, the database update missing, or a suspended account).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  user: null as null | { id: string },
  access: { loading: false, trialEnded: false, suspended: false } as Record<string, unknown>,
  rows: [] as { id: string; user_id: string; tool: string; name: string; data: unknown; created_at: string; updated_at: string }[],
  missing: false, calls: 0, seq: 0,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: st.user, loading: false }) }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => st.access }));
vi.mock('recharts', async (orig) => {
  const m = await orig<typeof import('recharts')>();
  return { ...m, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 220 }}>{children}</div> };
});
vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    if (table !== 'free_tool_items') throw new Error(`unexpected table ${table}`);
    st.calls += 1;
    const q: { op: string; payload?: Record<string, unknown>; eq: Record<string, unknown> } = { op: 'select', eq: {} };
    const run = () => {
      if (st.missing) return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.free_tool_items' in the schema cache" } };
      const mine = st.rows.filter((r) => r.user_id === st.user?.id);
      const now = new Date(Date.UTC(2026, 10, 2, 10, st.seq++)).toISOString();
      if (q.op === 'insert') {
        const p = q.payload as { user_id: string; tool: string; name: string; data: unknown };
        if (p.user_id !== st.user?.id) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
        if (mine.filter((r) => r.tool === p.tool).length >= 50) return { data: null, error: { code: 'P0001', message: 'FREE_TOOL_ITEM_LIMIT' } };
        const row = { id: `i${st.seq}`, ...p, created_at: now, updated_at: now };
        st.rows.push(row);
        return { data: row, error: null };
      }
      if (q.op === 'update') {
        const row = mine.find((r) => r.id === q.eq.id);
        if (!row) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        Object.assign(row, q.payload, { updated_at: now });
        return { data: { ...row }, error: null };
      }
      if (q.op === 'delete') { st.rows = st.rows.filter((r) => !(r.user_id === st.user?.id && r.id === q.eq.id)); return { data: null, error: null }; }
      return { data: mine.filter((r) => !q.eq.tool || r.tool === q.eq.tool).sort((a, b) => b.updated_at.localeCompare(a.updated_at)), error: null };
    };
    const chain: Record<string, unknown> = {
      select: () => chain, order: () => chain, limit: () => chain, single: () => chain,
      eq: (k: string, v: unknown) => { q.eq[k] = v; return chain; },
      insert: (p: Record<string, unknown>) => { q.op = 'insert'; q.payload = p; return chain; },
      update: (p: Record<string, unknown>) => { q.op = 'update'; q.payload = p; return chain; },
      delete: () => { q.op = 'delete'; return chain; },
      then: (ok: (v: unknown) => void) => Promise.resolve(run()).then(ok),
    };
    return chain;
  };
  return { supabase: { from } };
});

import ROICalculator from '@/components/ROICalculator';
import GoalTracker from '@/components/GoalTracker';
import CustomerSurveyBuilder from '@/components/CustomerSurveyBuilder';
import CostCalculator from '@/components/CostCalculator';
import ComplianceChecker from '@/components/ComplianceChecker';
import BusinessSetupChecklist from '@/components/BusinessSetupChecklist';
import BestPracticesGuide from '@/components/BestPracticesGuide';
import { SCENARIOS_KEY } from '@/lib/roi';
import { STORAGE_KEY as GOALS_KEY } from '@/lib/goals';
import { LIMIT_MESSAGE } from '@/lib/freeToolItems';

const show = (el: React.ReactElement) => render(el, { wrapper: MemoryRouter });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const signIn = (over: Record<string, unknown> = {}) => { st.user = { id: 'u1' }; st.access = { loading: false, trialEnded: true, suspended: false, ...over }; };
const GOAL = { id: 'g1', title: 'Win 5 clients', description: '', targetDate: '2027-01-31', progress: 20, category: 'Sales', isCompleted: false, createdAt: '2026-10-01T00:00:00Z' };
const addGoal = (title: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add a goal' }));
  type('Goal', title);
  type('Target date', '2027-03-01');
  fireEvent.submit(screen.getByRole('form', { name: 'Add a goal' }));
};

beforeEach(() => {
  st.user = null; st.access = { loading: false, trialEnded: false, suspended: false }; st.rows = []; st.missing = false; st.calls = 0; st.seq = 0;
  localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks();
});

describe('signed in after the trial (the free tier): saved to the account', () => {
  it('ROI: a trial-ended account saves scenarios to its account, sees them compared, and the save is announced', async () => {
    signIn();
    show(<ROICalculator />);
    expect(await screen.findByText(/Saved to your account/)).toBeInTheDocument();
    type('Project name (optional)', 'Van');
    type('Initial investment (£)', '5000');
    type('Expected total return (£)', '6000');
    fireEvent.submit(screen.getByRole('form', { name: 'ROI inputs' }));
    expect(await screen.findByText('Saved "Van" to your account.')).toBeInTheDocument();
    expect(screen.getByTestId('save-announce')).toHaveAttribute('aria-live', 'polite');
    expect(st.rows).toHaveLength(1);
    expect(st.rows[0]).toMatchObject({ user_id: 'u1', tool: 'roi-calculator', name: 'Van' });
    expect(localStorage.getItem(SCENARIOS_KEY)).toBeNull(); // the account, not the browser
    expect(within(screen.getByTestId('roi-compare')).getByText('Van')).toBeInTheDocument();
    expect(screen.queryByTestId('account-prompt')).toBeNull();
  });

  it('loads on any device: what the account holds is shown, not this browser', async () => {
    signIn({ trialEnded: false });
    st.rows.push({ id: 'x', user_id: 'u1', tool: 'goal-tracker', name: 'My goals', data: [GOAL], created_at: '', updated_at: '2026-11-01' });
    st.rows.push({ id: 'y', user_id: 'someone-else', tool: 'goal-tracker', name: 'My goals', data: [{ ...GOAL, id: 'g9', title: 'Not mine' }], created_at: '', updated_at: '2026-11-02' });
    show(<GoalTracker />);
    expect(await screen.findByText('Win 5 clients')).toBeInTheDocument();
    expect(screen.queryByText('Not mine')).toBeNull();
    addGoal('Hire a bookkeeper');
    await waitFor(() => expect((st.rows.find((r) => r.id === 'x')!.data as unknown[]).length).toBe(2));
    expect(st.rows.filter((r) => r.user_id === 'u1')).toHaveLength(1); // one item, updated in place
  });

  it('the 50-item limit says so in words, and the work is kept', async () => {
    signIn();
    for (let i = 0; i < 50; i++) st.rows.push({ id: `r${i}`, user_id: 'u1', tool: 'cost-calculator', name: `R${i}`, data: { structure: '', amounts: {}, included: {} }, created_at: '', updated_at: `2026-10-${10 + (i % 9)}` });
    show(<CostCalculator />);
    await screen.findByText(/Saved to your account/);
    fireEvent.change(screen.getByLabelText('Business structure'), { target: { value: 'limited_company' } });
    fireEvent.click(screen.getByRole('button', { name: /Save this result/ }));
    expect(await screen.findByText(LIMIT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText('Business structure')).toHaveValue('limited_company');
  });

  it('Compliance: "Save this result" saves to the account and lists it with a UK date; delete asks first', async () => {
    signIn();
    show(<ComplianceChecker />);
    await screen.findByText(/Saved to your account/);
    fireEvent.change(screen.getByLabelText('Business structure'), { target: { value: 'sole_trader' } });
    fireEvent.click(screen.getByRole('button', { name: /Save this result/ }));
    const list = await screen.findByTestId('saved-results');
    await waitFor(() => expect(within(list).getByText(/^Compliance check, \d{1,2} [A-Z][a-z]{2} \d{4}/)).toBeInTheDocument());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(list).getByRole('button', { name: /^Delete Compliance check/ }));
    await waitFor(() => expect(st.rows).toHaveLength(0));
  });
});

describe('the one-time move from this browser to the account', () => {
  it('offered once, nothing moved until the button is pressed; the browser copy stays until confirmed', async () => {
    localStorage.setItem(GOALS_KEY, JSON.stringify([GOAL]));
    signIn();
    const { unmount } = show(<GoalTracker />);
    const offer = await screen.findByTestId('move-to-account');
    expect(offer).toHaveTextContent('This browser has goals you saved before signing in.');
    expect(st.rows).toHaveLength(0); // nothing silently moved
    fireEvent.click(within(offer).getByRole('button', { name: 'Move what you saved in this browser to your account' }));
    expect(await within(offer).findByText(/Moved to your account/)).toBeInTheDocument();
    expect(st.rows).toHaveLength(1);
    expect(st.rows[0].data).toEqual([GOAL]);
    expect(JSON.parse(localStorage.getItem(GOALS_KEY)!)).toEqual([GOAL]); // kept until confirmed
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(offer).getByRole('button', { name: 'It worked: remove the browser copy' }));
    expect(JSON.parse(localStorage.getItem(GOALS_KEY)!)).toEqual([]);
    expect(screen.queryByTestId('move-to-account')).toBeNull();
    unmount();
    localStorage.setItem(GOALS_KEY, JSON.stringify([{ ...GOAL, id: 'g2' }]));
    show(<GoalTracker />);
    await screen.findByText('Win 5 clients');
    expect(screen.queryByTestId('move-to-account')).toBeNull(); // one time only
  });

  it('ROI: Phase 38 scenarios in this browser can be moved; "No thanks" moves nothing and is remembered', async () => {
    const form = { name: '', investment: '5000', monthlyCost: '', mode: 'total', totalReturn: '6000', monthlyReturn: '', months: '12', residual: '', discountRate: '' };
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify([{ id: '1', name: 'Van', form, savedAt: '' }]));
    signIn();
    show(<ROICalculator />);
    fireEvent.click(within(await screen.findByTestId('move-to-account')).getByRole('button', { name: 'No thanks' }));
    expect(st.rows).toHaveLength(0);
    expect(screen.queryByTestId('move-to-account')).toBeNull();
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toHaveLength(1);
  });
});

describe('before the database update, and suspended accounts', () => {
  it('before the SQL: the tool works in the browser and says "Saving to your account needs a database update"', async () => {
    st.missing = true;
    signIn();
    show(<ROICalculator />);
    expect(await screen.findByTestId('browser-reason')).toHaveTextContent('Saving to your account needs a database update.');
    type('Initial investment (£)', '5000');
    type('Expected total return (£)', '6000');
    fireEvent.submit(screen.getByRole('form', { name: 'ROI inputs' }));
    expect(JSON.parse(localStorage.getItem(SCENARIOS_KEY)!)).toHaveLength(1); // nothing lost: kept in the browser
  });

  it('suspended: tools open, nothing read from or written to the account, no plan buttons', async () => {
    signIn({ trialEnded: false, suspended: true });
    show(<GoalTracker />);
    expect(screen.getByTestId('browser-reason')).toHaveTextContent("Your account is suspended, so it can't save.");
    addGoal('Still works');
    expect(screen.getByText('Still works')).toBeInTheDocument();
    expect(st.calls).toBe(0);
    expect(screen.queryByRole('link', { name: /plan/i })).toBeNull();
  });
});

describe('signed out: prompts at the moment of value, never a wall', () => {
  it('Goal Tracker: no prompt before use; after the first real edit a dismissible "keep on all your devices" card', () => {
    const { unmount } = show(<GoalTracker />);
    expect(screen.queryByTestId('account-prompt')).toBeNull();
    addGoal('Open a shop');
    const card = screen.getByTestId('account-prompt');
    expect(card).toHaveTextContent('Keep your goals on all your devices');
    expect(within(card).getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/auth?next=%2Fbusiness-tools%3Ftool%3Dgoal-tracker&mode=signup');
    addGoal('Second goal'); // the tool keeps working with the card showing
    expect(screen.getAllByTestId('goal')).toHaveLength(2);
    fireEvent.click(within(card).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('account-prompt')).toBeNull();
    unmount();
    show(<GoalTracker />);
    addGoal('Third');
    expect(screen.queryByTestId('account-prompt')).toBeNull(); // dismissed for this session
    expect(st.calls).toBe(0);
  });

  it('Survey Builder: copy and download need an account (prompt), the survey itself is kept', () => {
    show(<CustomerSurveyBuilder />);
    fireEvent.click(screen.getByRole('button', { name: /New survey/ }));
    fireEvent.change(screen.getByLabelText(/Survey title/i), { target: { value: 'Feedback' } });
    fireEvent.change(within(screen.getAllByTestId('survey-question')[0]).getByLabelText('Question text'), { target: { value: 'How did we do?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save survey' }));
    expect(screen.getByTestId('account-prompt')).toHaveTextContent('Keep your surveys on all your devices'); // after the first real edit
    fireEvent.click(screen.getByRole('button', { name: /Download \(.txt\)/ }));
    expect(screen.getByTestId('account-prompt')).toHaveTextContent('Create a free account to copy and download');
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('Cost Calculator: totals visible; save and CSV prompt; the referral slot sits under the total; work restored after sign-in', () => {
    const { unmount } = show(<CostCalculator />);
    expect(screen.queryByTestId('referral-slot-cost-calculator')).toBeNull(); // nothing until there is a total
    fireEvent.change(screen.getByLabelText('Business structure'), { target: { value: 'limited_company' } });
    expect(screen.getByTestId('cc-totals')).toBeInTheDocument();
    const slot = screen.getByTestId('referral-slot-cost-calculator');
    expect(slot).toHaveTextContent('Need a business account?');
    expect(screen.queryByTestId('finance-assistant-promo')).toBeNull(); // no money result yet
    const first = screen.getAllByPlaceholderText('£ amount')[0];
    fireEvent.change(first, { target: { value: '50' } });
    expect(screen.getByTestId('finance-assistant-promo')).toBeInTheDocument(); // after a money result
    fireEvent.click(screen.getByRole('button', { name: /Save this result/ }));
    expect(screen.getByTestId('account-prompt')).toHaveTextContent('Create a free account to save and download');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(screen.getByTestId('account-prompt')).toBeInTheDocument();
    unmount();
    signIn(); // back from /auth in the same tab
    show(<CostCalculator />);
    expect(screen.getByLabelText('Business structure')).toHaveValue('limited_company');
    expect(screen.getAllByPlaceholderText('£ amount')[0]).toHaveValue('50');
  });

  it('Compliance: the result is visible; "Save this result" prompts; answers restored after sign-in', () => {
    const { unmount } = show(<ComplianceChecker />);
    fireEvent.change(screen.getByLabelText('Business structure'), { target: { value: 'limited_company' } });
    expect(screen.getAllByTestId('cc-item').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Save this result/ }));
    expect(screen.getByTestId('account-prompt')).toHaveTextContent('Create a free account to save this result');
    unmount();
    show(<ComplianceChecker />);
    expect(screen.getByLabelText('Business structure')).toHaveValue('limited_company');
  });

  it('ROI: the Finance Assistant promotion appears only after a money result', () => {
    show(<ROICalculator />);
    expect(screen.queryByTestId('finance-assistant-promo')).toBeNull();
    type('Initial investment (£)', '5000');
    type('Expected total return (£)', '6000');
    expect(screen.getByTestId('finance-assistant-promo')).toHaveTextContent('Open the Business Finance Assistant');
  });

  it('referral slots only where they help: the checklist bank step; none in the other tools', async () => {
    show(<BusinessSetupChecklist />);
    const bank = screen.getAllByTestId('checklist-step').find((li) => /bank account/i.test(li.textContent ?? ''))!;
    expect(within(bank).getByTestId('referral-slot-setup-checklist')).toBeInTheDocument();
    expect(screen.getAllByTestId('referral-slot-setup-checklist')).toHaveLength(1);
    for (const El of [ROICalculator, GoalTracker, CustomerSurveyBuilder, ComplianceChecker, BestPracticesGuide]) {
      const { container, unmount } = show(<El />);
      expect(container.querySelector('[data-testid^="referral-slot"]')).toBeNull();
      expect(container.querySelector('a[rel~="sponsored"]')).toBeNull();
      unmount();
    }
    await act(async () => {});
  });
});
