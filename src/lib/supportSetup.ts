/** Support desk tab lives in the URL (`?tab=setup`); default/invalid = tickets. Other params are preserved. */
export const SUPPORT_TABS = ['tickets', 'setup'] as const;
export type SupportTab = (typeof SUPPORT_TABS)[number];

export function readSupportTab(params: URLSearchParams, canManage: boolean): SupportTab {
  return params.get('tab')?.toLowerCase() === 'setup' && canManage ? 'setup' : 'tickets';
}
export function writeSupportTab(params: URLSearchParams, tab: SupportTab): URLSearchParams {
  const next = new URLSearchParams(params);
  if (tab === 'tickets') next.delete('tab'); else next.set('tab', tab);
  return next;
}

/** Real IANA zone names only (e.g. Europe/London). Free text like "London" is rejected. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || !tz.includes('/')) return tz === 'UTC';
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return true; } catch { return false; }
}

export function listTimeZones(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const list = fn ? fn('timeZone') : ['Europe/London', 'UTC'];
  return Array.from(new Set(['Europe/London', 'UTC', ...list]));
}

/** Current offset for that date, so daylight saving is reflected (London: GMT in winter, GMT+1 in summer). */
export function timeZoneOffsetLabel(tz: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    // ICU versions differ: some print "GMT+0" for UTC+0, others "GMT". Always show "GMT".
    return (part?.value ?? '').replace(/^GMT[+-]0(?::00)?$/, 'GMT');
  } catch { return ''; }
}

/** The portal link carries no secret: access is granted only when the signed-in, verified email matches the invitation. */
export const portalInviteLink = (origin: string) => `${origin.replace(/\/$/, '')}/support/portal`;
