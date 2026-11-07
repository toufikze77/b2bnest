import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { supabaseConfig } from './config';
import { demoAwareFetch } from '@/lib/demoMode';
// Imported before the client is created, so the reset link is read before supabase-js clears it (see the file).
import { initialRecoveryLink, markRecovery } from '@/lib/passwordRecovery';

// Public values only: the project URL and the publishable (anon) key, from .env.production (or Vercel's settings).
// When they are missing, importing this module must not throw (main.tsx shows a readable "can't start" screen instead),
// so a stand-in is exported that fails clearly if anything tries to use it.
const SUPABASE_URL = 'url' in supabaseConfig ? supabaseConfig.url : '';
const SUPABASE_PUBLISHABLE_KEY = 'publishableKey' in supabaseConfig ? supabaseConfig.publishableKey : '';

// A service-role key bypasses RLS and must never ship to the browser.
const jwtRole = (key: string) => {
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { return undefined; }
};
if (supabaseConfig.ok && (SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_') || jwtRole(SUPABASE_PUBLISHABLE_KEY) === 'service_role')) {
  throw new Error('Refusing to start: a Supabase service-role key was provided to the browser client');
}

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const unconfigured = () => new Proxy({} as SupabaseClient<Database>, {
  get() {
    throw new Error('Supabase client used without VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in this build');
  },
});

export const supabase: SupabaseClient<Database> = supabaseConfig.ok
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: brokeredPreviewStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
      // Demo read-only: notices a demo refusal (403) so failure toasts can say so (src/lib/demoMode.ts).
      global: { fetch: demoAwareFetch((...args: Parameters<typeof fetch>) => fetch(...args)) },
    })
  : unconfigured();

// Password reset: supabase-js fires PASSWORD_RECOVERY right after reading the link, usually before the reset page has
// mounted. Note it here (no token kept) so /reset-password can show the form.
if (supabaseConfig.ok) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && initialRecoveryLink.isRecovery)) markRecovery();
  });
}
