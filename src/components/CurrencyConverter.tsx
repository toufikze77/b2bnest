import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, TrendingUp, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyData {
  code: string;
  name: string;
  symbol: string;
}

const CurrencyConverter = () => {
  const [amount, setAmount] = useState<string>('1');
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const currencies: CurrencyData[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩' }
  ];

  const fetchExchangeRates = async () => {
    setLoading(true);
    try {
      // Using exchangerate-api.com free tier
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      
      const data = await response.json();
      setExchangeRates(data.rates);
      setLastUpdated(new Date().toLocaleString());
      
      toast({
        title: "Exchange rates updated",
        description: "Latest currency rates have been fetched successfully.",
      });
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      toast({
        title: "Error fetching rates",
        description: "Unable to fetch the latest exchange rates. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRates();
  }, [fromCurrency]);

  useEffect(() => {
    if (exchangeRates[toCurrency] && amount) {
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount)) {
        setConvertedAmount(numAmount * exchangeRates[toCurrency]);
      }
    }
  }, [amount, toCurrency, exchangeRates]);

  const handleSwapCurrencies = () => {
    const tempFrom = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(tempFrom);
  };

  const formatCurrency = (value: number, currencyCode: string) => {
    const currency = currencies.find(c => c.code === currencyCode);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  const getExchangeRate = () => {
    if (exchangeRates[toCurrency]) {
      return exchangeRates[toCurrency];
    }
    return 0;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Currency Converter</h1>
        <p className="text-gray-600">
          Convert currencies using real-time exchange rates from reliable financial data sources.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Converter */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Currency Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Amount</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="text-lg"
                />
              </div>

              {/* Currency Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">From</label>
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSwapCurrencies}
                    className="h-10 w-10"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">To</label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conversion Result */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-2">
                    {amount} {fromCurrency} equals
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {formatCurrency(convertedAmount, toCurrency)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Exchange Rate: 1 {fromCurrency} = {getExchangeRate().toFixed(6)} {toCurrency}
                  </div>
                </div>
              </div>

              {/* Refresh Button */}
              <div className="flex justify-between items-center">
                <Button 
                  variant="outline" 
                  onClick={fetchExchangeRates}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Rates
                </Button>
                
                {lastUpdated && (
                  <p className="text-sm text-gray-500">
                    Last updated: {lastUpdated}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Popular Conversions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Popular Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['EUR', 'GBP', 'JPY', 'CAD', 'AUD'].map((currency) => (
                  <div key={currency} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">
                      1 {fromCurrency} → {currency}
                    </div>
                    <div className="text-sm font-semibold">
                      {exchangeRates[currency] ? exchangeRates[currency].toFixed(4) : 'Loading...'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Real-time exchange rates
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  20+ major currencies
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Accurate calculations
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Free to use
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverter;