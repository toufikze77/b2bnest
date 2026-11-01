// Phase 24: the signed-in app shell is never shown to a signed-out visitor; loading shows neither shell nor header.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = { user: null as null | { id: string }, loading: false };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/components/Header', () => ({ default: () => <header data-testid="public-header">Public header</header> }));
vi.mock('@/components/shell/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div> }));
vi.mock('@/components/onboarding/WelcomeTour', () => ({ default: () => null }));

import Layout from './Layout';

const at = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><Layout><p>page content</p></Layout></MemoryRouter>);

describe('Layout: app shell only for signed-in people', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; });

  it.each(['/template-center', '/business-tools', '/business-tools?tool=crm', '/pricing', '/dashboard', '/crm'])(
    'signed out on %s → public Header, never the app shell',
    (path) => {
      at(path);
      expect(screen.getByTestId('public-header')).toBeInTheDocument();
      expect(screen.queryByTestId('app-shell')).toBeNull();
    },
  );

  it.each(['/template-center', '/business-tools', '/dashboard'])('signed in on %s → app shell (unchanged)', (path) => {
    auth.user = { id: 'u1' };
    at(path);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('public-header')).toBeNull();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('signed in on Pricing still gets the public header (unchanged)', () => {
    auth.user = { id: 'u1' };
    at('/pricing');
    expect(screen.getByTestId('public-header')).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).toBeNull();
  });

  it.each(['/template-center', '/business-tools'])('while sign-in is being checked on %s → neither shell nor header, only the skeleton', (path) => {
    auth.loading = true;
    at(path);
    expect(screen.queryByTestId('app-shell')).toBeNull();
    expect(screen.queryByTestId('public-header')).toBeNull();
    expect(screen.queryByText('page content')).toBeNull();
    expect(screen.getByTestId('layout-loading')).toBeInTheDocument();
  });
});
