# Retired Promotion Removal and Wave 1 Cleanup

## Scope

- Remove the first-1000 offer banner, mock user/spot counter, countdown timer, countdown copy, and directly related urgency UI across the repository.
- Preserve the prices and discount calculations currently used by checkout. Do not change Stripe configuration or plan entitlements.
- Verify the existing spreadsheet-import and template fixes still use the selected company after membership validation and keep parent/child company ownership aligned.
- Keep historical reconciliation fail-closed: document any records still requiring an owner decision and make no guessed assignments or production writes.

## Implementation

- Simplify pricing presentation so permanent current prices no longer depend on a first-1000 flag, while retaining the same amounts passed to payment.
- Remove obsolete promotional components and imports once no references remain.
- Remove related countdown/limited-availability messaging while leaving unrelated product pricing and benefits intact.
- Update the cleanup record and roadmap with verified status and any explicit owner blockers.

## Validation

- Search the full repository again for all requested phrases, counters, and component references.
- Run focused lint/tests, confirm the preview build, and re-run the isolated Wave 1 safety suite.
- Confirm no database migration, production data write, pricing, Stripe, entitlement, or full UI-modernisation change occurred.