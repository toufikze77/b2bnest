// store-oauth-client (supabase/functions/store-oauth-client): the request check, and the six Connect cards no longer
// writing user_integrations from the browser (it has no INSERT/UPDATE policy for users, on purpose).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_FIELD_LENGTH, PROVIDER_FIELDS, validate } from '../../supabase/functions/store-oauth-client/validate';

describe('store-oauth-client: validate', () => {
  it('refuses an unknown provider (and prototype names)', () => {
    expect(validate('twitter', { client_id: 'a', client_secret: 'b' })).toEqual({ ok: false, error: 'Unknown provider' });
    expect(validate('toString', { client_id: 'a', client_secret: 'b' })).toEqual({ ok: false, error: 'Unknown provider' });
    expect(validate(undefined, { client_id: 'a', client_secret: 'b' })).toEqual({ ok: false, error: 'Unknown provider' });
  });
  it('refuses missing credentials or a missing field', () => {
    expect(validate('linkedin', undefined)).toEqual({ ok: false, error: 'Missing credentials' });
    expect(validate('linkedin', ['a'])).toEqual({ ok: false, error: 'Missing credentials' });
    expect(validate('linkedin', { client_id: 'a' })).toEqual({ ok: false, error: 'Missing client_secret' });
    expect(validate('facebook', { client_id: 'a', client_secret: 'b' })).toEqual({ ok: false, error: 'Missing app_id' });
    expect(validate('onedrive', { client_id: '   ', client_secret: 'b' })).toEqual({ ok: false, error: 'Missing client_id' });
  });
  it('refuses a field that is not a string', () => {
    expect(validate('google_calendar', { client_id: 123, client_secret: 'b' })).toEqual({ ok: false, error: 'Missing client_id' });
    expect(validate('google_calendar', { client_id: 'a', client_secret: { x: 1 } })).toEqual({ ok: false, error: 'Missing client_secret' });
  });
  it('refuses a field longer than 500 characters (500 is fine)', () => {
    expect(MAX_FIELD_LENGTH).toBe(500);
    expect(validate('outlook_calendar', { client_id: 'a'.repeat(501), client_secret: 'b' })).toEqual({ ok: false, error: 'client_id is too long' });
    expect(validate('outlook_calendar', { client_id: 'a'.repeat(500), client_secret: 'b' }).ok).toBe(true);
  });
  it.each([
    ['google_calendar', { client_id: 'id', client_secret: 'secret' }],
    ['outlook_calendar', { client_id: 'id', client_secret: 'secret' }],
    ['icloud_calendar', { client_id: 'id', client_secret: 'secret' }],
    ['linkedin', { client_id: 'id', client_secret: 'secret' }],
    ['onedrive', { client_id: 'id', client_secret: 'secret' }],
    ['facebook', { app_id: 'id', app_secret: 'secret' }],
  ])('accepts %s with exactly its fields, dropping anything else', (provider, creds) => {
    expect(validate(provider, { ...creds, user_id: 'someone-else', access_token: 'x' })).toEqual({ ok: true, provider, metadata: creds });
  });
  it('allows exactly the six providers', () => {
    expect(Object.keys(PROVIDER_FIELDS).sort()).toEqual(['facebook', 'google_calendar', 'icloud_calendar', 'linkedin', 'onedrive', 'outlook_calendar']);
  });
});

describe('Google Calendar uses B2BNEST’s own Google app (no Client ID or Secret to type)', () => {
  it('its card neither asks for credentials nor stores them, and asks only for calendar events', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../components/integrations/GoogleCalendarConnectCard.tsx'), 'utf8');
    expect(src).not.toMatch(/\.from\(\s*['"]user_integrations['"]\s*\)\s*\.upsert/);
    expect(src).not.toContain('store-oauth-client');
    expect(src).not.toContain('ConnectionModal');
    expect(src).toContain("invoke('get-oauth-config'");
    expect(src).toContain('GOOGLE_CALENDAR_SCOPE');
  });
});

describe('the Connect cards save through store-oauth-client', () => {
  const dir = path.resolve(__dirname, '../components/integrations');
  const cards: [string, string][] = [
    ['OutlookCalendarConnectCard.tsx', 'outlook_calendar'], ['iCloudCalendarConnectCard.tsx', 'icloud_calendar'],
    ['LinkedInConnectCard.tsx', 'linkedin'], ['OneDriveConnectCard.tsx', 'onedrive'], ['FacebookConnectCard.tsx', 'facebook'],
  ];
  it.each(cards)('%s has no browser upsert into user_integrations and invokes store-oauth-client for %s', (file, provider) => {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    expect(src).not.toMatch(/\.from\(\s*['"]user_integrations['"]\s*\)\s*\.upsert/);
    expect(src).toContain(`supabase.functions.invoke('store-oauth-client'`);
    expect(src).toContain(`provider: '${provider}'`);
  });
});

describe('the Google callback returns to the Integrations tab', () => {
  it('redirects to /business-tools?tool=integrations&google_connected=true (SITE_URL, localhost fallback as before)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/oauth-google-calendar/index.ts'), 'utf8');
    expect(src).toContain("`${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/business-tools?tool=integrations&google_connected=true`");
  });
});
