/**
 * Where focus should go back to when a dialog opened from a row menu closes. Dialogs opened from
 * a menu item have no trigger of their own, and the menu item is gone by then, so focus would land
 * on the page top. Radix menus label their content with the trigger's id, so we return there; if
 * that row was deleted, focus goes to the heading of the list it was in.
 */
export interface FocusReturn { target: HTMLElement | null; headingId: string | null }

export function returnFocusTarget(): FocusReturn {
  const el = document.activeElement as HTMLElement | null;
  const menu = el?.closest('[role="menu"]');
  const triggerId = menu?.getAttribute('aria-labelledby');
  const target = (triggerId ? document.getElementById(triggerId) : null) ?? (el && el !== document.body ? el : null);
  return { target, headingId: target?.closest('section[aria-labelledby]')?.getAttribute('aria-labelledby') ?? null };
}

/** For a dialog's onCloseAutoFocus: focus the saved element, or its list heading if the row is gone. */
export function restoreFocus(saved: FocusReturn | null, e: Event) {
  if (saved?.target?.isConnected) { e.preventDefault(); saved.target.focus(); return; }
  const heading = saved?.headingId ? document.getElementById(saved.headingId) : null;
  if (heading) { e.preventDefault(); heading.tabIndex = -1; heading.focus(); }
}
