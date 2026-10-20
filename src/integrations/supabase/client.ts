import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { supabaseConfig } from './config';

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
      }
    })
  : unconfigured();
