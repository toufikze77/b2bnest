// Phase 24: the Template Centre stays a public showcase. Signed out, "Preview" works; "Use template" and "Create with AI"
// go to sign-in with the return path and say why. Signed in, they open the dialogs as before.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/data/workspaceTemplates';
import { customerTemplates } from '@/lib/templateCatalogue';

const auth = { user: null as null | { id: string }, loading: false };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false }) }));
vi.mock('@/services/workspaceTemplateService', () => ({
  loadTemplates: async () => BUILT_IN_TEMPLATES,
  loadUsage: async () => ({}),
  logTemplateEvent: vi.fn(),
}));
// The dialogs are what a signed-in person opens; stubbed so this test is only about the sign-in step.
vi.mock('@/components/template-centre/UseWorkspaceTemplateDialog', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="use-dialog" /> : null),
}));
vi.mock('@/components/template-centre/AiTemplateDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="ai-dialog" /> : null),
}));
vi.mock('@/components/SEOHead', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));

import TemplateCenter from './TemplateCenter';

const AuthPage = () => { const l = useLocation(); return <p data-testid="auth-page">{l.pathname + l.search}</p>; };
const open = (path = '/template-center') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/template-center" element={<TemplateCenter />} />
    </Routes>
  </MemoryRouter>,
);
const available = customerTemplates(BUILT_IN_TEMPLATES)[0];
const next = (p: string) => `/auth?next=${encodeURIComponent(p)}`;

describe('Template Centre, signed out', () => {
  beforeEach(() => { auth.user = null; });

  it('"Use template" on a card goes to /auth?next=/template-center, with the plain line', async () => {
    open('/template-center?category=sales');
    const useLinks = await screen.findAllByRole('link', { name: `Sign in to use ${available.name}` });
    expect(screen.getAllByTestId('template-sign-in-line')[0]).toHaveTextContent('Sign in to use this template');
    expect(useLinks[0]).toHaveTextContent('Use template');
    fireEvent.click(useLinks[0]);
    expect(screen.getByTestId('auth-page').textContent).toMatch(/^\/auth\?next=%2Ftemplate-center/);
    expect(screen.queryByTestId('use-dialog')).toBeNull();
  });

  it('"Preview" still opens; inside, "Use template" also goes to sign-in', async () => {
    open();
    const card = (await screen.findAllByRole('link', { name: `Sign in to use ${available.name}` }))[0].closest('article')!;
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Preview' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('template-sign-in-line')).toHaveTextContent('Sign in to use this template');
    const link = within(dialog).getByRole('link', { name: `Sign in to use ${available.name}` });
    expect(link).toHaveAttribute('href', next('/template-center'));
  });

  it('"Create with AI" goes to sign-in; the AI dialog never opens', async () => {
    open();
    const ai = await screen.findByRole('link', { name: 'Sign in to create a template with AI' });
    expect(ai).toHaveAttribute('href', next('/template-center'));
    fireEvent.click(ai);
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-dialog')).toBeNull();
  });
});

describe('Template Centre, signed in (unchanged)', () => {
  beforeEach(() => { auth.user = { id: 'u1' }; });

  it('"Use template" opens the dialog, no sign-in line', async () => {
    open();
    const btns = await screen.findAllByRole('button', { name: `Use ${available.name}` });
    expect(screen.queryByTestId('template-sign-in-line')).toBeNull();
    fireEvent.click(btns[0]);
    expect(screen.getByTestId('use-dialog')).toBeInTheDocument();
  });

  it('"Create with AI" opens the AI dialog', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Create with AI/ }));
    expect(screen.getByTestId('ai-dialog')).toBeInTheDocument();
  });
});
