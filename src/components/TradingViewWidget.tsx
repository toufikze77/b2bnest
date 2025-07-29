import React, { useEffect, memo } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

function TradingViewWidget() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          "width": "100%",
          "height": "100%",
          "symbol": "BINANCE:BTCUSDT",
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "backgroundColor": "#0F0F0F",
          "gridColor": "rgba(242, 242, 242, 0.06)",
          "allow_symbol_change": true,
          "save_image": true,
          "calendar": false,
          "hide_side_toolbar": true,
          "hide_top_toolbar": false,
          "hide_legend": false,
          "hide_volume": false,
          "hotlist": false,
          "withdateranges": false,
          "details": false,
          "studies": [],
          "compareSymbols": [],
          "watchlist": [],
          "autosize": true,
          "container_id": "tradingview_widget"
        });
      }
    };
    
    document.head.appendChild(script);
    
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
      <div id="tradingview_widget" className="tradingview-widget-container__widget" style={{ height: "calc(100% - 32px)", width: "100%" }}></div>
      <div className="tradingview-widget-copyright">
        <a href="https://www.tradingview.com/symbols/BINANCE-BTCUSDT/?exchange=BINANCE" rel="noopener nofollow" target="_blank">
          <span className="blue-text">BTCUSDT chart by TradingView</span>
        </a>
      </div>
    </div>
  );
}

export default memo(TradingViewWidget);