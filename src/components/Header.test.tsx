import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let signedIn = true;
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: signedIn ? { id: 'u1', email: 'sam@example.com' } : null, signOut: vi.fn() }) }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@/hooks/useUserAvatar', () => ({ useUserAvatar: () => ({ avatarUrl: '', displayName: 'Sam Taylor', email: 'sam@example.com' }) }));
vi.mock('@/components/OrganizationSwitcher', () => ({ default: () => <div data-testid="org-switcher" /> }));
vi.mock('@/components/ProfileEditDialog', () => ({ default: () => null }));
vi.mock('@/components/SupportFeedbackDialog', () => ({ default: () => null }));

import Header, { HEADER_NAV_CLASS, HEADER_ROW_CLASS } from './Header';

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
const renderHeader = () => render(<MemoryRouter><Header /></MemoryRouter>);

describe('public header spacing (Phase 16)', () => {
  it('the logo, menu and buttons sit in a row with a fixed minimum gap', () => {
    expect(HEADER_ROW_CLASS).toMatch(/\bgap-3\b/);
    expect(HEADER_ROW_CLASS).toMatch(/\blg:gap-6\b/); // 24px from 1024px, where the menu is shown
    expect(HEADER_ROW_CLASS).not.toMatch(/justify-between/); // spacing no longer depends on spare room
    renderHeader();
    expect(screen.getByTestId('header-row').className).toBe(HEADER_ROW_CLASS);
    const logo = screen.getByRole('link', { name: 'B2BNEST home' });
    expect(logo).toHaveAttribute('href', '/');
    expect(logo.className).toMatch(/\bshrink-0\b/);
  });

  it('every main menu item is in the desktop menu, which never shrinks into the logo', () => {
    expect(HEADER_NAV_CLASS).toMatch(/\blg:flex\b/);
    expect(HEADER_NAV_CLASS).toMatch(/\bshrink-0\b/);
    expect(HEADER_NAV_CLASS).toMatch(/\bwhitespace-nowrap\b/);
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.className).toBe(HEADER_NAV_CLASS);
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Business Tools', 'Templates', 'Resources', 'Pricing', 'Help']);
    // AI Tools opens with the keyboard too (it is a button, not a span).
    expect(within(nav).getByRole('button', { name: 'AI Tools' })).toBeInTheDocument();
  });

  it('Download, Share and Support & feedback are in "More"', async () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /^More/ }));
    const more = await screen.findByTestId('header-more');
    expect(within(more).getByRole('button', { name: /Download app/ })).toBeInTheDocument();
    expect(within(more).getByRole('button', { name: /Share/ })).toBeInTheDocument();
    expect(within(more).getByRole('button', { name: /Support & feedback/ })).toBeInTheDocument();
  });

  it('signed in: the account button keeps its width (name inside the menu) and says whose account it is', () => {
    signedIn = true;
    renderHeader();
    expect(screen.getByRole('button', { name: 'Account menu for Sam Taylor' })).toBeInTheDocument();
    expect(screen.queryByText('Sam Taylor')).toBeNull();
  });

  it('signed out: Sign In and Sign Up are shown', () => {
    signedIn = false;
    renderHeader();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    signedIn = true;
  });
});
