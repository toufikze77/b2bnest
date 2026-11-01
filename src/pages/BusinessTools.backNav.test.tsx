// Phase 29: tools open through React Router, Back stays in the app, and every page has exactly one back control.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false }) }));
vi.mock('@/hooks/useFavoriteTools', () => ({ useFavoriteTools: () => ({ favorites: [], toggleFavorite: vi.fn(), isFavorited: () => false }) }));
vi.mock('@/components/BusinessToolsSEO', () => ({ default: () => null }));
vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rates: { USD: 1.27 } }))));

import BusinessTools from './BusinessTools';

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };
const open = (entries: string[]) => render(
  <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
    <Routes><Route path="/business-tools" element={<><BusinessTools /><Where /></>} /><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>,
);
const BACKISH = /^(go back|back)$|back to tools|go back home|view all tools/i;
const backControls = () => [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')].filter((el) => BACKISH.test(el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''));

beforeEach(() => { window.history.replaceState(null, ''); });

describe('Business Tools back navigation', () => {
  it('overview shows no back bar and no "Go Back Home"', () => {
    open(['/business-tools']);
    expect(screen.queryByTestId('page-back-bar')).toBeNull();
    expect(backControls()).toHaveLength(0);
  });

  it('opening a tool from the overview pushes a router entry; Back returns to the overview', () => {
    open(['/business-tools']);
    fireEvent.click(screen.getByText('QR Code Generator'));
    expect(screen.getByTestId('where').textContent).toBe('/business-tools?tool=qr-code-generator');
    window.history.replaceState({ idx: 1, key: 'k' }, ''); // BrowserRouter would record this entry
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByTestId('where').textContent).toBe('/business-tools');
    expect(screen.queryByTestId('page-back-bar')).toBeNull();
  });

  it('opening a tool by URL (no app history): Back goes to /business-tools, not out of the site', () => {
    open(['/business-tools?tool=coupon-generator']);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByTestId('where').textContent).toBe('/business-tools');
  });

  it.each(['qr-code-generator', 'coupon-generator', 'time-tracker', 'currency-converter', 'business-resources', 'cash-flow-tracker', 'crm', 'roi-calculator'])(
    '%s shows exactly one back control', (tool) => {
      open([`/business-tools?tool=${tool}`]);
      expect(backControls()).toHaveLength(1);
      expect(screen.getAllByTestId('page-back-bar')).toHaveLength(1);
    },
  );
});

// The pages a person reaches from Business Tools outside this component: each has exactly one back control.
import fs from 'node:fs';
import path from 'node:path';
const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('one back control on every page reached from Business Tools', () => {
  it.each([
    ['components/NotePro.tsx', 'PageBackBar'],
    ['pages/WorkflowStudio.tsx', 'PageBackBar'],
    ['pages/lead-generation/LeadGenLayout.tsx', 'PageBackBar'],
    ['pages/rota/RotaLayout.tsx', 'PageBackBar'],
  ])('%s uses the shared PageBackBar and no other back button', (file) => {
    const src = read(file);
    expect(src).toMatch(/<PageBackBar /);
    expect(src).not.toMatch(/navigate\(-1\)|ArrowLeft|Go Back Home|Back to Tools/);
  });
  it('the form and page builders keep their own "back to the list" button and switch the layout bar off', () => {
    for (const f of ['pages/lead-generation/FormBuilder.tsx', 'pages/lead-generation/PageBuilder.tsx']) {
      const src = read(f);
      expect(src).toMatch(/showBackBar=\{false\}/);
      expect((src.match(/ArrowLeft className/g) ?? []).length).toBe(1);
    }
  });
  it('CRM, Projects and Invoices keep their one breadcrumb band (no extra back bar)', () => {
    expect(read('pages/CRMPage.tsx')).not.toMatch(/PageBackBar/);
    expect(read('pages/ProjectManagementPage.tsx')).not.toMatch(/PageBackBar/);
    expect(read('components/BusinessFinanceAssistant.tsx')).not.toMatch(/PageBackBar|ArrowLeft/);
    expect(read('pages/BusinessTools.tsx')).toMatch(/const ownFrame = currentTool === 'business-finance-assistant'/);
  });
  it('BusinessTools no longer pushes history by hand', () => {
    const src = read('pages/BusinessTools.tsx');
    expect(src).not.toMatch(/pushState|addEventListener\('popstate'/);
  });
});
