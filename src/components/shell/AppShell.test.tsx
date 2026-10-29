import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' }, signOut: vi.fn() }) }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@/hooks/useUserAvatar', () => ({ useUserAvatar: () => ({ avatarUrl: '', displayName: 'Sam Taylor', email: 'sam@example.com' }) }));
vi.mock('@/components/OrganizationSwitcher', () => ({ default: () => null }));
vi.mock('@/components/ProfileEditDialog', () => ({ default: () => null }));
vi.mock('@/components/SupportFeedbackDialog', () => ({ default: () => null }));
vi.mock('@/components/access/TrialBanner', () => ({ default: () => null }));
vi.mock('./GlobalCommand', () => ({ GlobalCommand: () => null }));
vi.mock('./NotificationsPanel', () => ({ NotificationsPanel: () => null }));
// Phase 19: the account's access (plan) decides whether "Workflows" is marked "Business" in the menu.
const accessMock = vi.hoisted(() => ({ value: { loading: false, state: 'trial', planKey: null as string | null, via: 'self' } }));
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => accessMock.value }));

import { AppShell } from './AppShell';

const width = (w: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => width(1024));
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppShell><p>page</p></AppShell></MemoryRouter>);
const sidebar = () => document.querySelector('[data-sidebar="sidebar"]') as HTMLElement;

describe('a route home from the app (Phase 16)', () => {
  it('expanded sidebar: "B2BNEST home" goes to the public home page and is never marked current', () => {
    width(1440);
    renderAt('/dashboard');
    const home = within(sidebar()).getByRole('link', { name: 'B2BNEST home' });
    expect(home).toHaveAttribute('href', '/');
    expect(home).not.toHaveAttribute('aria-current');
  });

  it('collapsed sidebar (icon only): the entry is still there, with a "B2BNEST home" tooltip on focus', async () => {
    width(1440);
    renderAt('/crm');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.querySelector('[data-state="collapsed"]')).not.toBeNull();
    const home = within(sidebar()).getByRole('link', { name: 'B2BNEST home' });
    expect(home).toHaveAttribute('href', '/');
    await act(async () => { home.focus(); });
    expect(await screen.findByRole('tooltip')).toHaveTextContent('B2BNEST home');
  });

  it('mobile menu ("More"): the entry is there', async () => {
    width(390);
    renderAt('/crm');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('link', { name: 'B2BNEST home' })).toHaveAttribute('href', '/');
  });

  it('the logo goes to the dashboard from other pages', () => {
    width(1440);
    renderAt('/crm');
    const logo = within(sidebar()).getByRole('link', { name: 'Go to dashboard' });
    expect(logo).toHaveAttribute('href', '/dashboard');
    expect(logo).toHaveAttribute('title', 'Go to dashboard');
  });

  it('on the dashboard the logo goes to the home page, in the sidebar and the phone top bar', () => {
    width(1440);
    renderAt('/dashboard');
    const logos = screen.getAllByRole('link', { name: 'Go to home page' });
    expect(logos.length).toBe(2); // sidebar header + phone top bar
    for (const l of logos) { expect(l).toHaveAttribute('href', '/'); expect(l).toHaveAttribute('title', 'Go to home page'); }
    expect(screen.queryByRole('link', { name: 'Go to dashboard' })).toBeNull();
  });
});

describe('Workflows menu entry by plan (Phase 19)', () => {
  afterEach(() => { accessMock.value = { loading: false, state: 'trial', planKey: null, via: 'self' }; });
  it('Solo: the entry stays visible and is marked "Business"', () => {
    width(1440);
    accessMock.value = { loading: false, state: 'subscribed', planKey: 'starter', via: 'self' };
    renderAt('/dashboard');
    const link = within(sidebar()).getByRole('link', { name: /Workflows/ });
    expect(link).toHaveAttribute('href', '/workflow-studio');
    expect(link).toHaveTextContent('Business');
    expect(link).toHaveTextContent('(in the Business and Scale plans)');
  });
  it.each([['trial', null], ['subscribed', 'professional'], ['subscribed', 'enterprise'], ['owner', null]])('%s %s: no mark', (state, planKey) => {
    width(1440);
    accessMock.value = { loading: false, state: state as string, planKey, via: 'self' };
    renderAt('/dashboard');
    expect(within(sidebar()).getByRole('link', { name: /Workflows/ })).not.toHaveTextContent('Business');
  });
});
