import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Bitcoin, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  volume_24h: number;
  last_updated: string;
}

const CryptoPriceSidebar = () => {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const topCryptos = [
    'bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana', 
    'polkadot', 'dogecoin', 'avalanche-2', 'polygon', 'chainlink'
  ];

  const fetchCryptoData = async () => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${topCryptos.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch crypto data');
      }
      
      const data = await response.json();
      
      // Transform the data to match our interface
      const transformedData: CryptoData[] = Object.entries(data).map(([id, info]: [string, any]) => ({
        id,
        symbol: id.replace(/-2$/, '').toUpperCase(),
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
        current_price: info.usd,
        price_change_percentage_24h: info.usd_24h_change || 0,
        market_cap: info.usd_market_cap || 0,
        volume_24h: info.usd_24h_vol || 0,
        last_updated: new Date(info.last_updated_at * 1000).toISOString()
      }));
      
      setCryptoData(transformedData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch crypto prices');
      console.error('Crypto API error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptoData();
    
    // Update every 30 seconds
    const interval = setInterval(fetchCryptoData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price < 1) {
      return `$${price.toFixed(6)}`;
    }
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    }
    if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    }
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  };

  const getCryptoIcon = (symbol: string) => {
    switch (symbol.toLowerCase()) {
      case 'bitcoin':
      case 'btc':
        return <Bitcoin className="h-4 w-4 text-orange-500" />;
      case 'ethereum':
      case 'eth':
        return <Zap className="h-4 w-4 text-blue-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-green-500" />;
    }
  };

  if (loading) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            Crypto Prices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            Crypto Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500">
            <p>{error}</p>
            <button 
              onClick={fetchCryptoData}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 h-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5" />
            Crypto Prices
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            Live
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {cryptoData.map((crypto) => (
            <div 
              key={crypto.id}
              className="p-4 border-b border-border/50 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getCryptoIcon(crypto.symbol)}
                  <div>
                    <p className="font-medium text-sm">{crypto.symbol}</p>
                    <p className="text-xs text-muted-foreground">{crypto.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{formatPrice(crypto.current_price)}</p>
                  <div className="flex items-center gap-1">
                    {crypto.price_change_percentage_24h >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span 
                      className={`text-xs font-medium ${
                        crypto.price_change_percentage_24h >= 0 
                          ? 'text-green-500' 
                          : 'text-red-500'
                      }`}
                    >
                      {crypto.price_change_percentage_24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="block">Market Cap</span>
                  <span className="font-medium">{formatMarketCap(crypto.market_cap)}</span>
                </div>
                <div>
                  <span className="block">24h Volume</span>
                  <span className="font-medium">{formatMarketCap(crypto.volume_24h)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CryptoPriceSidebar;