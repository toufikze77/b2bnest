import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Globe, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ForexRate {
  pair: string;
  rate: number;
  change: number;
  changePercent: number;
  lastUpdate: string;
}

const ForexPriceSidebar = () => {
  const [forexData, setForexData] = useState<ForexRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Major forex pairs
  const forexPairs = [
    { pair: 'EUR/USD', from: 'EUR', to: 'USD' },
    { pair: 'GBP/USD', from: 'GBP', to: 'USD' },
    { pair: 'USD/JPY', from: 'USD', to: 'JPY' },
    { pair: 'USD/CHF', from: 'USD', to: 'CHF' },
    { pair: 'AUD/USD', from: 'AUD', to: 'USD' },
    { pair: 'USD/CAD', from: 'USD', to: 'CAD' },
    { pair: 'NZD/USD', from: 'NZD', to: 'USD' },
    { pair: 'EUR/GBP', from: 'EUR', to: 'GBP' }
  ];

  const fetchForexData = async () => {
    try {
      // Using exchangerate-api.com which provides free forex rates
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      
      if (!response.ok) {
        throw new Error('Failed to fetch forex data');
      }
      
      const data = await response.json();
      
      // Calculate rates for our pairs
      const rates: ForexRate[] = forexPairs.map(({ pair, from, to }) => {
        let rate: number;
        
        if (from === 'USD') {
          rate = data.rates[to];
        } else if (to === 'USD') {
          rate = 1 / data.rates[from];
        } else {
          // Cross currency: EUR/GBP = EUR/USD / GBP/USD
          rate = (1 / data.rates[from]) / (1 / data.rates[to]);
        }
        
        // Simulate price changes (in real app, you'd store previous values)
        const change = (Math.random() - 0.5) * 0.01;
        const changePercent = (change / rate) * 100;
        
        return {
          pair,
          rate,
          change,
          changePercent,
          lastUpdate: data.date
        };
      });
      
      setForexData(rates);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to fetch forex rates');
      console.error('Forex API error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForexData();
    
    // Update every 60 seconds (forex markets are less volatile)
    const interval = setInterval(fetchForexData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const formatRate = (rate: number, pair: string) => {
    if (pair.includes('JPY')) {
      return rate.toFixed(3);
    }
    return rate.toFixed(5);
  };

  const getCurrencyFlag = (currency: string) => {
    const flags: Record<string, string> = {
      USD: '🇺🇸',
      EUR: '🇪🇺',
      GBP: '🇬🇧',
      JPY: '🇯🇵',
      CHF: '🇨🇭',
      AUD: '🇦🇺',
      CAD: '🇨🇦',
      NZD: '🇳🇿'
    };
    
    const [from, to] = currency.split('/');
    return `${flags[from] || '💱'} ${flags[to] || '💱'}`;
  };

  if (loading) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Forex Rates
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
            <Globe className="h-5 w-5" />
            Forex Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500">
            <p>{error}</p>
            <button 
              onClick={fetchForexData}
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
            <Globe className="h-5 w-5" />
            Forex Rates
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
          {forexData.map((forex) => (
            <div 
              key={forex.pair}
              className="p-4 border-b border-border/50 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCurrencyFlag(forex.pair)}</span>
                  <div>
                    <p className="font-medium text-sm">{forex.pair}</p>
                    <p className="text-xs text-muted-foreground">
                      {forex.pair.replace('/', ' to ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{formatRate(forex.rate, forex.pair)}</p>
                  <div className="flex items-center gap-1">
                    {forex.changePercent >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span 
                      className={`text-xs font-medium ${
                        forex.changePercent >= 0 
                          ? 'text-green-500' 
                          : 'text-red-500'
                      }`}
                    >
                      {forex.changePercent.toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span 
                    className={`font-medium ${
                      forex.change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {forex.change >= 0 ? '+' : ''}{forex.change.toFixed(5)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ForexPriceSidebar;