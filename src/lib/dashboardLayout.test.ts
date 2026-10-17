import { describe, expect, it } from 'vitest';
import {
  clearLayout, defaultLayout, isMoneyWidget, layoutKey, loadLayout, PRESETS, presetLayout, sanitizeLayout,
  saveLayout, toggleWidget, WIDGETS,
} from './dashboardLayout';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
};
const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('denied'); } };

describe('dashboard layout', () => {
  it('defaults to Balanced with no more than one money widget', () => {
    const d = defaultLayout();
    expect(d.preset).toBe('balanced');
    expect(d.widgets.filter(isMoneyWidget)).toHaveLength(1);
  });

  it('has the four starting layouts, each using only known widgets', () => {
    expect(PRESETS.map((p) => p.label)).toEqual(['Balanced', 'Projects and tasks', 'Sales and customers', 'Money']);
    const ids = new Set(WIDGETS.map((w) => w.id));
    for (const p of PRESETS) expect(p.widgets.every((w) => ids.has(w))).toBe(true);
  });

  it('keys storage by user and organisation', () => {
    const s = memory();
    expect(saveLayout('u1', 'org-a', presetLayout('money'), s)).toBe(true);
    expect(loadLayout('u1', 'org-a', s).preset).toBe('money');
    expect(loadLayout('u1', 'org-b', s)).toEqual(defaultLayout());
    expect(loadLayout('u2', 'org-a', s)).toEqual(defaultLayout());
    expect([...s.m.keys()]).toEqual([layoutKey('u1', 'org-a')]);
  });

  it('round-trips a custom layout, keeping order', () => {
    const s = memory();
    const custom = toggleWidget(toggleWidget(defaultLayout(), 'rota', false), 'support', true);
    expect(custom.preset).toBe('custom');
    expect(custom.widgets.at(-1)).toBe('support');
    saveLayout('u1', 'o1', custom, s);
    expect(loadLayout('u1', 'o1', s)).toEqual(custom);
  });

  it('falls back to the default on corrupt, foreign or old data', () => {
    const s = memory();
    s.setItem(layoutKey('u1', 'o1'), '{not json');
    expect(loadLayout('u1', 'o1', s)).toEqual(defaultLayout());
    s.setItem(layoutKey('u1', 'o1'), JSON.stringify({ v: 0, preset: 'money', widgets: ['money'] }));
    expect(loadLayout('u1', 'o1', s)).toEqual(defaultLayout());
    expect(sanitizeLayout(null)).toEqual(defaultLayout());
    expect(sanitizeLayout({ v: 1, widgets: 'tasks' })).toEqual(defaultLayout());
  });

  it('drops unknown and duplicate widgets and unknown presets', () => {
    expect(sanitizeLayout({ v: 1, preset: 'hacker', widgets: ['tasks', 'cashflow', 'tasks', 7, 'money'] })).toEqual({ preset: 'custom', widgets: ['tasks', 'money'] });
  });

  it('allows an empty layout (everything switched off)', () => {
    const s = memory();
    saveLayout('u1', 'o1', { preset: 'custom', widgets: [] }, s);
    expect(loadLayout('u1', 'o1', s).widgets).toEqual([]);
  });

  it('never throws when storage is unavailable', () => {
    expect(loadLayout('u1', 'o1', throwing)).toEqual(defaultLayout());
    expect(saveLayout('u1', 'o1', defaultLayout(), throwing)).toBe(false);
    expect(clearLayout('u1', 'o1', throwing)).toBe(false);
    expect(loadLayout('u1', 'o1', null)).toEqual(defaultLayout());
  });

  it('does not save without a user and company', () => {
    const s = memory();
    expect(saveLayout(null, 'o1', defaultLayout(), s)).toBe(false);
    expect(saveLayout('u1', undefined, defaultLayout(), s)).toBe(false);
    expect(s.m.size).toBe(0);
  });

  it('clearLayout restores the default', () => {
    const s = memory();
    saveLayout('u1', 'o1', presetLayout('sales'), s);
    expect(clearLayout('u1', 'o1', s)).toBe(true);
    expect(loadLayout('u1', 'o1', s)).toEqual(defaultLayout());
  });

  it('toggling to the current state is a no-op', () => {
    const d = defaultLayout();
    expect(toggleWidget(d, 'tasks', true)).toBe(d);
    expect(toggleWidget(d, 'support', false)).toBe(d);
  });
});
