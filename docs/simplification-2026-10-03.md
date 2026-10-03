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
