/** CRM tab state lives in the URL (`?tab=`). Default (no param / invalid) = contacts. Other params are preserved. */
export const CRM_TABS = ['contacts', 'deals', 'marketing', 'reports', 'analytics'] as const;
export type CrmTab = (typeof CRM_TABS)[number];
export const DEFAULT_CRM_TAB: CrmTab = 'contacts';

export function readCrmTab(params: URLSearchParams): CrmTab {
  const t = params.get('tab')?.toLowerCase();
  return t && (CRM_TABS as readonly string[]).includes(t) ? (t as CrmTab) : DEFAULT_CRM_TAB;
}

export function writeCrmTab(params: URLSearchParams, tab: CrmTab): URLSearchParams {
  const next = new URLSearchParams(params);
  if (tab === DEFAULT_CRM_TAB) next.delete('tab');
  else next.set('tab', tab);
  return next;
}

/**
 * Link to one contact (`?contact=<id>`, Contacts tab) or deal (`?tab=deals&deal=<id>`), keeping other params
 * (e.g. `tool=` when the CRM is embedded). The Contacts / Sales Pipeline views open that record, then drop the param.
 */
export function crmRecordSearch(search: string, kind: 'contact' | 'deal', id: string): string {
  const next = writeCrmTab(new URLSearchParams(search), kind === 'deal' ? 'deals' : 'contacts');
  next.delete('contact'); next.delete('deal');
  next.set(kind, id);
  return `?${next.toString()}`;
}
