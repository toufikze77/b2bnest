import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { normalizePmParams, readPmProject, readPmTab, writePmProject, writePmTab, PmTab } from './pmView';

const p = (s: string) => new URLSearchParams(s);

describe('pmView URL helpers', () => {
  it('reads direct links for every view/tab', () => {
    expect(readPmTab(p('view=list'))).toBe('list');
    expect(readPmTab(p('view=kanban'))).toBe('kanban');
    expect(readPmTab(p('view=board'))).toBe('kanban');
    expect(readPmTab(p('view=calendar'))).toBe('calendar');
    expect(readPmTab(p('view=timeline'))).toBe('timeline');
    expect(readPmTab(p('tab=goals'))).toBe('goals');
    expect(readPmTab(p(''))).toBe('kanban');
  });
  it('invalid params fall back and normalize', () => {
    expect(readPmTab(p('view=bogus'))).toBe('kanban');
    expect(normalizePmParams(p('view=bogus&project=x'))?.toString()).toBe('project=x&view=kanban');
    expect(normalizePmParams(p('tab=board'))?.toString()).toBe('view=kanban');
    expect(normalizePmParams(p('view=list'))).toBeNull();
    expect(normalizePmParams(p('project=x'))).toBeNull();
  });
  it('writing a tab preserves project and other params', () => {
    const next = writePmTab(p('project=abc&foo=1&view=list'), 'goals');
    expect(next.get('project')).toBe('abc');
    expect(next.get('foo')).toBe('1');
    expect(next.get('tab')).toBe('goals');
    expect(next.has('view')).toBe(false);
    expect(readPmProject(writePmProject(next, 'all'))).toBe('all');
  });
});

// Minimal harness mirroring the component: state derived only from the URL.
function Harness() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const tab = readPmTab(sp);
  const go = (t: PmTab) => setSp((prev) => writePmTab(prev, t));
  return (
    <div>
      <span data-testid="tab">{tab}</span><span data-testid="url">{loc.search}</span>
      {(['kanban', 'list', 'goals', 'calendar', 'timeline'] as PmTab[]).map((t) => <button key={t} onClick={() => go(t)}>{t}</button>)}
      <button onClick={() => nav(-1)}>back</button><button onClick={() => nav(1)}>forward</button>
    </div>
  );
}

describe('view persistence', () => {
  it('view switch then refresh keeps the view and project', () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/pm?project=p1']}><Harness /></MemoryRouter>);
    fireEvent.click(screen.getByText('kanban'));
    fireEvent.click(screen.getByText('list'));
    const url = screen.getByTestId('url').textContent!;
    expect(url).toBe('?project=p1&view=list');
    unmount(); // "refresh": remount from the same URL
    render(<MemoryRouter initialEntries={[`/pm${url}`]}><Harness /></MemoryRouter>);
    expect(screen.getByTestId('tab').textContent).toBe('list');
    expect(readPmProject(p(url))).toBe('p1');
  });
  it('goals survives refresh', () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/pm']}><Harness /></MemoryRouter>);
    fireEvent.click(screen.getByText('goals'));
    const url = screen.getByTestId('url').textContent!;
    unmount();
    render(<MemoryRouter initialEntries={[`/pm${url}`]}><Harness /></MemoryRouter>);
    expect(screen.getByTestId('tab').textContent).toBe('goals');
  });
  it('Back/Forward restore views', async () => {
    render(<MemoryRouter initialEntries={['/pm']}><Harness /></MemoryRouter>);
    fireEvent.click(screen.getByText('kanban'));
    fireEvent.click(screen.getByText('calendar'));
    fireEvent.click(screen.getByText('timeline'));
    await act(async () => { fireEvent.click(screen.getByText('back')); });
    expect(screen.getByTestId('tab').textContent).toBe('calendar');
    await act(async () => { fireEvent.click(screen.getByText('back')); });
    expect(screen.getByTestId('tab').textContent).toBe('kanban');
    await act(async () => { fireEvent.click(screen.getByText('forward')); });
    expect(screen.getByTestId('tab').textContent).toBe('calendar');
  });
});
