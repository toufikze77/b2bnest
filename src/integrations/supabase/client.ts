import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

// Public values only: the project URL and the anon (publishable) key.
// Set them in .env locally and in the Vercel project settings.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

// A service-role key bypasses RLS and must never ship to the browser.
const jwtRole = (key: string) => {
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { return undefined; }
};
if (SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_') || jwtRole(SUPABASE_PUBLISHABLE_KEY) === 'service_role') {
  throw new Error('Refusing to start: a Supabase service-role key was provided to the browser client');
}

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
