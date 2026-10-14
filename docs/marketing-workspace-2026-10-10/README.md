# Marketing planning workspace — release package (2026-10-14, NOT applied live)

- Migration: `docs/marketing-workspace-2026-10-10/proposal.sql`
- Rollback: `docs/marketing-workspace-2026-10-10/rollback.sql`
- Throwaway test: `test.sql` run by `run-test.sh` (disposable local Postgres, deleted afterwards) — 30/30 PASS.

Tables (new, additive): marketing_audiences, marketing_campaigns, marketing_content_items.
Access: each row only visible/editable by its creator (auth.uid() = user_id); anon has no grants.
Guard trigger: ownership cannot change; campaign contacts must be the owner's crm_contacts;
audience/campaign refs must be the owner's; task links must be the owner's personal task or a task
in a company the owner belongs to; a task can be linked once. Deleted task → link cleared; deleted
contact → hidden in the UI, campaign stays editable.
Existing data impact: none (no existing table altered; one FK to todos ON DELETE SET NULL).
Rollback: deletes all saved audiences, campaigns and planned content. Tasks created from planned content remain.
Test caveat: existing tables/functions were minimal stand-ins with the same columns and rules, not a full schema replay.
