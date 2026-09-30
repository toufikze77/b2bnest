# Crypto content retirement — 2026-09-30 (preview only)

## Removed
Pages/routes: /fundraising, /whitepaper, /tokenomics, /live-charts (Market), /business-news.
Components: TokenSEO, TradingViewWidget, BusinessNewsSection, CryptoConverter, charts/CandlestickChart, checkout/SolanaPayCheckout, checkout/CoinbaseCheckout, sidebars/* (crypto/forex live price panels), fundraising/* (presale, token info, community, exchange/market expansion, crypto payment).
Hooks: useLivePrices, useWeb3Wallet.
Assets: public/logos/* (exchange/wallet logos), 20 crypto promo images in src/assets/tweets.
Links/content: footer "Invest" section; Header price sidebar; AI Showcase "investment opportunity" CTA; Getting Started fundraising bullet; Marketing Materials token wording; "Pay with Crypto" option in the payment picker; Crypto Converter tool + search keyword + JSON-LD entry; crypto payment template listing.
SEO: sitemap entries (5), RouteMeta /business-news, index.html FAQ, BusinessToolsSEO, llms.txt rewritten (SaaS-only, 25+ tools, £19/£35/£85 monthly).
Moved: VideoTutorialSection → components/media (used by About; title de-crypto'd).

## Preserved
supabase/functions/shared/crypto.ts, token-refresh, OAuth/AI-credit tokens, Stripe, HMRC, tenant isolation, auth, ROI calculator, currency converter.

## Retired URL status — hosting blocker
Lovable hosting serves index.html with HTTP 200 for all paths and offers no per-path status or redirect rules, so 410/404 cannot be returned. Retired URLs (incl. trailing slash / query string) render the 404 page with `robots: noindex`. robots.txt unchanged (no blocking).

## Pending authorization
news_articles: 7,388 rows (4,711 crypto-related) fed by fetch-news cron — no longer shown anywhere; deletion + cron/function removal needs approval. create-coinbase-charge edge function now unused. forum_posts and storage: no crypto content found.

## Checks
Build OK; typecheck clean; browser: 5 retired URLs render 404 + noindex, /, /about, /pricing, /business-tools load with no crypto nav links and no page errors. Post-publish checks pending.
