# Phase 20: AI Studio cleanup and honesty (prepared)

**Status: prepared, not applied or deployed.** The SQL, the functions and the frontend all wait for the owner.

## The credit design: reserve, then refund

`ai-assistant` takes one credit with `public.check_and_deduct_ai_credit` before the model is called. This was already the case, and is kept on purpose. That function locks the subscriber row (`FOR UPDATE`), so requests made at the same time are counted one after another, and the balance can never go below zero or past the monthly limit.

What was missing was the second half: giving the credit back when no answer is delivered. Phase 20 adds `public.refund_ai_credit` and calls it **once** when any of these happens:
- OpenAI fails;
- OpenAI returns a non-OK status;
- the request times out;
- the reply can't be read;
- the reply is empty.

A delivered answer is never refunded, so one answer never costs two credits.

**Why not "call the model first, charge afterwards"?** At the limit, several requests sent at the same time would all reach OpenAI. Only one could then be charged, so either the others are thrown away (paid for at OpenAI, then refused) or they get through uncharged. Reserving first stops this before the model is called.

`business-insights` (Intelligent Analytics) **has never taken credits**: it doesn't call `check_and_deduct_ai_credit`. It still doesn't. Charging for it would change what users pay, which this phase must not do.

## Files

| File | What it does |
| --- | --- |
| `proposal.sql` | Creates `public.refund_ai_credit(p_user_id uuid, p_credits integer default 1)`. It is `SECURITY DEFINER`, uses `SET search_path = ''`, and is callable **only by the service role**: EXECUTE is revoked from PUBLIC, anon and authenticated, and the body also refuses any other caller. It locks the row, never raises the balance above `ai_credits_limit`, never lowers a balance that is already above the limit, and returns how many credits were actually given back. One transaction. A guard refuses to apply if the live `check_and_deduct_ai_credit` body differs from the one read in production on 29 Oct 2026 (md5 `c19946704eca6184e29581d8fb5bb26e`), or if `refund_ai_credit` already exists. `check_and_deduct_ai_credit` itself is **not changed**. |
| `rollback.sql` | Drops `refund_ai_credit`. Nothing else needs restoring. |
| `fixture-live.sql` | `check_and_deduct_ai_credit` copied verbatim from production, and the subscriber columns it uses. |
| `test.sql` | 20 checks (see below). |
| `run-test.sh` | Runs everything on a throwaway local Postgres 16 (port 55444). |

`test.sql` checks:
- **Grants:** only `service_role` can execute the function; signed-in users and anon get "permission denied".
- **Normal use:** reserving then refunding leaves the balance unchanged.
- **Limits:**
  - a refund never goes above the limit;
  - a balance already above the limit is never lowered;
  - a refund after the monthly reset stops at the limit;
  - an empty balance refuses the deduct.
- **Bad input:** invalid amounts are refused; a missing subscriber row gives nothing and creates nothing.
- **Isolation:** another user's balance is untouched.
- **Rollback:** after rollback, the live function is unchanged.

`run-test.sh` (from the repo root: `PG_RUN_USER=postgres bash docs/phase20/run-test.sh`) runs:
1. every earlier suite **unchanged**, through `docs/phase15/run-test.sh` (Phases 12, 12b, 12c, 13 and 15);
2. `test.sql`;
3. the guards: re-apply after rollback, a second apply is refused, and a changed `check_and_deduct_ai_credit` is refused with nothing applied;
4. **concurrency**: 20 requests at once from 20 connections against 5 credits, with every other one "failing" and refunding. The end balance is never negative, it always equals 5 − reservations + refunds, and no more reservations succeed than there were credits.

### A known result in the earlier suites (unchanged by Phase 20)
`docs/phase13/run-test.sh` runs Phase 12's test with Phases 12b, 12c and 13 applied on top. In that combined run, two of Phase 12's checks fail:
- "every other profile field still saves";
- "UPDATE on all 28 others".

The reason is that Phase 12c deliberately removes `UPDATE` on `profiles.is_active`, but Phase 12's own test still counts it among the "other" columns. The result is the same on `main` without any Phase 20 files. Phase 12's own suite (`docs/phase12/run-test.sh`) passes 81 of 81.

## Deploy order (owner, after review)

1. **Apply `proposal.sql`** in the SQL editor.
2. **Deploy the functions**:

   | Function | Flattened files |
   | --- | --- |
   | `ai-assistant` | `handler.ts, index.ts, knowledge.ts, shared_access.ts, shared_ai-limits.ts, shared_plans.ts, shared_workflow-access.ts` |
   | `business-insights` | `handler.ts, index.ts, shared_access.ts, shared_ai-limits.ts` |

   Produce the files with `node scripts/flatten-function.mjs <name>`, or run `supabase functions deploy <name>`.
3. **Publish the frontend.**

**If the order is wrong:**
- **Functions before the SQL:** answers work as normal. When OpenAI fails, the refund call fails too (the function is missing). The user is told: "We couldn't give the credit back automatically; contact us…". The credit is lost, as it is today; nothing worse happens.
- **Frontend before the functions:** the Analytics screen sends the user's chosen industry and stage, and the old function accepts them. Errors still show the old function's text (for example "OpenAI API error"), and the "credits left" line doesn't appear unless the old function sends it (it does send `credits_remaining`). Old `business-insights` may still save a made-up fallback analysis; the screen now labels such rows "This older result couldn't be read."

**Rollback:** redeploy the previous functions, then run `rollback.sql`.
