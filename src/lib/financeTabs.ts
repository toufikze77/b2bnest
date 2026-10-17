/**
 * Invoices & quotes tabs live in the address bar (`?tab=`), so a refresh lands on the same tab.
 * Before Phase 3b, clicking a tab only changed React state; a refresh then re-read whatever
 * `?tab=` the user first arrived with (often `create`, from "New invoice" / "New quote").
 */
export type FinanceTab = 'dashboard' | 'create' | 'quotes' | 'invoices' | 'products' | 'suppliers' | 'expenses' | 'outgoings' | 'banking' | 'payroll' | 'reports' | 'analytics' | 'templates';
export const FINANCE_TABS: FinanceTab[] = ['dashboard', 'create', 'quotes', 'invoices', 'products', 'suppliers', 'expenses', 'outgoings', 'banking', 'payroll', 'reports', 'analytics', 'templates'];

/** The tab named in the URL; missing or unknown values land on Overview (dashboard), never Create. */
export function financeTabFromSearch(search: string): FinanceTab {
  const t = new URLSearchParams(search).get('tab') as FinanceTab | null;
  return t && FINANCE_TABS.includes(t) ? t : 'dashboard';
}

/**
 * The query string after switching to `tab`: other params (tool=…, payroll=…) are kept, and
 * `type=` is dropped because it only belongs to a fresh "New invoice" / "New quote".
 */
export function searchWithTab(search: string, tab: FinanceTab): string {
  const p = new URLSearchParams(search);
  p.set('tab', tab);
  p.delete('type');
  return p.toString();
}

export type PayrollSubTab = 'employees' | 'payrun' | 'history' | 'settings';
export const PAYROLL_TABS: PayrollSubTab[] = ['employees', 'payrun', 'history', 'settings'];

/** Payroll's inner tab from `?payroll=`; missing or unknown values land on Employees. */
export function payrollTabFromSearch(search: string): PayrollSubTab {
  const t = new URLSearchParams(search).get('payroll') as PayrollSubTab | null;
  return t && PAYROLL_TABS.includes(t) ? t : 'employees';
}

export function searchWithPayrollTab(search: string, tab: PayrollSubTab): string {
  const p = new URLSearchParams(search);
  p.set('payroll', tab);
  return p.toString();
}
