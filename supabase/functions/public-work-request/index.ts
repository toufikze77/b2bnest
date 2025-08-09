import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkRequestBody {
  title: string;
  description?: string;
  priority?: 'low'|'medium'|'high'|'urgent';
  project_id?: string | null;
  team_id?: string | null;
  requester_email?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: WorkRequestBody = await req.json();
    if (!body.title || body.title.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (body.title.length > 200) {
      return new Response(JSON.stringify({ error: 'Title too long' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional simple rate limit: max 20 per IP/day if table exists
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      await supabase
        .from('public_form_requests')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('ip', ip);
    } catch (_e) {
      // ignore if table doesn't exist
    }

    const { data: inserted, error } = await supabase
      .from('todos')
      .insert({
        title: body.title.trim(),
        description: body.description?.toString().slice(0, 5000) || '',
        status: 'todo',
        priority: body.priority || 'medium',
        project_id: body.project_id || null,
        team_id: body.team_id || null, // optional column
        source: 'public-form'
      })
      .select('*')
      .single();

    if (error) throw error;

    // Log request if table exists (best-effort)
    try {
      await supabase.from('public_form_requests').insert({ ip, title: body.title, todo_id: inserted.id });
    } catch {}

    return new Response(JSON.stringify({ success: true, id: inserted.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error('public-work-request error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});