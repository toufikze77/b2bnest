import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      // Clear any existing content
      const widgetContainer = containerRef.current.querySelector('.tradingview-widget-container__widget');
      if (widgetContainer) {
        widgetContainer.innerHTML = '';
      }

      // Create script element
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
      script.async = true;
      
      script.innerHTML = JSON.stringify({
        "colorTheme": "dark",
        "dateRange": "12M",
        "locale": "en",
        "largeChartUrl": "",
        "isTransparent": false,
        "showFloatingTooltip": false,
        "plotLineColorGrowing": "rgba(41, 98, 255, 1)",
        "plotLineColorFalling": "rgba(41, 98, 255, 1)",
        "gridLineColor": "rgba(240, 243, 250, 0)",
        "scaleFontColor": "#DBDBDB",
        "belowLineFillColorGrowing": "rgba(41, 98, 255, 0.12)",
        "belowLineFillColorFalling": "rgba(41, 98, 255, 0.12)",
        "belowLineFillColorGrowingBottom": "rgba(41, 98, 255, 0)",
        "belowLineFillColorFallingBottom": "rgba(41, 98, 255, 0)",
        "symbolActiveColor": "rgba(41, 98, 255, 0.12)",
        "tabs": [
          {
            "title": "Indices",
            "symbols": [
              {
                "s": "FOREXCOM:SPXUSD",
                "d": "S&P 500 Index"
              },
              {
                "s": "FOREXCOM:NSXUSD",
                "d": "US 100 Cash CFD"
              },
              {
                "s": "FOREXCOM:DJI",
                "d": "Dow Jones Industrial Average Index"
              },
              {
                "s": "INDEX:NKY",
                "d": "Japan 225"
              },
              {
                "s": "INDEX:DEU40",
                "d": "DAX Index"
              },
              {
                "s": "FOREXCOM:UKXGBP",
                "d": "FTSE 100 Index"
              },
              {
                "s": "BINANCE:BTCUSDT",
                "d": "BTC",
                "base-currency-logoid": "crypto/XTVCBTC",
                "currency-logoid": "crypto/XTVCUSDT"
              },
              {
                "s": "BITSTAMP:ETHUSD",
                "d": "ETH",
                "base-currency-logoid": "crypto/XTVCETH",
                "currency-logoid": "country/US"
              },
              {
                "s": "BINANCE:XRPUSDT",
                "d": "XRP",
                "base-currency-logoid": "crypto/XTVCXRP",
                "currency-logoid": "crypto/XTVCUSDT"
              },
              {
                "s": "COINBASE:SOLUSD",
                "d": "SOL",
                "base-currency-logoid": "crypto/XTVCSOL",
                "currency-logoid": "country/US"
              },
              {
                "s": "CRYPTOCAP:ADA",
                "d": "ADA",
                "logoid": "crypto/XTVCADA",
                "currency-logoid": "country/US"
              }
            ],
            "originalTitle": "Indices"
          },
          {
            "title": "Futures",
            "symbols": [
              {
                "s": "BMFBOVESPA:ISP1!",
                "d": "S&P 500"
              },
              {
                "s": "BMFBOVESPA:EUR1!",
                "d": "Euro"
              },
              {
                "s": "CMCMARKETS:GOLD",
                "d": "Gold"
              },
              {
                "s": "PYTH:WTI3!",
                "d": "WTI Crude Oil"
              },
              {
                "s": "BMFBOVESPA:CCM1!",
                "d": "Corn"
              }
            ],
            "originalTitle": "Futures"
          },
          {
            "title": "Bonds",
            "symbols": [
              {
                "s": "EUREX:FGBL1!",
                "d": "Euro Bund"
              },
              {
                "s": "EUREX:FBTP1!",
                "d": "Euro BTP"
              },
              {
                "s": "EUREX:FGBM1!",
                "d": "Euro BOBL"
              }
            ],
            "originalTitle": "Bonds"
          },
          {
            "title": "Forex",
            "symbols": [
              {
                "s": "FX:EURUSD",
                "d": "EUR to USD"
              },
              {
                "s": "FX:GBPUSD",
                "d": "GBP to USD"
              },
              {
                "s": "FX:USDJPY",
                "d": "USD to JPY"
              },
              {
                "s": "FX:USDCHF",
                "d": "USD to CHF"
              },
              {
                "s": "FX:AUDUSD",
                "d": "AUD to USD"
              },
              {
                "s": "FX:USDCAD",
                "d": "USD to CAD"
              }
            ],
            "originalTitle": "Forex"
          }
        ],
        "support_host": "https://www.tradingview.com",
        "backgroundColor": "#131722",
        "width": "400",
        "height": "550",
        "showSymbolLogo": true,
        "showChart": true
      });

      // Append script to the widget container
      const widgetDiv = containerRef.current.querySelector('.tradingview-widget-container__widget');
      if (widgetDiv) {
        widgetDiv.appendChild(script);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-16 z-40 w-[400px] h-[calc(100vh-4rem)] bg-[#131722] border-l border-border shadow-xl transition-transform duration-300 transform translate-x-0">
      <div className="flex items-center justify-between p-4 border-b border-border bg-[#131722]">
        <h2 className="text-lg font-semibold text-white">Live Market Data</h2>
        <button 
          onClick={onClose}
          className="h-8 w-8 p-0 text-white hover:bg-white/10 rounded-md flex items-center justify-center"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div ref={containerRef} className="tradingview-widget-container w-full h-full">
        <div className="tradingview-widget-container__widget w-full h-full"></div>
        <div className="tradingview-widget-copyright p-2 text-center">
          <a 
            href="https://www.tradingview.com/" 
            rel="noopener nofollow" 
            target="_blank"
            className="text-blue-400 hover:text-blue-300"
          >
            <span>Market data by TradingView</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TradingViewWidget;