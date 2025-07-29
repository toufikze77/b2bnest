import React, { memo } from 'react';

function TradingViewWidget() {
  const tradingViewHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          background: #0F0F0F;
        }
        .tradingview-widget-container {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
        }
        .tradingview-widget-container__widget {
          flex: 1;
        }
        .blue-text { color: #2962ff; }
      </style>
    </head>
    <body>
      <!-- TradingView Widget BEGIN -->
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
        <div class="tradingview-widget-copyright">
          <a href="https://www.tradingview.com/symbols/BITSTAMP-ETHUSD/?exchange=BITSTAMP" rel="noopener nofollow" target="_blank">
            <span class="blue-text">ETHUSD chart by TradingView</span>
          </a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
        {
          "allow_symbol_change": true,
          "calendar": false,
          "details": false,
          "hide_side_toolbar": true,
          "hide_top_toolbar": false,
          "hide_legend": false,
          "hide_volume": false,
          "hotlist": false,
          "interval": "D",
          "locale": "en",
          "save_image": true,
          "style": "1",
          "symbol": "BITSTAMP:ETHUSD",
          "theme": "dark",
          "timezone": "Etc/UTC",
          "backgroundColor": "#0F0F0F",
          "gridColor": "rgba(242, 242, 242, 0.06)",
          "watchlist": [],
          "withdateranges": false,
          "compareSymbols": [],
          "studies": [],
          "autosize": true
        }
        </script>
      </div>
      <!-- TradingView Widget END -->
    </body>
    </html>
  `;

  const encodedHTML = encodeURIComponent(tradingViewHTML);

  return (
    <iframe
      src={`data:text/html;charset=utf-8,${encodedHTML}`}
      style={{ 
        width: "100%", 
        height: "100%", 
        border: "none",
        background: "#0F0F0F"
      }}
      title="TradingView Chart"
    />
  );
}

export default memo(TradingViewWidget);