import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WorkflowGuide from './WorkflowGuide';
import KnowledgeBase from '../KnowledgeBase';
import { GUIDE_PATH, GUIDE_SECTIONS, PLACEHOLDER_ROWS, TROUBLESHOOTING } from '@/lib/workflowGuide';

vi.mock('@/components/SEOHead', () => ({ default: () => null }));
const renderGuide = (hash = '') => render(<MemoryRouter initialEntries={[`${GUIDE_PATH}${hash}`]}><WorkflowGuide /></MemoryRouter>);

describe('workflows guide page (Phase 17)', () => {
  it('every section heading carries its anchor id', () => {
    renderGuide();
    for (const s of GUIDE_SECTIONS) expect(document.getElementById(s.id), s.id).toHaveTextContent(s.title);
  });

  it('the placeholder table lists every placeholder from the shared list, with its limit', () => {
    renderGuide();
    const table = screen.getByRole('table', { name: 'Placeholders you can use' });
    for (const p of PLACEHOLDER_ROWS) {
      const row = within(table).getByText(p.token).closest('tr')!;
      expect(row).toHaveTextContent(`${p.maxLength} characters`);
    }
  });

  it('the troubleshooting table shows every message', () => {
    renderGuide();
    const table = screen.getByRole('table', { name: 'Messages, what they mean and what to do' });
    for (const t of TROUBLESHOOTING) expect(within(table).getByText(t.shown)).toBeInTheDocument();
  });

  it('a link with #anchor moves keyboard focus to that section', () => {
    renderGuide('#limits');
    expect(document.activeElement).toBe(document.getElementById('limits'));
  });

  it('every Knowledge Base workflow card link resolves to a section on the guide', () => {
    render(<MemoryRouter><KnowledgeBase /></MemoryRouter>);
    const tab = screen.getByRole('tab', { name: /Workflow Automation/ });
    fireEvent.mouseDown(tab); fireEvent.click(tab);
    const panel = screen.getByRole('tabpanel');
    const links = within(panel).getAllByRole('link', { name: /^Read:/ });
    expect(links.length).toBeGreaterThanOrEqual(4);
    const suggested = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith(`${GUIDE_PATH}#`));
    const anchors = [...links, ...suggested].map((a) => a.getAttribute('href')!);
    const { unmount } = renderGuide();
    for (const href of anchors) {
      expect(href.startsWith(`${GUIDE_PATH}#`), href).toBe(true);
      expect(document.getElementById(href.split('#')[1]), href).not.toBeNull();
    }
    unmount();
  });

  it('the Knowledge Base no longer promises social posting from workflows', () => {
    render(<MemoryRouter><KnowledgeBase /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(/for workflow posts/);
  });
});
