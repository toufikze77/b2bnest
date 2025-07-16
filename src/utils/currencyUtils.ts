
export const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar', code: 'USD' },
  EUR: { symbol: '€', name: 'Euro', code: 'EUR' },
  GBP: { symbol: '£', name: 'British Pound', code: 'GBP' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', code: 'CAD' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', code: 'AUD' },
  JPY: { symbol: '¥', name: 'Japanese Yen', code: 'JPY' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc', code: 'CHF' },
  INR: { symbol: '₹', name: 'Indian Rupee', code: 'INR' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', code: 'CNY' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', code: 'BRL' }
};

export const VAT_RATES = {
  'No VAT': 0,
  'UK - 20%': 0.20,
  'EU - 19% (DE)': 0.19,
  'EU - 21% (NL)': 0.21,
  'EU - 20% (FR)': 0.20,
  'EU - 22% (IT)': 0.22,
  'Canada - 5% (GST)': 0.05,
  'Canada - 13% (HST)': 0.13,
  'Australia - 10% (GST)': 0.10,
  'Custom Rate': 'custom'
};

export const formatCurrency = (amount: number, currencyCode: string = 'USD'): string => {
  const currency = CURRENCIES[currencyCode as keyof typeof CURRENCIES];
  if (!currency) return `$${amount.toFixed(2)}`;
  return `${currency.symbol}${amount.toFixed(2)}`;
};

export const formatCurrencyWithLocale = (amount: number, currencyCode: string = 'USD', locale: string = 'en-US'): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch (error) {
    // Fallback to simple format if locale/currency not supported
    return formatCurrency(amount, currencyCode);
  }
};
