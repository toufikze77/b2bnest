# Phase 16: header logo spacing and a route home from the dashboard

This is a frontend-only change: no SQL, no Edge Function, and nothing deployed.

## 1. The logo touched "Home" (public header, `src/components/Header.tsx`)

**Cause:**
- The row was `justify-between` inside the site's `max-w-7xl` container, which gives 1,216 px of content width.
- Signed in at 2xl (1536 px and up) it held:
  - the logo (213 px);
  - the menu (538 px);
  - the company switcher, Dashboard, Download, Share, Support, theme, and the avatar with the full name (755 px).
- That adds up to 1,506 px. Nothing kept the items apart, so the menu was pushed against the logo.
- At 1024 and 768 px the right-hand buttons ran off the screen (sideways scroll of 122–370 px).

**Fix:**
- The row has a fixed gap: `gap-3`, then `lg:gap-6` (24 px), then `xl:gap-8` (32 px). It no longer relies on spare room.
- The logo and the menu don't shrink.
- The full menu shows from `lg` (1024 px). Home, Business Tools, Templates, AI Tools, Resources, Pricing and Help always show on desktop. Below 1024 px the menu button opens the same links (it was already there for phones).
- **Download, Share and Support & feedback** moved into a **"More" (⋯)** menu on desktop. Below `lg` the Support button and the menu button's links work as before.
- The user's name is no longer shown next to the avatar; it is in the account menu. The avatar button is labelled "Account menu for <name>".
- The company switcher (2xl only) is 150 px wide in the header, and long names end with "…".
- "AI Tools" was a `<span>`, which keyboard users skipped. It is now a button with a focus ring.

The logo files and sizes are unchanged.

### Measured gap from the logo to "Home"

Measured in Chromium (Playwright) on the home page and on `/business-resources`, signed in (with a mocked company and user) and signed out, light and dark. Each "after" figure is the same in all four of those combinations.

| Width | Before, signed in | Before, signed out | After (all four) |
| --- | --- | --- | --- |
| 1920 | **0 px** | 38.9 px | **32 px** |
| 1536 | **0 px**, sideways scroll 130 px | 38.9 px | **32 px** |
| 1500 | 31.3 px | 38.9 px | **32 px** |
| 1440 | 31.3 px | 38.9 px | **32 px** |
| 1280 | 31.3 px | 38.9 px | **32 px** |
| 1024 | **0 px**, sideways scroll 137 px | **0 px**, scroll 122 px | **24 px** |
| 768 | **0 px**, sideways scroll 311 px | **0 px**, scroll 370 px | menu collapsed (Home is in the menu) |
| 390 | menu collapsed | menu collapsed | menu collapsed; the logo is 44 px from the nearest button |

**After the fix, all 32 combinations on both pages** (8 widths, signed in and out, light and dark) passed these checks:
- **Overlap:** no two header items overlap.
- **Wrapping:** no text in the header wraps onto two lines (the check counts lines of text, not element height).
- **Width:** nothing sits outside the window, and the page doesn't scroll sideways.

## 2. A route home from the dashboard (`src/components/shell/AppShell.tsx`, `navItems.ts`)

- **"B2BNEST home"** (the `Home` icon) goes to `/`. It sits at the bottom of the sidebar, below Settings, with its own divider.
  - It shows in the expanded sidebar, in the collapsed sidebar (icon only, with a "B2BNEST home" tooltip), and in the phone "More" menu.
  - It is kept out of the in-app items, so it is never marked as the current page.
- **The logo** (sidebar header and the phone top bar):
  - On the dashboard, it goes to `/`, labelled "Go to home page".
  - On every other app page, it goes to `/dashboard`, labelled "Go to dashboard".
  - Each link has a matching `aria-label` and `title`, and the image has an empty `alt` so the name isn't read twice.

  This follows the owner's request that the logo can reach the home page. The rule is in one function, `logoTarget()`, and is tested. Because the label always says where it goes, it isn't a surprise. If the owner would rather the logo always went to the dashboard, that is a one-line change; the Home entry covers the route either way.
- **`/` for signed-in users:**
  - Checked in the code: `src/pages/Index.tsx` and `src/App.tsx` have no redirect, and `Layout` only wraps app routes in the app shell.
  - Checked in the real render: signed in, `/` stays on `/` and shows the public header, with no app shell. Nothing needed changing.
- **Keyboard:** the tab order in the header is B2BNEST home → Home → Business Tools → Templates → AI Tools → Resources → Pricing → Help → Dashboard → More → theme → account. The logo's focus ring is visible (3 px, `ring` colour).

## Screenshots (`screenshots/`)

All are real renders of the real `Layout`, `Header`, `AppShell` and pages in Chromium. The **data is mocked**: the signed-in user, the company "Acme Trading Ltd", the dashboard's tasks and the notifications.

- **Public header, signed in:**
  - `public-header-signed-in-{before,after}-{1920,1440,1024,390}`
  - dark mode: `public-header-signed-in-dark-{before,after}-{1920,1024}`
  - `public-header-logo-focus-after-1440`, `public-header-more-open-after-1440`
- **Dashboard sidebar:**
  - `dashboard-sidebar-expanded-{before,after}-{1920,1440}`
  - `dashboard-sidebar-collapsed-{before,after}-{1920,1440}` (the "after" images show the tooltip)
  - `dashboard-menu-{before,after}-1024`: below 1100 px the sidebar opens as a panel.
- **Mobile menu:** `mobile-menu-{before,after}-390`, `mobile-menu-home-entry-after-390`.

## Not verified

- Browsers other than Chromium (Safari, Firefox, Edge), and real phones.
- Real accounts and company names. Longer real names truncate with "…" by design.
