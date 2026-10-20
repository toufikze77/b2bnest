// The two PUBLIC browser settings the app needs to reach Supabase. Both are shipped to every visitor in the built
// JavaScript; they are not secrets. Production values live in .env.production; Vercel dashboard values, if set, win.
export const SUPABASE_ENV_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

export type SupabaseConfig =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; missing: string[] };

type Env = Record<string, string | boolean | undefined>;

export function readSupabaseConfig(env: Env): SupabaseConfig {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const url = str(env.VITE_SUPABASE_URL);
  // VITE_SUPABASE_ANON_KEY is accepted as an older name for the same public key.
  const publishableKey = str(env.VITE_SUPABASE_PUBLISHABLE_KEY) ?? str(env.VITE_SUPABASE_ANON_KEY);
  const missing = [...(url ? [] : ['VITE_SUPABASE_URL']), ...(publishableKey ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY'])];
  return url && publishableKey ? { ok: true, url, publishableKey } : { ok: false, missing };
}

export const supabaseConfig: SupabaseConfig = readSupabaseConfig(import.meta.env as unknown as Env);
