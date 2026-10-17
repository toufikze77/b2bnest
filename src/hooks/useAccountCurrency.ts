import { useUserSettings } from '@/hooks/useUserSettings';

/** The account currency code (e.g. "GBP"), or '' while loading / when not set — callers then show plain numbers. */
export const useAccountCurrency = () => {
  const { settings } = useUserSettings();
  return (settings?.currency_code || '').trim().toUpperCase();
};
