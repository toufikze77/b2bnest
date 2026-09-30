import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(createHandler({
  corsHeaders,
  openaiUrl: 'https://api.openai.com/v1/chat/completions',
  openaiKey: Deno.env.get('OPENAI_API_KEY'),
  timeoutMs: 60_000,
  async getUserId(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user?.id ?? null;
  },
  async rpc(fn, args) {
    const { data, error } = await service.rpc(fn, args);
    return { data, error: error ? { message: error.message, code: error.code } : null };
  },
  async isSuperAdmin(userId) {
    const { data } = await service.rpc('is_super_admin', { _user_id: userId });
    return data === true;
  },
}));
