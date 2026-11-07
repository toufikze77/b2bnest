// HMRC P3 fix: business details (the VAT number HMRC calls use) belong to the company selected in Settings → HMRC.
// Supabase is mocked with a tiny in-memory hmrc_settings table that follows the real RLS (own rows only).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; user_id: string; organization_id: string | null; company_name: string; company_number: string; utr: string; vat_number: string; paye_reference: string; updated_at: string };
const st = vi.hoisted(() => ({
  rows: [] as Row[],
  org: { organizationId: 'A', name: 'Dev Team', role: 'owner' } as { organizationId: string; name: string; role: string },
  writes: [] as { op: string; row: Record<string, unknown> }[],
}));
const USER = 'u1';
vi.mock('@/integrations/supabase/client', () => {
  const query = () => {
    const f: { eq: [string, unknown][]; isNull: string[]; op: string; payload?: Record<string, unknown> } = { eq: [], isNull: [], op: 'select' };
    const match = () => st.rows.filter((r) => r.user_id === USER && f.eq.every(([k, v]) => (r as Record<string, unknown>)[k] === v) && f.isNull.every((k) => (r as Record<string, unknown>)[k] === null));
    const q: Record<string, unknown> = {
      select: () => q, order: () => q, limit: () => q,
      eq: (k: string, v: unknown) => { f.eq.push([k, v]); return q; },
      is: (k: string) => { f.isNull.push(k); return q; },
      update: (p: Record<string, unknown>) => { f.op = 'update'; f.payload = p; return q; },
      insert: async (p: Record<string, unknown>) => {
        st.writes.push({ op: 'insert', row: p });
        st.rows.push({ id: `r${st.rows.length + 1}`, updated_at: '2026-11-07', ...(p as Omit<Row, 'id' | 'updated_at'>) });
        return { error: null };
      },
      maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => void) => {
        if (f.op === 'update') { for (const r of match()) Object.assign(r, f.payload); st.writes.push({ op: 'update', row: { ...f.payload, ...Object.fromEntries(f.eq) } }); }
        return Promise.resolve({ data: null, error: null }).then(ok);
      },
    };
    return q;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
      from: () => query(),
      rpc: async () => ({ data: { access: 'ok', can_manage: true, connections: [] }, error: null }),
      functions: { invoke: vi.fn() },
    },
  };
});
vi.mock('@/contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({ organizationId: st.org.organizationId, organization: st.org, memberships: [st.org], loading: false }),
}));

import HMRCSettings from './HMRCSettings';

const row = (organization_id: string | null, vat_number: string, user_id = USER): Row => ({
  id: `${organization_id}-${vat_number}`, user_id, organization_id, company_name: '', company_number: '', utr: '', vat_number, paye_reference: '', updated_at: '2026-11-01',
});
const show = () => render(<HMRCSettings showConnection={false} />, { wrapper: MemoryRouter });
const vat = () => screen.getByLabelText('VAT registration number') as HTMLInputElement;

beforeEach(() => { st.rows = []; st.writes = []; st.org = { organizationId: 'A', name: 'Dev Team', role: 'owner' }; });

describe('Settings → HMRC business details belong to a company', () => {
  it('loads the selected company\'s own row and says which company it saves for', async () => {
    st.rows = [row('A', '111111111'), row('B', '222222222')];
    show();
    await waitFor(() => expect(vat().value).toBe('111111111'));
    expect(screen.getByTestId('hmrc-details-company')).toHaveTextContent('Saving for: Dev Team');
  });

  it('switching company shows that company\'s number, never the other one', async () => {
    st.rows = [row('A', '111111111'), row('B', '222222222')];
    const view = show();
    await waitFor(() => expect(vat().value).toBe('111111111'));
    st.org = { organizationId: 'B', name: 'Shop Ltd', role: 'owner' };
    view.rerender(<HMRCSettings showConnection={false} />);
    await waitFor(() => expect(vat().value).toBe('222222222'));
    expect(screen.getByTestId('hmrc-details-company')).toHaveTextContent('Saving for: Shop Ltd');
    st.org = { organizationId: 'C', name: 'Third Ltd', role: 'owner' };
    view.rerender(<HMRCSettings showConnection={false} />);
    await waitFor(() => expect(screen.getByTestId('hmrc-details-company')).toHaveTextContent('Third Ltd'));
    await waitFor(() => expect(vat()).not.toBeDisabled());
    expect(vat().value).toBe('');
  });

  it('save updates the company\'s own row', async () => {
    st.rows = [row('A', '111111111'), row('B', '222222222')];
    show();
    await waitFor(() => expect(vat().value).toBe('111111111'));
    fireEvent.change(vat(), { target: { value: 'GB 333 3333 33' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save business details' }));
    await waitFor(() => expect(screen.getByTestId('hmrc-details-announce')).toHaveTextContent('Business details saved for Dev Team.'));
    expect(st.rows.find((r) => r.organization_id === 'A')?.vat_number).toBe('GB 333 3333 33');
    expect(st.rows.find((r) => r.organization_id === 'B')?.vat_number).toBe('222222222');
    expect(st.writes).toEqual([{ op: 'update', row: expect.objectContaining({ vat_number: 'GB 333 3333 33', id: 'A-111111111' }) }]);
  });

  it('no row for this company: the first save creates it with the company set', async () => {
    st.rows = [row('B', '222222222')];
    show();
    await waitFor(() => expect(vat()).not.toBeDisabled());
    expect(vat().value).toBe('');
    fireEvent.change(vat(), { target: { value: '444444444' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save business details' }));
    await waitFor(() => expect(st.writes).toHaveLength(1));
    expect(st.writes[0]).toEqual({ op: 'insert', row: expect.objectContaining({ user_id: USER, organization_id: 'A', vat_number: '444444444' }) });
  });

  it('an old row with no company is shown once; saving creates the company\'s own row and leaves the old one', async () => {
    st.rows = [row(null, '999999999')];
    show();
    await waitFor(() => expect(vat().value).toBe('999999999'));
    expect(screen.getByTestId('hmrc-details-unassigned')).toHaveTextContent('Save them to keep them for Dev Team.');
    fireEvent.click(screen.getByRole('button', { name: 'Save business details' }));
    await waitFor(() => expect(st.writes).toHaveLength(1));
    expect(st.writes[0].op).toBe('insert');
    expect(st.writes[0].row).toMatchObject({ organization_id: 'A', vat_number: '999999999' });
    expect(st.rows.filter((r) => r.organization_id === null)).toHaveLength(1);
  });

  it('a member sees the details read-only and cannot save', async () => {
    st.org = { organizationId: 'A', name: 'Dev Team', role: 'member' };
    st.rows = [row('A', '111111111')];
    show();
    await waitFor(() => expect(vat().value).toBe('111111111'));
    expect(vat()).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save business details' })).toBeNull();
    expect(screen.getByTestId('hmrc-details-member')).toHaveTextContent('Only an owner or admin of Dev Team');
  });
});
