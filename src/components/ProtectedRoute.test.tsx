// Phase 24: the old host-name bypass ("lovable.app", "preview", "localhost" skipped sign-in) is gone, on every host.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const auth = { user: null as null | { id: string }, loading: false };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
// Phase 25: no two-step code pending and nothing required, so these tests are only about signed in / signed out.
vi.mock('@/hooks/useAssurance', () => ({ useAssurance: () => ({ loading: false, needsCode: false, verified: [], factors: [], error: null }) }));
vi.mock('@/hooks/useTwoStepRequirement', () => ({ useTwoStepRequirement: () => ({ loading: false, scope: null, mustSetUp: false, hasApp: false, showBanner: false }) }));

import ProtectedRoute from './ProtectedRoute';

const AuthPage = () => { const l = useLocation(); return <p data-testid="auth-page">{l.pathname + l.search}</p>; };
const visit = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="*" element={<ProtectedRoute><p>private page</p></ProtectedRoute>} />
    </Routes>
  </MemoryRouter>,
);
const jsdom = (globalThis as unknown as { jsdom: { reconfigure: (o: { url: string }) => void } }).jsdom;
const setHost = (url: string) => jsdom.reconfigure({ url });

describe('ProtectedRoute: no host-name bypass', () => {
  beforeEach(() => { auth.user = null; auth.loading = false; });
  afterAll(() => setHost('http://localhost:3000/'));

  it.each([
    'https://b2bnest-git-feature-preview-toufik.vercel.app/crm',
    'https://id-preview--abc.lovable.app/crm',
    'https://b2bnest.lovable.app/crm',
    'https://www.b2bnest.online/crm',
    'http://localhost:8080/crm',
  ])('signed out on %s → sent to sign-in with the return path', (url) => {
    setHost(url);
    visit('/crm?tab=deals');
    expect(screen.queryByText('private page')).toBeNull();
    expect(screen.getByTestId('auth-page').textContent).toBe(`/auth?next=${encodeURIComponent('/crm?tab=deals')}`);
  });

  it('dev mode (npm run dev) behaves the same: there is no bypass to switch on', () => {
    expect(import.meta.env.DEV).toBe(true); // vitest runs in development mode
    setHost('http://localhost:8080/dashboard');
    visit('/dashboard');
    expect(screen.queryByText('private page')).toBeNull();
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });

  it('loading on a preview host shows the skeleton, not the page', () => {
    setHost('https://id-preview--abc.lovable.app/crm');
    auth.loading = true;
    visit('/crm');
    expect(screen.queryByText('private page')).toBeNull();
    expect(screen.queryByTestId('auth-page')).toBeNull();
  });

  it('signed in → the page', () => {
    auth.user = { id: 'u1' };
    visit('/crm');
    expect(screen.getByText('private page')).toBeInTheDocument();
  });
});
