// Phase 24: a signed-out visitor who opens a premium tool gets a sign-in step that returns to that tool.
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false }) }));
vi.mock('@/hooks/useFavoriteTools', () => ({ useFavoriteTools: () => ({ favorites: [], toggleFavorite: vi.fn(), isFavorited: () => false }) }));
vi.mock('@/components/BusinessToolsSEO', () => ({ default: () => null }));

import BusinessTools from './BusinessTools';

const AuthPage = () => { const l = useLocation(); return <p data-testid="auth-page">{l.pathname + l.search}</p>; };

describe('Business Tools, signed out', () => {
  it('a premium tool shows "Sign in to use this tool"; the button returns to that tool after sign-in', () => {
    window.history.replaceState(null, '', '/business-tools?tool=crm');
    render(
      <MemoryRouter initialEntries={['/business-tools?tool=crm']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/business-tools" element={<BusinessTools />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Sign in to use this tool')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In / Sign Up' }));
    expect(screen.getByTestId('auth-page').textContent).toBe(`/auth?next=${encodeURIComponent('/business-tools?tool=crm')}`);
  });
});
