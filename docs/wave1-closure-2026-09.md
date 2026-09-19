# B2BNEST — Wave 1 closure record (2026-09-19)

Status: **WAVE 1: READY FOR OWNER VERIFICATION**

Nothing was deployed, no production data was modified, no price, Stripe setting,
database object or UI was changed while producing this record.

---

## PART 1 — Manual authenticated test checklist

Source: `docs/post-deployment-validation-2026-09.md`, section C. Nine tests are BLOCKED
because no signed-in session can be created automatically for the external Supabase
project. Run them yourself at https://www.b2bnest.online while logged in.
None of them is marked PASS until you report the actual result.

### TEST 1 — Signup / login / Google sign-in
- PURPOSE: Confirm account access works on the live release.
- STEPS: Sign out. Go to /auth. (a) Create a new account with a spare email address and confirm it. (b) Sign out, sign back in with email + password. (c) If the Google button is shown, sign out and sign in with Google.
- EXPECTED: Each route ends on the dashboard with your name/avatar shown.
- PASS: All three paths reach the dashboard with no error message.
- FAIL: Any path errors, loops back to /auth, or hangs on a blank screen.

### TEST 2 — Create company, appears in switcher
- PURPOSE: Confirm a new company can be created and selected.
- STEPS: Open the company switcher (top bar). Choose to create a company, name it "TEST CO A". Save. Re-open the switcher.
- EXPECTED: "TEST CO A" is listed and selectable, and becomes the selected company.
- PASS: Company appears and can be selected.
- FAIL: Creation errors, company missing from the list, or selection does not stick after a page refresh.

### TEST 3 — Invite user, accept, role applied
- PURPOSE: Confirm invitations and roles work end to end.
- STEPS: In TEST CO A, invite a second email you control as "member". Open the invitation email, accept it, sign in as that user.
- EXPECTED: Invited user joins TEST CO A with the member role and sees only that company's data; owner-only actions (billing, company settings, delete) are hidden or refused.
- PASS: Invitation accepted, role correct, owner-only actions unavailable to the member.
- FAIL: Email not received, acceptance errors, or the member can reach owner-only actions.

### TEST 9 — CRM create / edit / delete contact
- PURPOSE: Confirm CRM writes work and stay inside the selected company.
- STEPS: With TEST CO A selected, go to /crm, create contact "Test Contact", edit its name, then delete it. Switch to another company and check the CRM list.
- EXPECTED: All three actions succeed; the contact is never visible in the other company.
- PASS: Create, edit and delete all succeed and the record is company-scoped.
- FAIL: Any action errors, or the contact appears under another company.

### TEST 10 — Invoice + expense totals
- PURPOSE: Confirm finance figures are calculated and scoped correctly.
- STEPS: Create one invoice (e.g. £100) and one expense (e.g. £40) in TEST CO A. Open the finance/overview totals.
- EXPECTED: Totals include exactly these amounts for TEST CO A only.
- PASS: Totals match what you entered, in the correct company.
- FAIL: Totals wrong, or figures from another company included.

### TEST 12 — Analytics + goals company-scoped
- PURPOSE: Confirm reporting reflects the selected company only.
- STEPS: Note the analytics figures and goals in TEST CO A. Switch to another company and compare.
- EXPECTED: Figures and goals change with the selected company.
- PASS: Each company shows its own numbers and goals.
- FAIL: Identical numbers across companies, or another company's goals visible.

### TEST 13 — AI Studio prompt deducts credits
- PURPOSE: Confirm AI usage works and credits are counted.
- STEPS: Note your AI credit balance. Run one prompt in AI Studio. Refresh and check the balance.
- EXPECTED: A reply is produced and the balance drops by the expected amount.
- PASS: Reply returned and credits decrease.
- FAIL: No reply, an error, or credits unchanged/over-charged.

### TEST 14 — Integrations settings page lists accounts
- PURPOSE: Confirm connected services are listed for the selected company/user.
- STEPS: Open Settings → Integrations. Review the list of available and connected services.
- EXPECTED: Page loads, shows available integrations and any accounts you have connected.
- PASS: Page loads without error and shows the correct connection state.
- FAIL: Page errors, is blank, or shows an account belonging to someone else.

### TEST 16 — Notifications appear / dismiss
- PURPOSE: Confirm in-app notifications work.
- STEPS: Trigger a notification (e.g. assign a task to yourself). Open the notifications panel, read it, dismiss it, refresh.
- EXPECTED: Notification appears, then stays dismissed after refresh.
- PASS: Appears and dismisses permanently.
- FAIL: Never appears, cannot be dismissed, reappears after refresh, or shows another company's activity.

### Additional tests you asked for (previously verified in code only — please confirm live)

**TEST A — Company A → B → A switching, no stale data**
- STEPS: Select Company A, note the projects/tasks/calendar shown. Switch to Company B, note its data. Switch back to A. Do not refresh between switches.
- PASS: Each switch shows only that company's records, immediately; nothing from the other company lingers.
- FAIL: Old rows remain visible after a switch, counts are wrong, or a blank/incorrect list appears until refresh.

**TEST B — Project and task stamped with the selected company**
- STEPS: In Company B, create project "TEST PROJ B" and a task inside it. Switch to Company A.
- PASS: Both exist only in Company B.
- FAIL: They appear in Company A or have no company.

**TEST C — Project spreadsheet import requires and stamps the company**
- STEPS: With Company B selected, import a small spreadsheet of 2 rows. Then switch to Company A.
- PASS: Import refuses if no company is selected; imported rows appear only in Company B.
- FAIL: Import proceeds without a company, or rows land in another company.

**TEST D — Template creation uses the selected company**
- STEPS: With Company B selected, apply any project/workspace template.
- PASS: Created records belong to Company B (not your first/oldest company).
- FAIL: Records land in a different company.

**TEST E — Rota employee creation**
- STEPS: In Company B, Rota → Employees → add "Test Employee". Switch to Company A.
- PASS: Employee saved under Company B only.
- FAIL: Save errors, or employee visible in Company A.

**TEST F — Rota shift creation**
- STEPS: In Company B, Rota → Schedule → add a shift for Test Employee. Switch to Company A.
- PASS: Shift saved under Company B only; the schedule for A is unaffected.
- FAIL: Shift missing, or visible in Company A.

**TEST G — Member/user selectors scoped to the company**
- STEPS: In any assignment dropdown (task assignee, shift employee, project member) in Company B, open the list.
- PASS: Only Company B members/employees are listed.
- FAIL: Members of another company appear.

**TEST H — Cross-company access denied**
- STEPS: Copy a project URL from Company B. Switch to Company A and paste the URL. Also try a made-up ID.
- PASS: Access is refused or the record is simply not found; no data is shown.
- FAIL: The record's content is displayed.

**TEST I — Calendar tenancy**
- STEPS: Create a calendar event in Company B, then switch to Company A and open the calendar.
- PASS: Event only in Company B.
- FAIL: Event visible in Company A.

Cleanup: after testing, delete only the synthetic records you created (TEST CO A, TEST PROJ B,
Test Employee, test contact/invoice/expense). Do not delete anything else.

---

## PART 2 — Legacy data report (read-only, nothing modified)

### 2.1 Projects with no company assigned (3)

| Project | Organization | Created | Owner/creator | Related tasks | Likely company (evidence only) |
|---|---|---|---|---|---|
| AINEST | none | 2025-10-17 23:17 UTC | user 3eac00c6…5c17 (owner of Dev Team, admin@example.com's Organization, Admin) | 5 tasks, all stamped "admin@example.com's Organization" | Evidence points to "admin@example.com's Organization" (all 5 child tasks carry it). Owner decision required. |
| NESTPRO TRADE | none | 2026-05-27 13:35 UTC | user 3eac00c6…5c17 | 0 tasks | Cannot be established — no child records. Owner decision required. |
| NG TELECOM | none | 2026-07-08 15:27 UTC | user 3eac00c6…5c17 | 6 tasks, all stamped "Dev Team" | Evidence points to "Dev Team" (all 6 child tasks carry it). Owner decision required. |

No company was assigned. Nothing was written.

### 2.2 Tasks whose company differs from their project (4)

All four sit under the same project and were created 2026-09-12/13.

1. PROJECT: B2BNEST · PROJECT COMPANY: admin@example.com's Organization · TASK: "Pricing, Remove 1000 users offer and fix price" · TASK COMPANY: Dev Team · WHY FLAGGED: task company differs from its parent project's company.
2. PROJECT: B2BNEST · PROJECT COMPANY: admin@example.com's Organization · TASK: "GUI Improvement" · TASK COMPANY: Dev Team · WHY FLAGGED: same mismatch.
3. PROJECT: B2BNEST · PROJECT COMPANY: admin@example.com's Organization · TASK: "Select project under task" · TASK COMPANY: Dev Team · WHY FLAGGED: same mismatch.
4. PROJECT: B2BNEST · PROJECT COMPANY: admin@example.com's Organization · TASK: "Allow user to delete and close account" · TASK COMPANY: Dev Team · WHY FLAGGED: same mismatch.

Note for completeness: a further 11 tasks differ from their parent project only because the
parent project has no company at all (the 5 AINEST and 6 NG TELECOM tasks listed in 2.1).
They are resolved automatically once you decide the three project assignments above.

Nothing in this section was modified.

---

## PART 3 — Pricing / Stripe comparison (read-only, no price changed)

Sources compared: pricing page component `src/components/PricingPlans.tsx`, the application
plan configuration in that same component (single source for the displayed plans), and the
checkout amounts in `supabase/functions/create-subscription-checkout/index.ts`.
Checkout uses inline `price_data` (amount + currency created per session); there are no
stored Stripe Price IDs referenced by production. No secrets were read or exposed.

**STARTER**
- Website: £19/month · £190/year
- Monthly checkout: £19.00
- Annual checkout: £15.00 charged yearly

**PROFESSIONAL**
- Website: £35/month · £350/year
- Monthly checkout: £49.00
- Annual checkout: £39.00 charged yearly

**ENTERPRISE**
- Website: £85/month · £850/year
- Monthly checkout: £99.00
- Annual checkout: £79.00 charged yearly

### Where the mismatches are

1. **Annual billing is wrong for every plan.** The website advertises an annual total
   (£190 / £350 / £850), but checkout charges the *monthly-equivalent* figure once a year
   (£15 / £39 / £79 per year). Starter's annual charge is therefore £15 instead of £190.
2. **Professional monthly**: website £35, checkout £49 — customer overcharged by £14/month.
3. **Enterprise monthly**: website £85, checkout £99 — customer overcharged by £14/month.
4. **Starter monthly** is the only fully consistent figure (£19 both sides).

Nothing was changed. Correcting this requires your explicit instruction on which set of
prices is authoritative.

---

## PART 4 — Wave 1 closure

**WAVE 1: READY FOR OWNER VERIFICATION**

Closure to "WAVE 1: CLOSED" is held pending:
- your results for the nine BLOCKED authenticated tests and tests A–I,
- your decisions on the 3 unassigned projects and 4 mismatched tasks,
- resolution of the pricing/checkout discrepancy above (billing regression risk is open until then).
