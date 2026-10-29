import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { checkAccess } from '../_shared/access.ts';
import { makeHandler } from './handler.ts';

// Phase 20: request handling (JSON mode, shape checks, no made-up fallback, no raw logging) lives in handler.ts.
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

serve(makeHandler({
  openAIKey: Deno.env.get('OPENAI_API_KEY'),
  getUserId: async (token) => {
    const { data: { user } } = await admin.auth.getUser(token);
    return user?.id ?? null;
  },
  // Phase 12: asked as the caller (their JWT), so the database decides.
  checkAccess: (authHeader) =>
    checkAccess(createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })),
  openai: (body, signal) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }),
  saveInsight: async (row) => {
    const { data, error } = await admin.from('business_insights').insert(row).select().single();
    if (error) throw new Error(error.code ?? 'insert_failed');
    return data;
  },
}));
