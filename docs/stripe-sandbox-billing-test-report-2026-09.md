# Stripe sandbox billing test report (2026-09-29)

Environment: Stripe sandbox (livemode=false). Sandbox keys were set temporarily and are being replaced with the live keys at the end of this report.

| Test | Result |
|---|---|
| Starter monthly checkout (£19/month, recurring) | PASS |
| Starter annual checkout (£190/year, recurring) | PASS |
| Professional monthly checkout (£35/month, stable price) | PASS |
| Enterprise monthly checkout (£85/month, stable price) | PASS |
| Webhook signature check and delivery to the app | PASS |
| Repeat webhook ignored (no double activation) | PASS |
| Plan and AI credits switched on after payment | PASS |
| Cancel immediately (monthly), processed by the app | PASS |
| Cancel at end of period (annual), access kept until period end | PASS |
| Refund does not end access early (expected behaviour) | PASS |
| Subscription payment recorded as the customer's expense, not a sales invoice | PASS |
| Stripe invoice and receipt email (sent manually; sandbox does not send automatically) | PASS, received at the owner's address |

## Known items
- With two subscriptions on one account, cancelling one briefly marked the account as unsubscribed until the next status check. Fix waits for owner approval.
- An old test sales invoice is still in the test account's Invoices; it has not been deleted.
- Menu, expense and signup fixes are in the preview and are not published yet.

## Next steps
1. Put the live `STRIPE_SECRET_KEY` and live `STRIPE_WEBHOOK_SECRET` back using the secure form.
2. Make one small live check: open the pricing page and start a checkout, but don't pay.
3. Wave 1 closure still needs owner decisions on 3 projects with no company and 4 tasks whose company doesn't match their project.

Stripe billing testing: PASS
