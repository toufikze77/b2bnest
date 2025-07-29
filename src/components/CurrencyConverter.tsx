import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, TrendingUp, RefreshCw, Zap, Globe, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyData {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

const CurrencyConverter = () => {
  const [amount, setAmount] = useState<string>('1');
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isConverting, setIsConverting] = useState<boolean>(false);

  const currencies: CurrencyData[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$', flag: '🇲🇽' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' }
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
        title: "🚀 Exchange rates updated",
        description: "Latest currency rates have been fetched successfully.",
      });
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      toast({
        title: "❌ Error fetching rates",
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
      setIsConverting(true);
      const timer = setTimeout(() => {
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount)) {
          setConvertedAmount(numAmount * exchangeRates[toCurrency]);
        }
        setIsConverting(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [amount, toCurrency, exchangeRates]);

  const handleSwapCurrencies = () => {
    const tempFrom = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(tempFrom);
  };

  const formatCurrency = (value: number, currencyCode: string) => {
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

  const getCurrencyFlag = (code: string) => {
    return currencies.find(c => c.code === code)?.flag || '💱';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Hero Section */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="h-12 w-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-pulse">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Currency Converter
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Convert currencies instantly with real-time exchange rates from reliable financial data sources
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Converter */}
        <div className="lg:col-span-2 animate-fade-in">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Zap className="h-6 w-6" />
                Live Currency Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Amount Input */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amount
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="text-2xl font-bold h-14 border-2 focus:border-blue-500 transition-all duration-300 hover:border-blue-300"
                />
              </div>

              {/* Currency Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">From Currency</label>
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger className="h-12 border-2 hover:border-blue-300 transition-all duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{currency.flag}</span>
                            <span className="font-medium">{currency.code}</span>
                            <span className="text-muted-foreground">- {currency.name}</span>
                          </div>
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
                    className="h-12 w-12 border-2 hover:border-blue-500 hover:bg-blue-50 hover:scale-110 transition-all duration-300 group"
                  >
                    <ArrowUpDown className="h-5 w-5 group-hover:rotate-180 transition-transform duration-300" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">To Currency</label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger className="h-12 border-2 hover:border-blue-300 transition-all duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{currency.flag}</span>
                            <span className="font-medium">{currency.code}</span>
                            <span className="text-muted-foreground">- {currency.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conversion Result */}
              <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 p-8 rounded-2xl border-2 border-blue-100 animate-scale-in">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 animate-pulse"></div>
                <div className="relative text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-3">
                    <span className="text-xl">{getCurrencyFlag(fromCurrency)}</span>
                    <span>{amount} {fromCurrency} equals</span>
                    <span className="text-xl">{getCurrencyFlag(toCurrency)}</span>
                  </div>
                  <div className={`text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3 transition-all duration-500 ${isConverting ? 'scale-110 opacity-50' : 'scale-100 opacity-100'}`}>
                    {isConverting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      formatCurrency(convertedAmount, toCurrency)
                    )}
                  </div>
                  <div className="text-sm text-gray-500 bg-white/50 rounded-lg px-4 py-2 inline-block">
                    Exchange Rate: 1 {fromCurrency} = {getExchangeRate().toFixed(6)} {toCurrency}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <Button 
                  variant="outline" 
                  onClick={fetchExchangeRates}
                  disabled={loading}
                  className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-300"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Rates
                </Button>
                
                {lastUpdated && (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-1">
                    🕒 Updated: {lastUpdated.split(' ')[1]}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 animate-fade-in">
          {/* Popular Rates */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Popular Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {['EUR', 'GBP', 'JPY', 'CAD', 'AUD'].map((currency, index) => (
                  <div key={currency} className={`flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border hover:shadow-md transition-all duration-300 hover:scale-105 animate-fade-in`} style={{animationDelay: `${index * 100}ms`}}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getCurrencyFlag(currency)}</span>
                      <div className="font-medium">
                        <div className="text-sm text-gray-500">1 {fromCurrency}</div>
                        <div className="font-bold">{currency}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {exchangeRates[currency] ? exchangeRates[currency].toFixed(4) : (
                          <div className="animate-pulse w-16 h-4 bg-gray-200 rounded"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-lg">
              <CardTitle>✨ Features</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ul className="space-y-3">
                {[
                  { icon: '⚡', text: 'Real-time exchange rates' },
                  { icon: '🌍', text: '20+ major currencies' },
                  { icon: '🎯', text: 'Accurate calculations' },
                  { icon: '🆓', text: 'Free to use' },
                  { icon: '📱', text: 'Mobile responsive' },
                  { icon: '🔒', text: 'Secure & private' }
                ].map((feature, index) => (
                  <li key={index} className={`flex items-center gap-3 p-3 rounded-lg bg-white/50 hover:bg-white transition-all duration-300 hover:scale-105 animate-fade-in`} style={{animationDelay: `${index * 150}ms`}}>
                    <span className="text-lg">{feature.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
              <CardTitle>🚀 Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Button variant="outline" className="w-full justify-start hover:bg-orange-50 hover:border-orange-300 transition-all duration-300">
                <span className="mr-2">💰</span>
                Set Favorite Pairs
              </Button>
              <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 transition-all duration-300">
                <span className="mr-2">📊</span>
                View Rate History
              </Button>
              <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300 transition-all duration-300">
                <span className="mr-2">🔔</span>
                Rate Alerts
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverter;