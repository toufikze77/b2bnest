# B2BNEST UI guidelines

These rules apply to every new screen. They build on the Phase 0 design tokens
(`src/index.css`, `tailwind.config.ts`) and the Phase 1b chart kit
(`src/components/charts/`). **All new setup and configuration screens use the same card,
form, switch and chart patterns described here.**

## Colour: red (`--destructive`, Phase 4)

| Mode | Value | Text on page/card | Button text on it | On its 10% tint |
|---|---|---|---|---|
| Light | `#B91C1C` (`0 74% 42%`) | 6.41:1 on white | 6.12:1 (`--destructive-foreground`, near white) | 5.41:1 |
| Dark | `#F87171` (`0 91% 71%`) | 6.5:1 on card | 6.88:1 (`--destructive-foreground` is navy in dark mode) | 5.72:1 |

The old value (`0 84.2% 60.2%`) was 3.76:1 on white. Hover backgrounds stay at `/90` or darker
(`/80` drops white text below 4.5:1). A `border-destructive/40` outline is decorative (the text
inside carries the meaning). The "Urgent" priority chip has its own token (white on it 4.8:1).

## Tokens (use these, never raw colours)

| Token | Value | Use |
|---|---|---|
| `bg-brand-navy` | #001A4C | Header bands, sidebar |
| `bg-primary` / `text-link` | #0069FF / #0050C8 | Primary buttons / links on white |
| `bg-background` | #F2F5FA | Page |
| `border-border` | #DDE4F0 | Card and field borders |
| `text-foreground` / `text-muted-foreground` | #1F2A44 / #4A5873 | Body / secondary text |
| `ring-ring` + `ring-[3px]` | #7FB2FF | Focus ring (3px) |
| `rounded-card` / `rounded-control` | 12px / 8px | Cards / buttons and fields; chips are `rounded-full` |
| `text-page-title` · `text-card-title` · `text-body` · `text-small` | 30 · 18 · 14.5 · 12.5px | Type scale |
| `min-h-touch` | 44px | Every tap target on phones |

Text contrast is at least 4.5:1. Spacing is in steps of 8px (Tailwind 2, 4, 6, 8…).

## Cards

White card, `rounded-card`, `border border-border`, `p-5` (or `p-4` for stat tiles), title in
`text-card-title`, one-line subtitle in `text-small text-muted-foreground`. Controls (range,
currency, "View as table") sit on the right of the header and wrap below on phones.

## Forms and switches

- Every field has a visible `<Label htmlFor>`; helper text sits under the field and is tied to
  it with `aria-describedby` (example: the deal Probability field).
- Optional numbers start **empty**. Never pre-fill an estimate (no 50% default probability).
- On/off settings use the shadcn `Switch` (a real `role="switch"`) with a label and a one-line
  description, grouped in a bordered list (see `src/components/dashboard/CustomisePanel.tsx`).
- Choices between views use a `role="group"` of buttons with `aria-pressed`.

## Money

- Format with `formatMoney` from `src/lib/money.ts` (Intl, en-GB). Never print "$" as a fallback.
- The account currency is `useAccountCurrency()` (`src/hooks/useUserSettings.tsx`). While it is
  loading or not set, show plain numbers without a symbol.
- A record with its own currency (a deal) is shown in that currency. Totals stay one per
  currency and are **never converted** (there is no exchange-rate data).
- Whole numbers for totals and charts; `{ cents: true }` only where pennies matter.

## Honest numbers

Every figure, chart and label comes from data the screen already loads. When there is no data,
show an empty state with a short message and the next action ("Add your first deal"). When a
load fails, show an error with "Try again", never zero. No sample numbers, no invented trends
("12% vs last quarter"), no "Connected" badges for things that are not connected.

## Charts (`src/components/charts/`)

| Component | Use |
|---|---|
| `ChartCard` | The card every chart sits in: title, subtitle, controls, loading skeleton, empty and error states, "View as table" (a real `<table>`), and `role="img"` with a text `summary`. |
| `Donut` | Shares of a whole: thick ring, total in the centre, ranked legend with counts and %. More than 6 slices fold into "Other". |
| `ColumnChart` | One measure over categories or months: rounded tops, max 24px wide. |
| `TrendChart` | Change over time: 2px lines, soft area wash, ringed dots; 2+ series always get a legend. |
| `StatTile` | One headline figure with a hint saying what it is counted from. `null` shows "—". |
| `ChartEmpty` | The empty-state block, also usable outside a card. |

Rules:

- **Colours:** `var(--chart-1)` … `var(--chart-6)` in that fixed order: blue #0069FF, navy-hue
  #2F5096, light blue #3D8BFF, orange #E8590C, green #13996C, violet #6250D6 (dark mode has its own
  steps). The set was checked with the dataviz palette validator. Adjacent pairs pass the
  colour-blind and normal-vision checks, and every colour reaches 3:1 on white. Brand navy
  #001A4C is too dark to work as a data colour, so slot 2 is a lighter step of the same hue.
  Never use the default recharts rainbow and never cycle past 6.
- **Axes:** light dashed horizontal grid only, no vertical grid, no axis lines, 12.5px muted ticks,
  compact numbers (12k, 1.2m). The currency symbol goes in the axis title, not on every tick.
- **One y-axis per chart.** Two measures with different scales (money and a count) are two
  stacked small charts, never a dual axis.
- **Tooltips** use `TooltipCard`: title, coloured dot, formatted value (right currency), share
  where it helps. Never show raw numbers such as 45000.
- **Legends:** direct labels or a ranked legend list with counts. Never a bare default `<Legend>`.
- **Text** uses text colours, never the series colour; identity comes from the dot or line beside it.
- **Motion:** short (450ms) and off under `prefers-reduced-motion`.
- **Accessibility:** a text summary, "View as table", keyboard focus on points (Recharts
  `accessibilityLayer`), and colour is never the only signal.
- **Responsive:** grids collapse to one column at phone width; the donut legend moves under the ring.

## Invoices & quotes status chips (`src/lib/financeSummary.ts`)

Stored invoice status → chip: `paid` → Paid · `cancelled` / `canceled` / `void` → Cancelled ·
`draft` or empty → Draft · `sent`, `pending`, `overdue` and anything else → Sent, shown as
**Overdue** when the due date is before today. Overdue is worked out in the app and never written
back; a draft is never overdue. Quotes: `draft`/empty → Draft, `sent` → Sent, anything else keeps
its stored word. Revenue = paid invoices only; quotes never count. Render chips through
`InvoiceStatusChip` / `QuoteStatusChip` (`src/components/finance/DocStatusChip.tsx`).

## Records you can edit (`src/components/finance/RecordsTable.tsx`)

Lists of the user's own records (expenses, recurring payments, suppliers, products) use one
pattern: search, filter chips with counts, a row count, a "⋯" menu per row (Edit, any
Make inactive / Pause, Delete), phone cards with 44px targets, and an empty state with Add.
- Add and Edit share one dialog (`RecordFormDialog`); Edit sends only changed fields, filtered by
  `id` and `user_id` (`src/lib/moneyOutApi.ts`). Emptied optional fields are sent as null.
- Delete always goes through `ConfirmDeleteDialog`, which names the item and says it can't be
  undone. A failed save or delete shows the reason inside the dialog and leaves the record as it was.
  Never use `window.confirm`.
- When a dialog closes, focus returns to the row's menu button (or to the list heading if the
  row was deleted) via `returnFocus.ts`.
- Red (`--destructive`) is safe for text, icons, outlines and button backgrounds (see Colour: red).

## Quotes and invoices: honest status (`src/lib/documentActions.ts`)

- B2BNEST does not email documents. Never show "sent" unless the user pressed a button that says
  so: "Mark as sent" records the status and its message says no email was sent.
- Status actions: draft → Mark as sent; sent or overdue invoice → Mark as paid; paid → Mark as
  unpaid. Apply the change on screen at once, save it filtered by `id` and `user_id`, and roll back
  with an error if the save fails.
- There is no paid date yet: paid figures are by invoice date. Never use `updated_at` as a paid date.

## Tabs in the address bar (`src/lib/financeTabs.ts`)

Page tabs write `?tab=` (and Payroll `?payroll=`) with `replace`, keeping other params, so a
refresh lands on the same tab and Back doesn't step through tabs. Unknown values fall back to the
first tab, never to a form.

## Next screens to bring onto these patterns (not done yet)

- Settings → Account (`src/components/AccountSettings.tsx`): preferences form, currency picker, 2FA.
- Settings → Security, Billing, Notifications, HMRC, Members & roles, Company security, Company
  data (`src/pages/Settings.tsx`, `src/components/settings/*`).
- Business overview (`src/pages/BusinessOverview.tsx`): hard-coded colour classes and its own
  money formatter.
- Banking and Payroll (UK) tabs inside Invoices & quotes: only the page frame is new; their
  insides still use the old `formatCurrency` (prints "$" for an unknown or empty code).
