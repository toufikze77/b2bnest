import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissingConfigScreen, MISSING_CONFIG_MESSAGE } from './MissingConfigScreen';
import { readSupabaseConfig } from '@/integrations/supabase/config';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('missing Supabase settings', () => {
  it('the screen renders the plain message, with no values in it', () => {
    render(<MissingConfigScreen />);
    expect(screen.getByRole('heading', { level: 1, name: "B2BNEST can't start" })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(MISSING_CONFIG_MESSAGE);
    expect(document.body.textContent).not.toMatch(/supabase\.co|sb_publishable|eyJ/);
  });

  it('readSupabaseConfig names what is missing and accepts the older key name', () => {
    expect(readSupabaseConfig({})).toEqual({ ok: false, missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] });
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toEqual({ ok: false, missing: ['VITE_SUPABASE_URL'] });
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ ok: true, url: 'https://x.supabase.co', publishableKey: 'k' });
  });

  it('main.tsx shows the screen instead of a blank page, logs one error, and does not throw', async () => {
    vi.resetModules(); // the config module is cached by this file's static import; re-read it with the stubbed env
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    document.body.innerHTML = '<div id="root"></div>';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { await expect(import('@/main')).resolves.toBeDefined(); });
    await waitFor(() => expect(document.getElementById('root')).toHaveTextContent(MISSING_CONFIG_MESSAGE));
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toBe("B2BNEST can't start: missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in this build.");
  });

  it('importing the Supabase client without settings does not throw; using it fails clearly', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const mod = await import('@/integrations/supabase/client');
    expect(() => mod.supabase.from('notes')).toThrow(/without VITE_SUPABASE_URL \/ VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('with settings present, the real client is created (unchanged path)', async () => {
    vi.resetModules();
    const mod = await import('@/integrations/supabase/client');
    expect(typeof mod.supabase.from).toBe('function');
    expect(mod.SUPABASE_URL).toBe('https://test-project.supabase.co');
  });
});
