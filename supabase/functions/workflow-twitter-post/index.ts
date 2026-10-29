import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { makeHandler, sendTweet } from "./handler.ts";

// Phase 21: request handling and the plan check live in handler.ts.
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

serve(makeHandler({
  getUser: async (token) => {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    return error || !user ? null : { id: user.id }
  },
  // The one access function (Phase 12/19), read with the service role. An error throws, so the handler refuses.
  accessState: async (userId) => {
    const { data, error } = await supabase.rpc('_access_state_for', { _uid: userId })
    if (error) throw new Error(`_access_state_for: ${error.code ?? ''} ${error.message}`)
    return (Array.isArray(data) ? data[0] : data) ?? null
  },
  getTokens: async (userId) => {
    const { data } = await supabase.rpc('get_integration_tokens', { p_integration_name: 'twitter', p_user_id: userId })
    return data
  },
  env: (name) => Deno.env.get(name),
  sendTweet,
}));
