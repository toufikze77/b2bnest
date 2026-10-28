# Phase 19: Workflow Studio for Business and Scale only (prepared)

**Status: prepared, not deployed.** No migration, no database change and no deploy is part of this phase.

## The rule (owner decision, 28 Oct 2026)

| Access state (from `_access_state_for` / `my_access_state()`) | Workflows |
| --- | --- |
| `trial` (own trial, or a company's trial) | included |
| `owner` (super admin, admin/owner role, master account) | included |
| `subscribed` on `professional` (Business) or `enterprise` (Scale), including legacy prices | included |
| `subscribed` on `starter` (Solo) | not included |
| `subscribed` with an unknown or missing plan key | not included (fails closed, logged) |
| `trial_ended` | not included (the existing "trial has ended" message) |
| `suspended` | not included (the existing "suspended" message) |

- **Where the rule lives:** in one place, `supabase/functions/_shared/workflow-access.ts`.
  - The server uses it in `workflow-send-email` and `workflow-execute`.
  - The app uses it through `src/lib/access.ts` (`workflowsFor`, `workflowsIncluded`, `workflowsNeedUpgrade`).
- **Company members:** `_access_state_for()` returns the paying account's `plan_key` with `via = 'company'`, so members follow their company's plan.
  - A person's own active subscription is checked before their company's, as it is for all access today.
- **Legacy prices** (Business £35/£350, Scale £85/£850) resolve to the same plan keys, `professional` and `enterprise`, by Stripe lookup key or amount (`_shared/plans.ts`). They follow the same rule.

## Read-only query for the owner (counts only)

This shows how many people currently subscribed on Solo have saved workflows or any run history, and so will see the upgrade panel.
- It uses the same access function as the app and the Edge Functions.
- Run it in the Supabase SQL editor; `_access_state_for` is granted to `postgres` and `service_role` only.
- It changes nothing. **It has not been run against production.**

```sql
-- Phase 19: Solo subscribers who will see the upgrade panel. Read-only; counts only, no ids or emails.
with people as (
  select user_id from public.ai_workflows
  union
  select user_id from public.workflow_run_logs
),
access as (
  select p.user_id, a.state, a.plan_key, a.via,
         exists (select 1 from public.ai_workflows w where w.user_id = p.user_id)       as has_saved,
         exists (select 1 from public.workflow_run_logs l where l.user_id = p.user_id)  as has_runs
  from people p
  cross join lateral public._access_state_for(p.user_id) a
)
select
  count(*) filter (where has_saved)                       as solo_with_saved_workflows,
  count(*) filter (where has_runs)                        as solo_with_run_history,
  count(*)                                                as solo_with_either,
  count(*) filter (where via = 'company')                 as of_which_company_members,
  (select count(*) from access
    where state = 'subscribed'
      and coalesce(plan_key, '') not in ('starter', 'professional', 'enterprise')) as subscribed_with_unknown_plan_key
from access
where state = 'subscribed' and plan_key = 'starter';
```

`ai_workflows` also holds archived workflows from the old builder; they count as "saved".

## Deploy order (owner, after review)

1. **Deploy the two functions first.**
   - `workflow-send-email`. Flattened files: `handler.ts, index.ts, probe.ts, request.ts, shared_access.ts, shared_placeholders.ts, shared_reply-to.ts, shared_workflow-access.ts, smtp.ts`.
   - `workflow-execute`. Flattened files: `handler.ts, index.ts, shared_access.ts, shared_workflow-access.ts`.

   Produce them with `node scripts/flatten-function.mjs <name>`, or run `supabase functions deploy <name>`.
2. **Then publish the frontend.**

**If the frontend is published first:** a Solo user sees the upgrade panel, but the old functions don't check the plan. Anyone who calls the functions directly, outside the app, can still send workflow emails and the WhatsApp test until the functions are deployed. The app itself no longer offers Run on Solo, so this needs a direct API call.

**If the functions are deployed first** (the right order): a Solo user on the old frontend still sees the editor. Pressing "Run now" sends nothing; each step shows "Workflows are included in the Business and Scale plans.", and Run history records it as "Skipped (not sent)".

**Rollback:** redeploy the previous versions of the two functions. No database change is involved.

## Not covered

- `workflow-twitter-post` and `workflow-linkedin-post` are deployed, but their steps are switched off in the app. They are **not** gated by plan in this phase, so any signed-in account could still call them directly.
- The WhatsApp settings "Send test" button uses `workflow-execute`, so Solo accounts now get the plan message there as well.
