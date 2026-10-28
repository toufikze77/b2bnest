import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

let access: { state: string; loading: boolean } = { state: 'unknown', loading: false };
vi.mock('@/hooks/useAccess', () => ({ useAccess: () => access }));
vi.mock('./ShareButton', () => ({ default: () => null }));
import Footer from './Footer';

const show = () => render(<MemoryRouter><Footer /></MemoryRouter>);

// The Marketing Materials page itself is public; only its footer link is for platform owners (server state 'owner':
// owner role or a master account). Phase 12b replaced the two hard-coded emails with this.
describe('Footer: Marketing Materials link', () => {
  it.each(['trial', 'trial_ended', 'subscribed', 'unknown'])('hidden for %s', (state) => {
    access = { state, loading: false };
    show();
    expect(screen.queryByRole('button', { name: 'Marketing Materials' })).toBeNull();
  });

  it('hidden while loading', () => {
    access = { state: 'owner', loading: true };
    show();
    expect(screen.queryByRole('button', { name: 'Marketing Materials' })).toBeNull();
  });

  it('shown for owners (owner role or master account)', () => {
    access = { state: 'owner', loading: false };
    show();
    expect(screen.getByRole('button', { name: 'Marketing Materials' })).toBeInTheDocument();
  });
});
