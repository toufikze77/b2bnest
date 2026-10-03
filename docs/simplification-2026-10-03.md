# Simplification round — 2026-10-03 (preview, unpublished)

AI cost test: COMPLETE and CLEANED UP (function, OPENAI_STAGING_KEY, lock table removed). Customer AI generation stays disabled; larger AI migration not applied; no further paid calls.

## Changes
1. AI Workspace: removed from sidebar, top bar, command search, header menus, site search, welcome tour. `/ai-workspace` redirects to `/ai-studio`. Page file kept; `ai_workspaces` data untouched (3 rows, 1 user).
2. Workflow Studio audit (live data read 2026-10-03): 6 saved workflows, 1 user, 0 run logs. No step in any saved workflow is runnable (Client Signup, Generate Contracts, Payment Check, …). No trigger ever started automatically (no scheduler/webhook/database listener exists). The old "Test Run" only called 4 server functions (email via Gmail SMTP, X, LinkedIn, WhatsApp/Twilio); every other step did nothing yet showed "executed successfully". Rewritten as "When I click Run now → Do this" with only those 4 steps; per-step real results; old workflows listed as "can't run", left unchanged until the user saves. Old canvas components deleted. AI Studio's Workflow Builder tab (saved but never ran) replaced by a link. Retirement decision for old workflows: owner's call.
3. Template Centre: "Need something specific? / Request a template" removed.
4. Pricing: current plan button disabled "Your current plan" (only when a paid subscription exists — the old code wrongly marked Starter as current for free users). Subscribers see "Switch to X"; new server function `change-subscription-plan` updates the single existing Stripe subscription item (prorated), refuses if none, more than one, or same plan. Never creates a subscription. Existing webhook syncs the tier. Known limit: same-tier monthly↔annual switch is blocked in the UI (use Manage billing).
5. Help/Knowledge base/Workflows guide/assistant: workflow, plan-change and payment answers rewritten; crypto payment mentions removed.

## Tests
- Real services: change-subscription-plan deployed live; unsigned request → 401. Live data read for the workflow audit.
- Mocked/no services: 110/110 app tests (4 new workflow tests); typecheck clean; signed-out browser checks (redirect, no request link, pricing buttons, guide).
- NOT tested: an actual plan switch on Stripe; a real Workflows run; signed-in screens.

Seats review (Starter 1 / Professional 25 / Enterprise 50): separate, not started; no entitlement changes.

## Release review follow-up (2026-10-03, ~01:00 UTC)
- Legacy workflows: the 6 old workflows show as "Archived · Can't run", read-only (no edit, save, run or delete). "Create a working workflow" starts a separate new workflow. No data converted or deleted; no database change.
- Claims removed (no documented evidence): pricing "8,200+ businesses", "180% YoY growth", "SOC 2 compliant", "Join thousands…", nonprofit 50% discount, "Advanced security controls"; homepage testimonials section (names/quotes unverified) hidden; "Save 10+ hours/week", "25+ steps", "10+ services"; About "thousands of businesses"; Knowledge base view counts; SEO "50+/20+/30+ tools", fake 4.8 rating / 150 reviews structured data, "$9.99/month" (now £19); Security guide AES-256 / TLS 1.3 / pen-testing / daily backups / SOC 2 / "fully GDPR compliant" replaced with verifiable statements; Help security answer rewritten; "GDPR compliant" badges → "Covers GDPR topics"; llms.txt counts; AI Showcase investor page (unsupported "100%" claims) redirected to /ai-studio and unlinked. Not changed: feature lists on plan cards (e.g. SLA, white-label, mobile app) — need owner review; sample template ratings in src/data.
- Plan switching: function rewritten (handler.ts) with preview mode (Stripe upcoming invoice → proration shown before confirm), required request id used as Stripe idempotency key, proration_behavior always_invoice + payment_behavior pending_if_incomplete (failed payment keeps the old price), refuses none/multiple/same plan, never creates a subscription. Client lock prevents repeat clicks. Webhook already syncs customer.subscription.updated → tier/credits.
- Tests run: 9/9 Deno tests with a stand-in Stripe (one subscription remains, right monthly/annual price, preview changes nothing, 3 simultaneous identical requests → 1 change, failed payment keeps plan, none/multiple refused); 113/113 app tests incl. 4 workflow execution tests with a stand-in server (only 4 actions offered; success only when the server confirms; errors/throws/WhatsApp failures shown as failures; nothing sent); typecheck clean; signed-out browser scan of /, /pricing, /ai-showcase.
- NOT done: Stripe sandbox verification — the project holds only the live Stripe key; no sandbox key is configured. Webhook sync of a plan change not exercised end to end.
- Live infrastructure: `change-subscription-plan` deployed to the live Supabase project (twice today; signed-out → 401). No other function deployed; no database change; frontend unpublished.
