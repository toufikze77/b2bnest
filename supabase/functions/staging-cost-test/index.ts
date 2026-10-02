import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const T = 'staging_cost_test_runs';
// Run 1 (failed: no OpenAI credit) is preserved. Owner approved exactly one more run: record 2.
const RUN_ID = 2;

Deno.serve(createHandler({
  corsHeaders,
  openaiUrl: 'https://api.openai.com/v1/chat/completions',
  openaiKey: Deno.env.get('OPENAI_STAGING_KEY'),
  timeoutMs: 45_000,
  async getUserId(h) {
    if (!h?.startsWith('Bearer ')) return null;
    const c = createClient(url, anon, { global: { headers: { Authorization: h } }, auth: { persistSession: false } });
    const { data, error } = await c.auth.getUser();
    return error ? null : data.user?.id ?? null;
  },
  async isSuperAdmin(uid) {
    const { data, error } = await svc.rpc('is_super_admin', { _user_id: uid });
    return !error && data === true;
  },
  store: {
    async claim(row) {
      const { error } = await svc.from(T).insert({ id: RUN_ID, ...row });
      if (!error) return 'ok';
      return error.code === '23505' ? 'taken' : 'error';
    },
    async saveResults(results, status) {
      const patch: Record<string, unknown> = { results };
      if (status) { patch.status = status; patch.finished_at = new Date().toISOString(); }
      const { error } = await svc.from(T).update(patch).eq('id', RUN_ID);
      return !error;
    },
    async read() {
      const { data, error } = await svc.from(T).select('*').eq('id', RUN_ID).maybeSingle();
      if (error) return undefined; // table missing => setup incomplete
      return data;
    },
  },
}));
