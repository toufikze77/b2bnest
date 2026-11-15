// Finance phase 3b follow-up 2: is each company VAT registered? Read through ledger_auto_status (the ledger's own read,
// which also answers No for a company with no settings row), cached per company in the app's query client. Any error
// (not a member, closed company, MFA step-up needed, SQL not applied) leaves the answer unknown, and the expense form
// then shows every VAT question. The Ledger tab invalidates vatRegistrationKey(org) after changing the setting.
import { useCallback, useContext } from 'react';
import { QueryClient, QueryClientContext, useQueries } from '@tanstack/react-query';
import { ledgerApi, type LedgerApi } from '@/lib/ledgerApi';
import { registrationFromStatus, type VatRegistration, type VatRegistrationLookup } from '@/lib/vat/registration';

/** Only ever given an empty list of queries, so it never fetches. */
const idleClient = new QueryClient();

export const vatRegistrationKey = (organizationId: string) => ['vat-registration', organizationId] as const;
/** After ledger_vat_registered_set: read the company's answer again (no-op without a query client, e.g. in tests). */
export const invalidateVatRegistration = (client: QueryClient | undefined, organizationId: string) =>
  void client?.invalidateQueries({ queryKey: vatRegistrationKey(organizationId) });

/** One lookup for the given companies: undefined while loading, after an error, or for a company not asked about. */
export function useVatRegistration(organizationIds: (string | null | undefined)[], api: Pick<LedgerApi, 'autoStatus'> = ledgerApi()): VatRegistrationLookup {
  // Without the app's query client (a screen rendered on its own, e.g. in a test) nothing is looked up: unknown, full form.
  const client = useContext(QueryClientContext);
  const ids = client ? [...new Set(organizationIds.filter((x): x is string => !!x))].sort() : [];
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: vatRegistrationKey(id),
      queryFn: async (): Promise<VatRegistration | null> => {
        const r = await api.autoStatus(id);
        return r.ok ? registrationFromStatus(r.data) ?? null : null; // null = unknown (kept, so it isn't retried in a loop)
      },
      staleTime: 5 * 60_000,
      retry: false,
    })),
  }, client ?? idleClient);
  const known = new Map<string, VatRegistration>();
  ids.forEach((id, i) => { const d = results[i]?.data; if (d) known.set(id, d); });
  const key = ids.map((id) => { const d = known.get(id); return `${id}:${d ? `${d.vat_registered}:${d.vat_registered_from ?? ''}` : '?'}`; }).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every answer in `known`
  return useCallback((id: string) => known.get(id), [key]);
}
