import { useState, useEffect, useCallback } from 'react';

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  lastUpdate: Date;
}

export interface CryptoPriceData extends PriceData {
  marketCap: number;
  volume24h: number;
}

export interface ForexPriceData extends PriceData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
}

interface UseLivePricesReturn {
  cryptoData: CryptoPriceData[];
  forexData: ForexPriceData[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

export const useLivePrices = (autoRefreshInterval = 30000): UseLivePricesReturn => {
  const [cryptoData, setCryptoData] = useState<CryptoPriceData[]>([]);
  const [forexData, setForexData] = useState<ForexPriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  const fetchCryptoData = useCallback(async () => {
    try {
      const cryptoSymbols = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana', 'polkadot'];
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoSymbols.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch crypto data');
      }
      
      const data = await response.json();
      
      const transformedData: CryptoPriceData[] = Object.entries(data).map(([id, info]: [string, any]) => ({
        symbol: id.toUpperCase(),
        price: info.usd,
        change24h: info.usd_24h_change || 0,
        changePercent24h: info.usd_24h_change || 0,
        marketCap: info.usd_market_cap || 0,
        volume24h: info.usd_24h_vol || 0,
        lastUpdate: new Date()
      }));
      
      setCryptoData(transformedData);
    } catch (err) {
      console.error('Error fetching crypto data:', err);
      throw err;
    }
  }, []);

  const fetchForexData = useCallback(async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      
      if (!response.ok) {
        throw new Error('Failed to fetch forex data');
      }
      
      const data = await response.json();
      
      const majorPairs = [
        { pair: 'EUR/USD', base: 'EUR', quote: 'USD' },
        { pair: 'GBP/USD', base: 'GBP', quote: 'USD' },
        { pair: 'USD/JPY', base: 'USD', quote: 'JPY' },
        { pair: 'AUD/USD', base: 'AUD', quote: 'USD' },
        { pair: 'USD/CAD', base: 'USD', quote: 'CAD' },
        { pair: 'USD/CHF', base: 'USD', quote: 'CHF' }
      ];
      
      const transformedData: ForexPriceData[] = majorPairs.map(({ pair, base, quote }) => {
        let price: number;
        
        if (base === 'USD') {
          price = data.rates[quote];
        } else {
          price = 1 / data.rates[base];
        }
        
        // Simulate change data (in production, you'd store previous values)
        const change = (Math.random() - 0.5) * 0.01;
        const changePercent = (change / price) * 100;
        
        // Simulate bid/ask spread
        const spread = price * 0.0001; // 0.01% spread
        const bid = price - spread / 2;
        const ask = price + spread / 2;
        
        return {
          symbol: pair,
          pair,
          price,
          change24h: change,
          changePercent24h: changePercent,
          bid,
          ask,
          spread,
          lastUpdate: new Date()
        };
      });
      
      setForexData(transformedData);
    } catch (err) {
      console.error('Error fetching forex data:', err);
      throw err;
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([fetchCryptoData(), fetchForexData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price data');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCryptoData, fetchForexData]);

  const refreshData = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  const startAutoRefresh = useCallback(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    
    const timer = setInterval(fetchAllData, autoRefreshInterval);
    setRefreshTimer(timer);
    
    return () => clearInterval(timer);
  }, [fetchAllData, autoRefreshInterval, refreshTimer]);

  const stopAutoRefresh = useCallback(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      setRefreshTimer(null);
    }
  }, [refreshTimer]);

  useEffect(() => {
    fetchAllData();
    const cleanup = startAutoRefresh();
    
    return () => {
      cleanup?.();
      stopAutoRefresh();
    };
  }, []);

  return {
    cryptoData,
    forexData,
    isLoading,
    error,
    refreshData,
    startAutoRefresh,
    stopAutoRefresh
  };
};