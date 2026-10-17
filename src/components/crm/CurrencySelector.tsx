import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CURRENCIES } from '@/utils/currencyUtils';

interface CurrencySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** Extra codes to offer (e.g. currencies stored on deals but not in the standard list). */
  extraCodes?: string[];
  id?: string;
}

const CurrencySelector = ({ value, onValueChange, className, extraCodes = [], id }: CurrencySelectorProps) => {
  const extra = extraCodes.filter((c) => c && !(c in CURRENCIES));
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger id={id} className={className} aria-label={id ? undefined : 'Currency'}>
        <SelectValue placeholder="Choose a currency" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CURRENCIES).map(([code, currency]) => (
          <SelectItem key={code} value={code}>
            {currency.symbol} {currency.name} ({code})
          </SelectItem>
        ))}
        {extra.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
      </SelectContent>
    </Select>
  );
};

export default CurrencySelector;
