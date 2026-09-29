# Wave 1 — signed-in test plan (2026-09-30)

Run at https://www.b2bnest.online while signed in. Use synthetic names only (TEST CO A, TEST CO B, TEST PROJ B…). Delete only these afterwards.

## Already covered — no need to repeat
| Test | Covered by |
|---|---|
| 1a Email signup + activation email | You confirmed the activation email now arrives and signup works. |
| 15 Price display £19 / £35 / £85 | Checked on the live pricing page (PASS), and sandbox checkouts charged the same amounts. |
| Billing (checkout, renewal, cancellation, refund, subscription expense) | Your sandbox Stripe tests (all PASS). |
| 17–20 (guessed-ID access blocked when signed out, mobile layout, promotion removed, no secrets in logs) | Earlier automated live checks (PASS). |

Your sandbox tests did **not** cover any company-separation test (2–14, 16, A–I).

## Remaining checks
| Test | Steps | Expected / PASS |
|---|---|---|
| 1b Login | Sign out, sign in with email + password. | Dashboard shows your name. |
| 1c Google | If the Google button shows, sign out and sign in with Google. | Dashboard, no error. (Skip if no button.) |
| 2 Create company | Top-bar switcher → create "TEST CO A" → reopen switcher → refresh. | Listed, selected, stays selected after refresh. |
| 3 Invite | In TEST CO A invite a second email as member; accept; sign in as it. | Member sees TEST CO A only; billing/company settings/delete hidden or refused. |
| 4 / A Switching | Note projects in A, switch to B, back to A, no refresh. | Each switch shows only that company's records at once. |
| 5 / B Project + task | In B create "TEST PROJ B" + one task; switch to A. | Both only in B. |
| 6 / C Spreadsheet import | With B selected, import a 2-row spreadsheet (Onboarding import). Switch to A. | Rows only in B; with no company selected the import refuses. |
| 7 / D Template | With B selected, apply any template. | Created records belong to B. |
| 8 / E, F Rota | In B add "Test Employee" and a shift; switch to A. | Both only in B. |
| 9 CRM | In A create, edit, delete "Test Contact"; check B. | All succeed; never visible in B. |
| 10 Finance | In A add invoice £100 and expense £40; open finance totals; check B. | Totals include exactly these in A only. |
| 11 / I Calendar | Create event in B; open calendar in A. | Event only in B. |
| 12 Analytics/goals | Compare figures and goals in A vs B. | Differ per company. |
| 13 AI Studio | Note credits, run one prompt, refresh. | Reply shown, credits decrease. |
| 14 Integrations | Settings → Integrations. | Loads; shows only your connections. |
| 16 Notifications | Assign a task to yourself; open panel, dismiss, refresh. | Appears, stays dismissed. |
| G Member lists | Open assignee/employee dropdowns in B. | Only B's people. |
| H Cross-company URL | Copy a B project URL, switch to A, open it; try a made-up ID. | Not found / refused; no data shown. |

Report PASS/FAIL per row. Nothing is marked PASS until you report it.

## Separate pending checks (not part of this plan)
- Live Stripe webhook destination delivering to `/functions/v1/stripe-webhook` (6 events).
- Live customer invoice emails turned on in Stripe.
- GitHub mirror `toufikze77/b2bnest` behind (at `1e18106`, 5 Sep).

Wave 1 status: NOT CLOSED.
