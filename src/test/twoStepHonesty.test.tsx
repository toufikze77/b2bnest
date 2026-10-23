import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Two-step sign-in is not enforced: signIn() only checks the password. While that is true, no screen may say a code
// is required at sign-in or that two-step is on/active. When real enforcement ships (docs/phase11a/mfa-design.md),
// signIn() changes and this test must be revisited deliberately.
const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const signInBody = (() => {
  const src = read('hooks/useAuth.tsx');
  const start = src.indexOf('const signIn = async');
  return src.slice(start, src.indexOf('\n  };', start));
})();
const enforced = /needs2FA|aal2|mfa\./i.test(signInBody);

const CLAIMS: RegExp[] = [
  /code is required when you sign in/i,
  /On for your account/,
  /two-factor authentication is (currently )?(enabled|active)/i,
  /two-step sign-in is (on|active|enabled)/i,
  /receive verification codes? (via|by) email when signing in/i,
  /2FA Required/,
  /Verify & Enable 2FA/,
  /Enable Two-Factor Authentication/i,
  /Enable 2FA/,
];

// Third-party advice (an Apple ID or Google account asking for its own two-factor code), not a B2BNEST claim.
const THIRD_PARTY = new Set([path.join('pages', 'articles', 'IntegrationsGuide.tsx')]);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !p.endsWith(path.join('supabase', 'types.ts')) ? [p] : [];
  });
}

describe('two-step sign-in honesty', () => {
  it('signIn() does not enforce a second step today (if this fails, enforcement shipped: update this test)', () => {
    expect(signInBody).toContain('signInWithPassword');
    expect(enforced).toBe(false);
  });

  it('no screen claims two-step is active or required while signIn() does not enforce it', () => {
    if (enforced) return;
    const hits = files(SRC).filter((f) => !THIRD_PARTY.has(path.relative(SRC, f))).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
      CLAIMS.some((re) => re.test(line)) ? [`${path.relative(SRC, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : []));
    expect(hits).toEqual([]);
  });

  it('the sign-in page has no "code required" branch that signIn() can never reach', () => {
    expect(read('pages/Auth.tsx')).not.toMatch(/needs2FA/);
  });
});

// AccountSecurity with an account whose old user_2fa_settings row says is_enabled = true (2 such accounts exist).
vi.mock('@/hooks/useAuth', () => { const auth = { user: { id: 'u1', email: 'a@example.test' } }; return { useAuth: () => auth }; });
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => {
  const q = (data: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data, error: null });
    b.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r);
    return b;
  };
  return { supabase: { from: (t: string) => q(t === 'user_2fa_settings' ? { is_enabled: true } : null), auth: { signOut: vi.fn() } } };
});

describe('Account security card', () => {
  it('says two-step is not active, even for an account with an old "enabled" row', async () => {
    const { default: AccountSecurity } = await import('@/components/settings/AccountSecurity');
    render(<MemoryRouter><AccountSecurity /></MemoryRouter>);
    expect(await screen.findByText('Not active yet')).toBeInTheDocument();
    expect(screen.queryByText(/On for your account/)).toBeNull();
    expect(screen.getByText(/Signing in needs only your password/)).toBeInTheDocument();
    expect(screen.getByText(/you turned this on earlier/i)).toBeInTheDocument();
  });
});
