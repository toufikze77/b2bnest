import React, { useState, useEffect } from 'react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Line, Bar, Tooltip, ReferenceLine } from 'recharts';

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
}

interface CandlestickChartProps {
  symbol: string;
  type: 'crypto' | 'forex';
  title: string;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ symbol, type, title }) => {
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);

  const fetchCryptoData = async () => {
    try {
      // Get current price
      const priceResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`
      );
      const priceData = await priceResponse.json();
      
      if (priceData[symbol]) {
        setCurrentPrice(priceData[symbol].usd);
        setChange24h(priceData[symbol].usd_24h_change || 0);
      }

      // Get OHLC data
      const ohlcResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${symbol}/ohlc?vs_currency=usd&days=1`
      );
      const ohlcData = await ohlcResponse.json();
      
      if (Array.isArray(ohlcData)) {
        const formattedData = ohlcData.slice(-24).map((item: number[], index: number) => {
          const [timestamp, open, high, low, close] = item;
          const date = new Date(timestamp);
          const change = index > 0 ? ((close - open) / open) * 100 : 0;
          
          return {
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            open,
            high,
            low,
            close,
            volume: Math.random() * 1000000, // Volume not available in free API
            change
          };
        });
        setData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      // Generate mock data for demonstration
      generateMockData();
    }
  };

  const fetchForexData = async () => {
    try {
      const response = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD'
      );
      const data = await response.json();
      
      // Generate simulated forex candlestick data
      const rate = data.rates[symbol.split('/')[1]] || 1;
      setCurrentPrice(1 / rate);
      setChange24h((Math.random() - 0.5) * 2);
      
      generateMockForexData(1 / rate);
    } catch (error) {
      console.error('Error fetching forex data:', error);
      generateMockForexData();
    }
  };

  const generateMockData = () => {
    const mockData: CandleData[] = [];
    let basePrice = type === 'crypto' ? 45000 : 1.1;
    
    for (let i = 0; i < 24; i++) {
      const time = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      const volatility = type === 'crypto' ? 0.02 : 0.001;
      
      const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
      const close = open * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
      const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);
      const change = ((close - open) / open) * 100;
      
      mockData.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000000,
        change
      });
      
      basePrice = close;
    }
    
    setData(mockData);
    setCurrentPrice(basePrice);
    setChange24h((mockData[mockData.length - 1].close - mockData[0].open) / mockData[0].open * 100);
  };

  const generateMockForexData = (baseRate = 1.1) => {
    const mockData: CandleData[] = [];
    let currentRate = baseRate;
    
    for (let i = 0; i < 24; i++) {
      const time = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      const volatility = 0.001;
      
      const open = currentRate * (1 + (Math.random() - 0.5) * volatility);
      const close = open * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
      const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);
      const change = ((close - open) / open) * 100;
      
      mockData.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        open,
        high,
        low,
        close,
        volume: Math.random() * 10000,
        change
      });
      
      currentRate = close;
    }
    
    setData(mockData);
    setCurrentPrice(currentRate);
  };

  useEffect(() => {
    setLoading(true);
    if (type === 'crypto') {
      fetchCryptoData();
    } else {
      fetchForexData();
    }
    setLoading(false);

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (type === 'crypto') {
        fetchCryptoData();
      } else {
        fetchForexData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [symbol, type]);

  const refreshData = () => {
    setLoading(true);
    if (type === 'crypto') {
      fetchCryptoData();
    } else {
      fetchForexData();
    }
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    if (type === 'crypto') {
      return price >= 1 ? `$${price.toLocaleString()}` : `$${price.toFixed(6)}`;
    }
    return price.toFixed(4);
  };

  const CandlestickBar = ({ payload, x, y, width, height }: any) => {
    if (!payload) return null;
    
    const { open, high, low, close } = payload;
    const isGreen = close > open;
    const color = isGreen ? '#10b981' : '#ef4444';
    
    const bodyHeight = Math.abs(close - open) * height / (payload.high - payload.low);
    const bodyY = y + (Math.max(high - Math.max(open, close)) * height / (high - low));
    
    return (
      <g>
        {/* Wick */}
        <line
          x1={x + width / 2}
          y1={y}
          x2={x + width / 2}
          y2={y + height}
          stroke={color}
          strokeWidth={1}
        />
        {/* Body */}
        <rect
          x={x + width * 0.25}
          y={bodyY}
          width={width * 0.5}
          height={bodyHeight || 1}
          fill={color}
          stroke={color}
        />
      </g>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{title}</span>
            <div className="animate-spin">
              <RefreshCw className="h-4 w-4" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-muted/50 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {title}
            <Badge variant={change24h >= 0 ? "default" : "destructive"} className="ml-2">
              {change24h >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {change24h.toFixed(2)}%
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-bold">{formatPrice(currentPrice)}</div>
              <div className="text-sm text-muted-foreground">Current Price</div>
            </div>
            <Button variant="outline" size="sm" onClick={refreshData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={['dataMin', 'dataMax']}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={formatPrice}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-medium mb-2">{label}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Open:</span>
                            <span>{formatPrice(data.open)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">High:</span>
                            <span className="text-green-600">{formatPrice(data.high)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Low:</span>
                            <span className="text-red-600">{formatPrice(data.low)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Close:</span>
                            <span>{formatPrice(data.close)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Change:</span>
                            <span className={data.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {data.change.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="high" 
                fill="transparent" 
                shape={<CandlestickBar />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default CandlestickChart;