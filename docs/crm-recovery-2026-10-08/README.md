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
