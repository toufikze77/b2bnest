import React, { useEffect, useRef, memo } from 'react';

function TradingViewWidget() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      // Clear any existing content
      container.current.innerHTML = '';
      
      // Create the widget container
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container__widget';
      
      // Create the copyright div
      const copyrightDiv = document.createElement('div');
      copyrightDiv.className = 'tradingview-widget-copyright';
      const copyrightLink = document.createElement('a');
      copyrightLink.href = 'https://www.tradingview.com/';
      copyrightLink.rel = 'noopener nofollow';
      copyrightLink.target = '_blank';
      const copyrightSpan = document.createElement('span');
      copyrightSpan.className = 'blue-text';
      copyrightSpan.textContent = 'Market data by TradingView';
      copyrightLink.appendChild(copyrightSpan);
      copyrightDiv.appendChild(copyrightLink);
      
      // Create the script element
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
      script.async = true;
      script.innerHTML = `
        {
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
        }`;
      
      // Append elements to container
      container.current.appendChild(widgetContainer);
      container.current.appendChild(copyrightDiv);
      container.current.appendChild(script);
    }
  }, []);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ width: '400px', height: '550px' }}>
    </div>
  );
}

export default memo(TradingViewWidget);