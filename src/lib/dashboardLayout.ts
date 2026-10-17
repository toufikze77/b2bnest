/**
 * Customisable Dashboard layout (Phase 0). Pure helpers: the widget catalogue,
 * the four starting layouts and per-person storage in localStorage, keyed by
 * user id and organisation id. Storage is best-effort; any failure falls back
 * to the Balanced layout. A shared, database-backed layout is a later step.
 */

export type WidgetId =
  | 'tasks' | 'projects' | 'comingUp' | 'workspaces' | 'recent'
  | 'customers' | 'pipeline' | 'support'
  | 'money' | 'expenses'
  | 'rota';

export type WidgetGroup = 'Projects and tasks' | 'Customers' | 'Money' | 'Team';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  group: WidgetGroup;
  /** Shown full-width on wide screens. */
  wide?: boolean;
}

/** Only widgets the app can feed with real data. Order = default reading order. */
export const WIDGETS: WidgetDef[] = [
  { id: 'tasks', title: 'Tasks needing attention', description: 'Overdue, due today and due in the next 7 days', group: 'Projects and tasks', wide: true },
  { id: 'projects', title: 'Project progress', description: 'Task progress and next due date for active projects', group: 'Projects and tasks', wide: true },
  { id: 'comingUp', title: 'Coming up', description: 'Active project deadlines, soonest first', group: 'Projects and tasks' },
  { id: 'workspaces', title: 'Workspaces', description: 'Template boards for this company', group: 'Projects and tasks' },
  { id: 'recent', title: 'Recently updated tasks', description: 'The latest task changes in this company', group: 'Projects and tasks' },
  { id: 'customers', title: 'Customers', description: 'Your CRM contacts by status', group: 'Customers' },
  { id: 'pipeline', title: 'Sales pipeline', description: 'Your open deals by stage', group: 'Customers' },
  { id: 'support', title: 'Support tickets', description: 'Tickets for this company by status', group: 'Customers' },
  { id: 'money', title: 'Key money numbers', description: 'Your paid and outstanding invoices and unpaid expenses', group: 'Money' },
  { id: 'expenses', title: 'Expenses to review', description: 'Your expenses still marked pending', group: 'Money' },
  { id: 'rota', title: 'Rota today', description: "Today's shifts for this company", group: 'Team' },
];

export const WIDGET_GROUPS: WidgetGroup[] = ['Projects and tasks', 'Customers', 'Money', 'Team'];
const WIDGET_IDS = new Set<string>(WIDGETS.map((w) => w.id));
export const widgetById = (id: WidgetId) => WIDGETS.find((w) => w.id === id)!;
export const isMoneyWidget = (id: WidgetId) => widgetById(id).group === 'Money';

export type PresetId = 'balanced' | 'projects' | 'sales' | 'money';

export const PRESETS: { id: PresetId; label: string; description: string; widgets: WidgetId[] }[] = [
  { id: 'balanced', label: 'Balanced', description: 'A bit of everything, with one money widget', widgets: ['tasks', 'projects', 'comingUp', 'workspaces', 'customers', 'money', 'rota', 'recent'] },
  { id: 'projects', label: 'Projects and tasks', description: 'Delivery first', widgets: ['tasks', 'projects', 'comingUp', 'workspaces', 'recent', 'rota'] },
  { id: 'sales', label: 'Sales and customers', description: 'Pipeline, contacts and support', widgets: ['pipeline', 'customers', 'support', 'tasks', 'recent'] },
  { id: 'money', label: 'Money', description: 'Invoices and expenses', widgets: ['money', 'expenses', 'pipeline', 'tasks'] },
];

export const DEFAULT_PRESET: PresetId = 'balanced';

export interface DashboardLayout {
  /** The starting layout last chosen; 'custom' once switches have been changed. */
  preset: PresetId | 'custom';
  /** Visible widgets, in display order. */
  widgets: WidgetId[];
}

export const LAYOUT_VERSION = 1;

export const presetLayout = (id: PresetId): DashboardLayout => {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return { preset: p.id, widgets: [...p.widgets] };
};

export const defaultLayout = () => presetLayout(DEFAULT_PRESET);

export const layoutKey = (userId: string, orgId: string) => `b2bnest.dashboard.layout.v${LAYOUT_VERSION}.${userId}.${orgId}`;

/** Turns any stored value into a valid layout: unknown ids and duplicates are dropped; anything unusable gives the default. */
export function sanitizeLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== 'object') return defaultLayout();
  const r = raw as { v?: unknown; preset?: unknown; widgets?: unknown };
  if (r.v !== LAYOUT_VERSION || !Array.isArray(r.widgets)) return defaultLayout();
  const widgets = [...new Set(r.widgets.filter((w): w is WidgetId => typeof w === 'string' && WIDGET_IDS.has(w)))];
  const preset = typeof r.preset === 'string' && (r.preset === 'custom' || PRESETS.some((p) => p.id === r.preset)) ? (r.preset as DashboardLayout['preset']) : 'custom';
  return { preset, widgets };
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const defaultStorage = (): KV | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

export function loadLayout(userId: string | null | undefined, orgId: string | null | undefined, storage: KV | null = defaultStorage()): DashboardLayout {
  if (!userId || !orgId || !storage) return defaultLayout();
  try {
    const raw = storage.getItem(layoutKey(userId, orgId));
    return raw ? sanitizeLayout(JSON.parse(raw)) : defaultLayout();
  } catch {
    return defaultLayout();
  }
}

/** Returns false when the layout could not be stored (private mode, quota, no user/company). */
export function saveLayout(userId: string | null | undefined, orgId: string | null | undefined, layout: DashboardLayout, storage: KV | null = defaultStorage()): boolean {
  if (!userId || !orgId || !storage) return false;
  try {
    const clean = sanitizeLayout({ v: LAYOUT_VERSION, ...layout });
    storage.setItem(layoutKey(userId, orgId), JSON.stringify({ v: LAYOUT_VERSION, ...clean }));
    return true;
  } catch {
    return false;
  }
}

export function clearLayout(userId: string | null | undefined, orgId: string | null | undefined, storage: KV | null = defaultStorage()): boolean {
  if (!userId || !orgId || !storage) return false;
  try { storage.removeItem(layoutKey(userId, orgId)); return true; } catch { return false; }
}

/** Switching a widget on adds it at the end; off removes it. Either way the layout becomes custom. */
export function toggleWidget(layout: DashboardLayout, id: WidgetId, on: boolean): DashboardLayout {
  const has = layout.widgets.includes(id);
  if (on === has) return layout;
  return { preset: 'custom', widgets: on ? [...layout.widgets, id] : layout.widgets.filter((w) => w !== id) };
}

export const sameLayout = (a: DashboardLayout, b: DashboardLayout) =>
  a.preset === b.preset && a.widgets.length === b.widgets.length && a.widgets.every((w, i) => w === b.widgets[i]);
