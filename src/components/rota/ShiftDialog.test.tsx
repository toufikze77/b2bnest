import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert: async () => ({ error: null }) }) } }));
vi.mock('@/lib/activeOrganization', () => ({ assertActiveOrganization: async (id: string) => ({ organizationId: id }) }));

import ShiftDialog from './ShiftDialog';
import { shiftOnHolidayWarning } from '@/lib/rotaLeave';

const open = (holidayWarning: string | null) => render(
  <ShiftDialog open onOpenChange={vi.fn()} organizationId="o1" employeeId="e1" shiftDate="2030-03-04" shift={null} holidayWarning={holidayWarning} onSaved={vi.fn()} />,
);

describe('a shift on approved holiday (Phase 32)', () => {
  it('warns and needs a confirmation before saving (not blocked)', () => {
    open(shiftOnHolidayWarning('Sam Staff', 'Holiday (morning)'));
    expect(screen.getByTestId('shift-holiday-warning')).toHaveTextContent('Sam Staff has approved holiday (morning) on this day. You can still plan the shift if you need to.');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Plan this shift anyway' }));
    expect(save).toBeEnabled();
  });
  it('no holiday: no warning, Save enabled', () => {
    open(null);
    expect(screen.queryByTestId('shift-holiday-warning')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
