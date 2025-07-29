import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, TrendingUp, RefreshCw, Zap, Bitcoin, DollarSign, Activity } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CryptoPrices {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  icon: string;
}

const CryptoConverter = () => {
  const [amount, setAmount] = useState<string>('1');
  const [fromCrypto, setFromCrypto] = useState<string>('bitcoin');
  const [toCurrency, setToCurrency] = useState<string>('USD');
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrices>({});
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isConverting, setIsConverting] = useState<boolean>(false);

  const cryptos: CryptoData[] = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', icon: '₿' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', icon: 'Ξ' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', icon: '🔶' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', icon: '🅰️' },
    { id: 'solana', symbol: 'SOL', name: 'Solana', icon: '◎' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', icon: '💧' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', icon: '⚫' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', icon: '🐕' },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', icon: '🔺' },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', icon: '🔗' },
    { id: 'polygon', symbol: 'MATIC', name: 'Polygon', icon: '🟣' },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', icon: 'Ł' },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', icon: '🦄' },
    { id: 'stellar', symbol: 'XLM', name: 'Stellar', icon: '⭐' },
    { id: 'algorand', symbol: 'ALGO', name: 'Algorand', icon: '🔷' }
  ];

  const fiatCurrencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' }
  ];

  const fetchCryptoPrices = async () => {
    setLoading(true);
    try {
      const cryptoIds = cryptos.map(c => c.id).join(',');
      const supportedCurrencies = 'usd,eur,gbp,jpy,aud,cad,chf,cny';
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=${supportedCurrencies}&include_24hr_change=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch crypto prices');
      }
      
      const data = await response.json();
      setCryptoPrices(data);
      setLastUpdated(new Date().toLocaleString());
      
      toast({
        title: "🚀 Crypto prices updated",
        description: "Latest cryptocurrency prices have been fetched successfully.",
      });
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      toast({
        title: "❌ Error fetching prices",
        description: "Unable to fetch the latest crypto prices. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptoPrices();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCryptoPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cryptoPrices[fromCrypto] && amount) {
      setIsConverting(true);
      const timer = setTimeout(() => {
        const numAmount = parseFloat(amount);
        if (!isNaN(numAmount)) {
          const price = cryptoPrices[fromCrypto][toCurrency.toLowerCase()];
          if (price) {
            setConvertedAmount(numAmount * price);
          }
        }
        setIsConverting(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [amount, fromCrypto, toCurrency, cryptoPrices]);

  const handleSwapPair = () => {
    // For crypto to fiat, we'll just change to a different popular crypto
    const popularCryptos = ['bitcoin', 'ethereum', 'binancecoin'];
    const currentIndex = popularCryptos.indexOf(fromCrypto);
    const nextIndex = (currentIndex + 1) % popularCryptos.length;
    setFromCrypto(popularCryptos[nextIndex]);
  };

  const formatPrice = (value: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 8 : 2
    }).format(value);
  };

  const getCurrentPrice = () => {
    if (cryptoPrices[fromCrypto]) {
      return cryptoPrices[fromCrypto][toCurrency.toLowerCase()] || 0;
    }
    return 0;
  };

  const getPriceChange = () => {
    if (cryptoPrices[fromCrypto]) {
      return cryptoPrices[fromCrypto].usd_24h_change || 0;
    }
    return 0;
  };

  const getCryptoIcon = (id: string) => {
    return cryptos.find(c => c.id === id)?.icon || '🪙';
  };

  const getFiatFlag = (code: string) => {
    return fiatCurrencies.find(c => c.code === code)?.flag || '💰';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Hero Section */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="h-12 w-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center animate-pulse">
            <Bitcoin className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
            Crypto Converter
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Convert cryptocurrencies to fiat currencies with real-time prices from CoinGecko
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Converter */}
        <div className="lg:col-span-2 animate-fade-in">
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Zap className="h-6 w-6" />
                Live Crypto Conversion
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Amount Input */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Amount
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="text-2xl font-bold h-14 border-2 focus:border-orange-500 transition-all duration-300 hover:border-orange-300"
                />
              </div>

              {/* Crypto/Currency Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">From Cryptocurrency</label>
                  <Select value={fromCrypto} onValueChange={setFromCrypto}>
                    <SelectTrigger className="h-12 border-2 hover:border-orange-300 transition-all duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {cryptos.map((crypto) => (
                        <SelectItem key={crypto.id} value={crypto.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{crypto.icon}</span>
                            <span className="font-medium">{crypto.symbol}</span>
                            <span className="text-muted-foreground">- {crypto.name}</span>
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
                    onClick={handleSwapPair}
                    className="h-12 w-12 border-2 hover:border-orange-500 hover:bg-orange-50 hover:scale-110 transition-all duration-300 group"
                  >
                    <ArrowUpDown className="h-5 w-5 group-hover:rotate-180 transition-transform duration-300" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700">To Fiat Currency</label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger className="h-12 border-2 hover:border-orange-300 transition-all duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fiatCurrencies.map((currency) => (
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
              <div className="relative overflow-hidden bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 p-8 rounded-2xl border-2 border-orange-100 animate-scale-in">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-yellow-500/5 animate-pulse"></div>
                <div className="relative text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-3">
                    <span className="text-xl">{getCryptoIcon(fromCrypto)}</span>
                    <span>{amount} {cryptos.find(c => c.id === fromCrypto)?.symbol} equals</span>
                    <span className="text-xl">{getFiatFlag(toCurrency)}</span>
                  </div>
                  <div className={`text-4xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent mb-3 transition-all duration-500 ${isConverting ? 'scale-110 opacity-50' : 'scale-100 opacity-100'}`}>
                    {isConverting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      formatPrice(convertedAmount, toCurrency)
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-sm text-gray-500 bg-white/50 rounded-lg px-4 py-2">
                      Current Price: {formatPrice(getCurrentPrice(), toCurrency)}
                    </div>
                    <div className={`text-sm px-3 py-1 rounded-lg ${getPriceChange() >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      24h: {getPriceChange() >= 0 ? '+' : ''}{getPriceChange().toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <Button 
                  variant="outline" 
                  onClick={fetchCryptoPrices}
                  disabled={loading}
                  className="flex items-center gap-2 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Prices
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
          {/* Top Cryptos */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Cryptos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana'].map((cryptoId, index) => {
                  const crypto = cryptos.find(c => c.id === cryptoId);
                  const price = cryptoPrices[cryptoId]?.usd;
                  const change = cryptoPrices[cryptoId]?.usd_24h_change;
                  
                  return (
                    <div key={cryptoId} className={`flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border hover:shadow-md transition-all duration-300 hover:scale-105 animate-fade-in cursor-pointer`} 
                         style={{animationDelay: `${index * 100}ms`}}
                         onClick={() => setFromCrypto(cryptoId)}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{crypto?.icon}</span>
                        <div>
                          <div className="font-bold text-sm">{crypto?.symbol}</div>
                          <div className="text-xs text-gray-500">{crypto?.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {price ? formatPrice(price, 'USD') : (
                            <div className="animate-pulse w-16 h-4 bg-gray-200 rounded"></div>
                          )}
                        </div>
                        {change !== undefined && (
                          <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-lg">
              <CardTitle>✨ Features</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ul className="space-y-3">
                {[
                  { icon: '⚡', text: 'Real-time crypto prices' },
                  { icon: '🔄', text: 'Auto-refresh every 30s' },
                  { icon: '📊', text: '24h price changes' },
                  { icon: '🌍', text: 'Multiple fiat currencies' },
                  { icon: '🪙', text: '15+ cryptocurrencies' },
                  { icon: '🆓', text: 'Free to use' }
                ].map((feature, index) => (
                  <li key={index} className={`flex items-center gap-3 p-3 rounded-lg bg-white/50 hover:bg-white transition-all duration-300 hover:scale-105 animate-fade-in`} style={{animationDelay: `${index * 150}ms`}}>
                    <span className="text-lg">{feature.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Market Info */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg">
              <CardTitle>📈 Market Info</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Market Status</div>
                <div className="text-lg font-bold text-green-600 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:border-green-300 transition-all duration-300">
                <span className="mr-2">📊</span>
                View Charts
              </Button>
              <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:border-blue-300 transition-all duration-300">
                <span className="mr-2">🔔</span>
                Price Alerts
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CryptoConverter;