import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The tab panels are not under test here: each is a stub.
const { stub, hmrc } = vi.hoisted(() => ({ stub: (name: string) => ({ default: () => <div data-testid={`panel-${name}`}>{name}</div> }), hmrc: { canUse: true } }));
// HMRC hide switch: visible by default here; the last test hides it.
vi.mock('@/lib/hmrcAccess', async (orig) => ({ ...(await orig<object>()), useHmrcCustomerAccess: () => ({ loading: false, state: hmrc.canUse ? 'visible' : 'hidden', tester: false, canUse: hmrc.canUse }) }));
vi.mock('@/components/AccountSettings', () => stub('account'));
vi.mock('@/components/NotificationPreferences', () => stub('notifications'));
vi.mock('@/components/InAppNotificationPreferences', () => stub('in-app'));
vi.mock('@/components/MarketingConsent', () => ({ MarketingConsentSwitch: () => <div /> }));
vi.mock('@/components/hmrc/HMRCSettings', () => stub('hmrc'));
vi.mock('@/components/settings/AccountSecurity', () => stub('security'));
vi.mock('@/components/settings/CompanyMembers', () => stub('members'));
vi.mock('@/components/settings/InviteMembers', () => stub('invite'));
vi.mock('@/components/settings/CompanySecurity', () => stub('company-security'));
vi.mock('@/components/billing/BillingSettings', () => stub('billing'));
vi.mock('@/components/settings/YourData', () => stub('your-data'));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: false, loading: false }) }));
vi.mock('@/components/demo/DemoBanner', () => ({ DemoReadonlyNote: () => <div /> }));

import Settings from './Settings';

const TABS = ['Account', 'Security', 'Billing', 'Notifications', 'HMRC', 'Members & roles', 'Company security', 'Company data', 'Your data'];
const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><Settings /></MemoryRouter>);

describe('Settings tabs', () => {
  it('every tab is shown; the list wraps instead of hiding tabs behind a horizontal scrollbar', () => {
    at('/settings');
    const list = screen.getByTestId('settings-tabs');
    expect(list.className).not.toMatch(/overflow-x-auto|w-max|inline-flex/);
    expect(list.className).toMatch(/flex-wrap/);
    expect(list.parentElement?.className ?? '').not.toMatch(/overflow-x-auto/);
    expect(within(list).getAllByRole('tab').map((t) => t.textContent)).toEqual(TABS);
  });

  it('?tab=data opens "Your data"; no tab opens Account', () => {
    const { unmount } = at('/settings?tab=data');
    expect(screen.getByRole('tab', { name: 'Your data' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('panel-your-data')).toBeInTheDocument();
    unmount();
    at('/settings');
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
  });

  it('HMRC hidden from this person: no HMRC tab, and ?tab=hmrc opens Account', () => {
    hmrc.canUse = false;
    try {
      at('/settings?tab=hmrc');
      const list = screen.getByTestId('settings-tabs');
      expect(within(list).getAllByRole('tab').map((t) => t.textContent)).toEqual(TABS.filter((t) => t !== 'HMRC'));
      expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByTestId('panel-hmrc')).toBeNull();
    } finally { hmrc.canUse = true; }
  });
});
