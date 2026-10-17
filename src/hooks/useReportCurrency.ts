import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { clearReportCurrency, loadReportCurrency, saveReportCurrency } from '@/lib/crmAnalytics';

/**
 * Currency for CRM Reports and Analytics: the account currency by default; a hand-picked one is
 * remembered per user (localStorage, safe default = account currency) until "Reset" is used.
 */
export function useReportCurrency(scope: 'crm' | 'finance' | 'overview' = 'crm') {
  const { user } = useAuth();
  const account = useAccountCurrency();
  const [currency, setState] = useState(() => loadReportCurrency(user?.id, account, undefined, scope));
  useEffect(() => { setState(loadReportCurrency(user?.id, account, undefined, scope)); }, [user?.id, account, scope]);
  return {
    currency,
    account,
    isCustom: !!account && currency !== account,
    setCurrency: (c: string) => { setState(c); saveReportCurrency(user?.id, c, undefined, scope); },
    reset: () => { clearReportCurrency(user?.id, undefined, scope); setState(account); },
  };
}
