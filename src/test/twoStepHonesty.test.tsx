import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Phase 25: two-step sign-in is real (Supabase Auth TOTP). The second step is asked for by TwoStepGate for every sign-in
// path, and a screen may say "On" ONLY when mfa.listFactors() returns a verified factor. The old "not active yet" /
// "coming soon" wording is gone, and the old email-code screen is no longer reachable at sign-in.
const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const CLAIMS: RegExp[] = [
  /two-factor authentication is (currently )?(enabled|active)/i,
  /receive verification codes? (via|by) email when signing in/i,
  /2FA Required/,
  /Verify & Enable 2FA/,
  /Enable Two-Factor Authentication/i,
  /Enable 2FA/,
  /two-step sign-in is not active/i,
  /Coming soon: we'll tell you/,
  /On for your account/,
];
// Third-party advice (an Apple ID or Google account asking for its own two-factor code), and the old, now unreachable
// email-code screen (left in place, unused, until the clean-up phase).
const SKIP = new Set([path.join('pages', 'articles', 'IntegrationsGuide.tsx'), path.join('components', 'TwoFactorAuth.tsx')]);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') && !p.endsWith(path.join('supabase', 'types.ts')) ? [p] : [];
  });
}

describe('two-step sign-in honesty', () => {
  it('the second step is enforced app-wide: AssuranceProvider + TwoStepGate wrap every route', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/<AssuranceProvider>/);
    expect(app).toMatch(/<TwoStepGate>\s*<Layout>/);
    expect(read('components/ProtectedRoute.tsx')).toMatch(/assurance\.needsCode/);
  });

  it('the old email-code screen is no longer reachable at sign-in', () => {
    const auth = read('pages/Auth.tsx');
    expect(auth).not.toMatch(/import TwoFactorAuth/);
    expect(auth).not.toMatch(/<TwoFactorAuth/);
    expect(auth).not.toMatch(/verify2FA|sendVerificationCode|needs2FA/);
    const users = files(SRC).filter((f) => !f.endsWith('TwoFactorAuth.tsx') && /<TwoFactorAuth\b|from '@\/components\/TwoFactorAuth'/.test(fs.readFileSync(f, 'utf8')));
    expect(users).toEqual([]);
  });

  it('"On" is decided only from verified factors, never from the old table or a constant', () => {
    expect(read('lib/twoStep.ts')).not.toMatch(/TWO_STEP_ENFORCED\s*=/);
    expect(read('components/twoStep/TwoStepSetup.tsx')).toMatch(/const on = verified\.length > 0/);
    expect(read('components/settings/AccountSecurity.tsx')).not.toMatch(/user_2fa_settings/);
  });

  it('no screen uses the old or overclaiming wording', () => {
    const hits = files(SRC).filter((f) => !SKIP.has(path.relative(SRC, f))).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
      CLAIMS.some((re) => re.test(line)) ? [`${path.relative(SRC, f)}:${i + 1}: ${line.trim().slice(0, 120)}`] : []));
    expect(hits).toEqual([]);
  });
});

// Settings → Security for an account whose OLD user_2fa_settings row says is_enabled = true (2 such accounts exist) and
// that has no authenticator app: it must say Off.
vi.mock('@/hooks/useAuth', () => { const auth = { user: { id: 'u1', email: 'a@example.test' }, session: { access_token: 't' }, loading: false }; return { useAuth: () => auth }; });
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => {
  const q = (data: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data, error: null });
    b.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r);
    return b;
  };
  return { supabase: {
    from: (t: string) => q(t === 'user_2fa_settings' ? { is_enabled: true } : null),
    auth: { signOut: vi.fn(), mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }),
      listFactors: async () => ({ data: { all: [], totp: [] }, error: null }),
      unenroll: vi.fn(),
    } },
  } };
});

describe('Account security card', () => {
  it('says Off for an account with an old "enabled" row but no authenticator app, and names the apps', async () => {
    const { AssuranceProvider } = await import('@/components/twoStep/AssuranceProvider');
    const { default: AccountSecurity } = await import('@/components/settings/AccountSecurity');
    render(<MemoryRouter><AssuranceProvider><AccountSecurity /></AssuranceProvider></MemoryRouter>);
    expect(await screen.findByTestId('two-step-status')).toHaveTextContent('Off');
    expect(screen.getByText(/Microsoft Authenticator/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up an authenticator app' })).toBeInTheDocument();
  });
});
