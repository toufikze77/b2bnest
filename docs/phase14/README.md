# Phase 14: Stripe customer ownership checks (prepared)

Every billing Edge Function now acts only on a Stripe customer that provably belongs to the signed-in user. Nothing in this PR is deployed, and nothing in Stripe or production was changed. Production `gvftvswyrevummbvyhxa` was only **read**, on 28 Oct 2026, with the counts query below.

**No SQL is needed.** The only database reads are new lookups the webhook makes through `select` on `public.subscribers` and `auth.admin.getUserById`, and both already work with the service role. So there is no `proposal.sql` / `rollback.sql` / `test.sql` for this phase; rollback is redeploying the previous function code.

## What "provably belongs" means

All of this is in `supabase/functions/_shared/verified-customer.ts`:

1. **The stored customer:** `subscribers.stripe_customer_id` for this user is used if it still exists in Stripe.
   - New: if its `metadata.supabase_user_id` names a *different* user, it is refused (`stored_owned_by_other`).
   - A stored customer without metadata is still used, so existing subscribers keep working.
2. **Otherwise, an email match:** exactly one Stripe customer with the user's email, **and** `metadata.supabase_user_id` equal to the user's id.
3. **Otherwise, nothing.** The reason is one of:
   - `no_customer` / `stored_missing_no_verified_match`: the user has no customer at all;
   - `unverified_email`: one customer with the email, but not marked as theirs;
   - `ambiguous_email`: two or more customers with the email.

`resolveOrCreateVerifiedCustomer` (checkout only) creates a **new** customer `{ email, metadata: { supabase_user_id } }` in the first case. It never reuses an unverified match. In the other cases it returns:

- HTTP 409 with `{ error: "billing_account_unverified", message: "We couldn't link your billing account. Please contact support." }`;
- nothing is created and nothing is charged.

## Each function

| Function | Before | Now |
| --- | --- | --- |
| `create-subscription-checkout` | `customers.list({ email, limit: 1 })` and took the first match, whoever it belonged to. If there was none, it created one. The `organizationId` path was already checked: the caller must be an active member, else 403 (unchanged, tested). | `resolveOrCreateVerifiedCustomer`. Uses the stored id if present (it ignored the stored id before), else the verified match, else a NEW customer. If a customer exists but isn't provably the user's, it returns 409 `billing_account_unverified`. The checkout session parameters are byte-for-byte the same (regression test). |
| `check-subscription` | Customer by email only (`limit: 1`, first match). It then wrote that customer's subscription onto the caller's `subscribers` row, so it could copy someone else's plan. | `resolveVerifiedCustomer` with the stored id. If a customer exists but isn't provably the user's, it returns 409 and **writes nothing**. With no customer at all, it writes the free state with no customer id (as before, and it also clears a stored id that no longer exists). |
| `create-subscription-invoice` | Checked only that the session's customer email equals the caller's email. | The session must be the caller's: `client_reference_id` or `metadata.supabase_user_id` equals the caller's id. **And** `session.customer` must equal the caller's verified customer. Otherwise 403 and no expense. An unknown session now returns 404 (it was a 500). The expense row is unchanged. |
| `create-payment` (used: Template Center → CheckoutModal → PaymentMethodSelector → StripeCheckout) | Took the first customer with the email. | Uses the verified customer if there is one; with no customer, a guest checkout by email (as before). If a customer exists but isn't provably the user's, it returns 409 `billing_account_unverified` and creates no session. The session parameters are otherwise identical (regression test). |
| `stripe-webhook` | See below | See below |
| `customer-portal`, `change-subscription-plan` | Already used `resolveVerifiedCustomer`. | No logic change. They now also inherit the `stored_owned_by_other` refusal; the only code change is a type-narrowing fix (`=== null`), which also fixed `deno check` errors already present on main. |

## The webhook's matching rules

**Before:**
- the row was keyed by the Stripe customer's email (the `apply_stripe_subscriber_state` RPC);
- `user_id` was set from `metadata.supabase_user_id` on the subscription, else on the customer, else left as it was;
- **with no metadata at all, it still wrote the subscription onto whatever `subscribers` row had that email.**

**Now** (`resolveOwner` in `stripe-webhook/handler.ts`):
1. `metadata.supabase_user_id` on the subscription or the customer. If both are set and differ, the event is refused.
2. Otherwise, the one account whose `subscribers.stripe_customer_id` is this customer. That row is updated, even if the email in Stripe has since changed.
3. Otherwise, a verified email match:
   - the `subscribers` row with exactly the customer's email has a `user_id`;
   - that account signs in with that same email (`auth.users`, case-insensitive);
   - the row holds no other customer id.

It also refuses (never guesses) in these cases:
- the metadata names user A, but this customer is already linked to user B;
- the metadata names user A, but the row for that email belongs to user B;
- the customer is linked to two or more accounts;
- nothing identifies the owner.

A refused event is **logged and completed with 200**. Nothing is written, and a retry would give the same answer. It is fixed by the manual metadata step below; the next subscription event, or the user's next sign-in (`check-subscription`), then syncs it.

The livemode guard, claim/lease/token fencing, staleness check and idempotency are **unchanged**, and the 15 existing webhook tests pass. The happy path (metadata set by our own checkout) writes the same row as before; `user_id` is now always present in it.

## Inventory

Grep of `supabase/functions` and `src/` for `customers.list`, `customers.search`, writes of `stripe_customer_id` and writes to `subscribers`:

| Where | What | Verdict |
| --- | --- | --- |
| `_shared/verified-customer.ts` | `customers.list({ email, limit: 2 })` | safe: the only email lookup left, and it requires exactly one match carrying the user's id |
| `create-subscription-checkout/handler.ts` | was `customers.list` (first match) | **fixed** |
| `check-subscription/handler.ts` | was `customers.list` (first match). Writes `subscribers` (upsert on email) including `stripe_customer_id` | **fixed**: writes only a verified id, or null |
| `create-subscription-invoice/handler.ts` | email-only ownership check | **fixed** |
| `create-payment/handler.ts` | was `customers.list` (first match). Puts `stripe_customer_id` in payment metadata | **fixed**: verified id only |
| `stripe-webhook/handler.ts` + `index.ts` | writes `subscribers` (via `apply_stripe_subscriber_state`) including `stripe_customer_id` | **fixed**: only after `resolveOwner` |
| `customer-portal/index.ts`, `change-subscription-plan/*` | read `subscribers.stripe_customer_id`, then `resolveVerifiedCustomer` | safe (already verified) |
| `*/index.ts` `storedCustomerId` helpers | read `subscribers.stripe_customer_id` by `user_id` | safe (read-only, the user's own row) |
| `src/hooks/useSubscription.tsx`, `src/hooks/useAccess.ts` | read `subscribers` by `user_id` (RLS) | safe (read-only) |
| `src/pages/admin/AdminSubscriptions.tsx`, `src/pages/AIWorkspace.tsx`, `_shared/plans.ts`, `src/lib/plans.ts`, `src/data/*` | the word "subscribers" in text, labels or an audit log name | not billing |

`customers.search` is used nowhere.

## Existing subscribers

**Counts query** (read-only, no row data):

```sql
SELECT
  count(*)                                                                    AS subscriber_rows,
  count(*) FILTER (WHERE stripe_customer_id IS NULL)                          AS no_stored_customer,
  count(*) FILTER (WHERE stripe_customer_id IS NULL AND subscribed)           AS no_stored_customer_but_subscribed,
  count(*) FILTER (WHERE user_id IS NULL)                                     AS no_user_id,
  count(*) FILTER (WHERE user_id IS NULL AND stripe_customer_id IS NOT NULL)  AS customer_but_no_user_id,
  count(*) FILTER (WHERE stripe_customer_id IS NOT NULL)                      AS with_stored_customer,
  (SELECT count(*) FROM (SELECT stripe_customer_id FROM public.subscribers WHERE stripe_customer_id IS NOT NULL
     GROUP BY stripe_customer_id HAVING count(DISTINCT user_id) > 1) d)       AS customer_ids_shared_by_several_users
FROM public.subscribers;
```

**Production result on 28 Oct 2026:** 7 rows; **0** with no stored customer; 0 with no `user_id`; 0 customer ids shared by several users.

So every existing subscriber goes down the "stored customer" path (functions) or rule 2 (webhook), and none depends on an email match. I could not check whether those 7 stored customers still exist in Stripe, or what metadata they carry. Stripe was not called.

**Manual fix when someone sees "We couldn't link your billing account"** (owner, in the Stripe Dashboard; nothing here does it):
1. Find the user's id: Admin → Users, or `SELECT id FROM auth.users WHERE email = '<their email>';` (read-only).
2. In Stripe → Customers, open **the** customer that is really theirs. Check the subscriptions and payments; if two customers share the email, decide which one is theirs.
3. Under Metadata, add the key `supabase_user_id` with the user's id as the value. Save.
4. If another customer with the same email is *not* theirs, make sure it has no `supabase_user_id` naming them. If it is a leftover duplicate with nothing on it, consider deleting it.
5. Ask the user to sign in again, or open Pricing. `check-subscription` will then find exactly one verified customer.

## Deploy order (not done in this PR)

1. **No SQL.**
2. Redeploy, in any order:
   - `create-subscription-checkout`
   - `check-subscription`
   - `create-subscription-invoice`
   - `create-payment`
   - `stripe-webhook`
   - `customer-portal`
   - `change-subscription-plan`

   The last two because they import the changed `_shared/verified-customer.ts`; the webhook last is fine.

   For dashboard deploys, run `node scripts/flatten-function.mjs <name>`. Expected files:
   - checkout, check, invoice, plan change: `handler.ts`, `index.ts`, `shared_plans.ts`, `shared_verified-customer.ts`;
   - `create-payment`: `handler.ts`, `index.ts`, `shared_verified-customer.ts`;
   - `stripe-webhook`: `handler.ts`, `index.ts`, `shared_plans.ts`;
   - `customer-portal`: `index.ts`, `shared_portal-config.ts`, `shared_verified-customer.ts`.

   Keep `verify_jwt` as it is today for each function.
3. The frontend message (Pricing, template checkout) can ship any time. Before the functions are redeployed it never shows.

## Not verified

- Live Stripe: real customers, their metadata, whether the 7 stored ids still exist, and real webhook deliveries. Every test uses an in-memory fake Stripe.
- Production behaviour of the new webhook lookups (`subscribers` selects, `auth.admin.getUserById`). They were type-checked against stubs only, because esm.sh is blocked here.
- Running the deployed functions.
