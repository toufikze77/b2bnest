import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { checkAccess } from '../_shared/access.ts';
import { makeHandler } from './handler.ts';

// Phase 20: request handling, the credit reserve/refund and the platform knowledge live in handler.ts / knowledge.ts.
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
  deduct: async (userId) => {
    const { data, error } = await admin.rpc('check_and_deduct_ai_credit', { p_user_id: userId, p_credits_to_deduct: 1 });
    return { data, error };
  },
  // docs/phase20/proposal.sql. Until it is applied this throws, and the answer says the credit couldn't be returned.
  refund: async (userId) => {
    const { data, error } = await admin.rpc('refund_ai_credit', { p_user_id: userId, p_credits: 1 });
    if (error || !data?.success) throw new Error(error?.code ?? data?.error ?? 'refund_failed');
    return data;
  },
  openai: (body, signal) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }),
  save: async ({ userId, conversationId, conversationType, message, answer, context }) => {
    const now = new Date().toISOString();
    const turn = [{ role: 'user', content: message, timestamp: now }, { role: 'assistant', content: answer, timestamp: now }];
    if (conversationId) {
      const { data: conversation } = await admin.from('ai_conversations').select('messages')
        .eq('id', conversationId).eq('user_id', userId).single();
      if (conversation) {
        await admin.from('ai_conversations').update({ messages: [...conversation.messages, ...turn] })
          .eq('id', conversationId).eq('user_id', userId);
      }
    } else {
      await admin.from('ai_conversations').insert({ user_id: userId, conversation_type: conversationType, messages: turn, context });
    }
    // Unchanged from before Phase 20: a cost forecast answer is also kept as an insight for 30 days.
    if (conversationType === 'cost_forecasting') {
      await admin.from('business_insights').insert({
        user_id: userId, insight_type: 'cost_forecast',
        data: { forecast: answer, generated_for: context, methodology: 'ai_analysis' },
        confidence_score: 0.75, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  },
}));
