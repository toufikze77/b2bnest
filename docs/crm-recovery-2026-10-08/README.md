# CRM spreadsheet import — cause, fix and recovery preview (2026-10-08)

## Cause (checked against the live data, read-only)
- All 293 master-file contacts exist exactly once. Name, Company, Position, Source and Notes match the file for every row (293/293), so nothing was dropped or lost.
- The 107-row batch is fully inside the 293 file. It added no duplicates.
- Real defects: (1) 289 placeholder cells like "(likely @x — unverified)" were saved **as email addresses**, so they showed as clickable email links. (2) The contact list did not show notes or LinkedIn. The edit box for notes was single-line, so editing could flatten line breaks. (3) There was no import preview or overlap warning, and unknown columns were dropped silently.

## Fix (preview only, not published)
- Import accepts only real-format emails. Placeholders are saved in Notes as `Email (unverified research): …`. A preview before saving shows counts, overlap, placeholders, unsupported columns and a sample with Source, LinkedIn and Notes. Duplicates are matched by LinkedIn first, then by name + company, never by email domain.
- Contacts with no usable email show "Email unavailable — not verified", with no email link. Add and edit both refuse non-email text in the Email box.
- The LinkedIn link is taken from Notes. It is shown only for https linkedin.com/in/ links and opens in a new tab. Notes stay as plain text, with a multi-line edit box. Export adds a LinkedIn column.
- No database change was needed.

## Recovery preview (nothing written yet)
- 293 unique matches, 0 ambiguous, 0 unmatched, 0 missing Source/Notes, 0 conflicting values.
- 289 email corrections: set email to empty and add the placeholder text to Notes once. Full list: `preview.csv`.
- `apply.sql` is limited to this one account. Each row checks the current value, so running it twice changes nothing. `undo.sql` restores only those email and notes values.
- Possible duplicate, outside these files and not changed: "Toufik Zemri / EDEALS MASTER LTD" (2 records).

## Access check (2026-10-10)
- Table `public.crm_contacts`, RLS on, one policy "Users can manage their own contacts" (ALL, `auth.uid() = user_id`). No gap; the earlier statement was a checking limitation.
- Signed-out API: read 0 rows, update 0 rows, insert refused (401, RLS).
- Simulated other signed-in account (rolled back): read 0, update 0, delete 0, reassign 0, insert as owner refused.
- Earlier "10 October payment-message fix" reference was wrong and is withdrawn; the webhook fix was released 4 Oct 2026 and is unrelated to CRM.

## Applied (2026-10-10, owner-approved)
- Pre-check: the 289 placeholder rows matched the preview set exactly (fingerprint f345c046…), none changed.
- 289 updated: email cleared, placeholder appended to Notes once (existing notes kept). After: 0 placeholders left, 289 notes lines, 0 doubled, 491 contacts total.
- Re-run matches 0 rows, so it changes nothing. `undo.sql` still restores exactly these values. `apply-v2.sql` is the append-only version used.
- Toufik Zemri duplicates untouched. Browser edit/save check not possible: no signed-in preview session for this external backend.
