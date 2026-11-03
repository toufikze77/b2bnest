// Phase 38: Goal Tracker helpers (tested in goals.test.ts). Goals are saved in this browser only (localStorage).
export interface Goal { id: string; title: string; description: string; targetDate: string; progress: number; category: string; isCompleted: boolean; createdAt: string }
export const STORAGE_KEY = 'goalTrackerGoals';
export const MAX_GOALS = 10;
export const CATEGORIES = ['Business', 'Financial', 'Marketing', 'Sales', 'Product', 'Team', 'Personal'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** A "YYYY-MM-DD" day (older saved goals held a full ISO date: its local day is kept). */
export function toDay(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (DAY.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function formatDay(day: string): string { const m = DAY.exec(day); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ''; }
const utc = (day: string) => { const m = DAY.exec(day)!; return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])); };
export const localToday = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
/** Whole days from today to the target (negative = overdue), by calendar day, not by hours. */
export const daysUntil = (target: string, today: string) => Math.round((utc(target) - utc(today)) / 86400000);
/** Due-date status in words (not colour alone). */
export function dueText(g: Pick<Goal, 'targetDate' | 'isCompleted'>, today: string): string {
  if (g.isCompleted) return 'Completed';
  const d = daysUntil(g.targetDate, today);
  if (d < 0) return `Overdue by ${-d} ${d === -1 ? 'day' : 'days'}`;
  if (d === 0) return 'Due today';
  return `${d} ${d === 1 ? 'day' : 'days'} left`;
}

/** Reads saved goals; anything malformed is dropped instead of breaking the page. */
export function loadGoals(): Goal[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.flatMap((g): Goal[] => {
      if (!g || typeof g !== 'object' || typeof g.id !== 'string' || typeof g.title !== 'string' || !g.title.trim()) return [];
      const targetDate = toDay(g.targetDate);
      if (!targetDate) return [];
      const progress = Math.min(100, Math.max(0, Math.round(Number(g.progress) || 0)));
      return [{ id: g.id, title: g.title, description: typeof g.description === 'string' ? g.description : '', targetDate, progress,
        category: CATEGORIES.includes(g.category) ? g.category : 'Business', isCompleted: progress >= 100, createdAt: typeof g.createdAt === 'string' ? g.createdAt : '' }];
    }).slice(0, MAX_GOALS);
  } catch { return []; }
}
export function saveGoals(goals: Goal[]): boolean { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); return true; } catch { return false; } }

export function goalErrors(f: { title: string; targetDate: string }): { title?: string; targetDate?: string } {
  const e: { title?: string; targetDate?: string } = {};
  if (!f.title.trim()) e.title = 'Enter a goal.'; else if (f.title.trim().length > 120) e.title = 'Use at most 120 characters.';
  if (!f.targetDate) e.targetDate = 'Choose a target date.'; else if (!DAY.test(f.targetDate)) e.targetDate = 'Choose a valid date.';
  return e;
}
export const setProgress = (g: Goal, p: number): Goal => { const progress = Math.min(100, Math.max(0, Math.round(p))); return { ...g, progress, isCompleted: progress >= 100 }; };

/** Phase 39: a goal read back from the account. */
export const isGoal = (x: unknown): x is Goal => !!x && typeof x === 'object' && typeof (x as Goal).id === 'string' && typeof (x as Goal).title === 'string'
  && typeof (x as Goal).targetDate === 'string' && typeof (x as Goal).progress === 'number';
