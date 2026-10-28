import { describe, it, expect } from 'vitest';
import { readSupportTab, writeSupportTab, isValidTimeZone, listTimeZones, timeZoneOffsetLabel, portalInviteLink } from './supportSetup';

describe('support desk setup rules', () => {
  it('keeps Setup & access in the URL for managers and preserves other params', () => {
    const p = writeSupportTab(new URLSearchParams('ticket=abc'), 'setup');
    expect(p.get('ticket')).toBe('abc');
    expect(readSupportTab(p, true)).toBe('setup');
    expect(readSupportTab(writeSupportTab(p, 'tickets'), true)).toBe('tickets');
  });
  it('falls back to Tickets for invalid values or non-managers', () => {
    expect(readSupportTab(new URLSearchParams('tab=nope'), true)).toBe('tickets');
    expect(readSupportTab(new URLSearchParams('tab=setup'), false)).toBe('tickets');
  });
  it('accepts Europe/London and rejects free text like "London"', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('London')).toBe(false);
    expect(listTimeZones()).toContain('Europe/London');
  });
  it('reflects daylight saving for Europe/London', () => {
    expect(timeZoneOffsetLabel('Europe/London', new Date('2026-01-15T12:00:00Z'))).toBe('GMT');
    expect(timeZoneOffsetLabel('Europe/London', new Date('2026-07-15T12:00:00Z'))).toBe('GMT+1');
  });
  it('shows "GMT" for UTC+0 whichever form the ICU data uses', () => {
    const real = Intl.DateTimeFormat;
    const fake = function () { return { formatToParts: () => [{ type: 'timeZoneName', value: 'GMT+0' }] }; } as unknown as typeof Intl.DateTimeFormat;
    Intl.DateTimeFormat = fake;
    try { expect(timeZoneOffsetLabel('Europe/London')).toBe('GMT'); } finally { Intl.DateTimeFormat = real; }
  });
  it('invitation link carries no token', () => {
    expect(portalInviteLink('https://b2bnest.online/')).toBe('https://b2bnest.online/support/portal');
  });
});
