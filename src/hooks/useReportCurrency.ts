import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { clearReportCurrency, loadReportCurrency, saveReportCurrency } from '@/lib/crmAnalytics';

/**
 * Currency for CRM Reports and Analytics: the account currency by default; a hand-picked one is
 * remembered per user (localStorage, safe default = account currency) until "Reset" is used.
 */
export function useReportCurrency() {
  const { user } = useAuth();
  const account = useAccountCurrency();
  const [currency, setState] = useState(() => loadReportCurrency(user?.id, account));
  useEffect(() => { setState(loadReportCurrency(user?.id, account)); }, [user?.id, account]);
  return {
    currency,
    account,
    isCustom: !!account && currency !== account,
    setCurrency: (c: string) => { setState(c); saveReportCurrency(user?.id, c); },
    reset: () => { clearReportCurrency(user?.id); setState(account); },
  };
}
