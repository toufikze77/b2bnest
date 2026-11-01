// Phase 24: ?next= only ever returns to a page on this site.
import { describe, it, expect } from 'vitest';
import { authUrlWithNext, safeReturnPath, safeNext } from './onboarding';

describe('safeReturnPath (?next= after sign-in)', () => {
  it.each(['/template-center', '/business-tools?tool=crm', '/crm?tab=deals#x', '/settings?tab=members', '/join?token=abc', '/'])(
    'keeps the same-origin path %s', (p) => expect(safeReturnPath(p)).toBe(p),
  );
  it.each([
    'https://evil.example/', 'http://evil.example', 'javascript:alert(1)', 'data:text/html,x', 'evil.example',
    '//evil.example', '//evil.example/template-center', '///evil.example', '/\\evil.example', '\\\\evil.example',
    '/\t/evil.example', '/\n/evil.example', ' /x', '/x y', '/auth', '/auth?next=/crm', '', null, undefined,
  ])('rejects %j → home', (p) => expect(safeReturnPath(p as string | null | undefined)).toBe('/'));

  it('authUrlWithNext encodes the vetted path and drops anything foreign', () => {
    expect(authUrlWithNext('/template-center?category=sales')).toBe('/auth?next=%2Ftemplate-center%3Fcategory%3Dsales');
    expect(authUrlWithNext('//evil.example')).toBe('/auth?next=%2F');
    expect(authUrlWithNext('https://evil.example/')).toBe('/auth?next=%2F');
  });

  it('confirmation emails keep the stricter allow-list (Supabase redirect list), unchanged', () => {
    expect(safeNext('/template-center')).toBe('/');
    expect(safeNext('/join?token=abc')).toBe('/join?token=abc');
  });
});
