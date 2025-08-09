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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('todos')
      .insert({
        title: body.title,
        description: body.description || '',
        status: 'todo',
        priority: body.priority || 'medium',
        project_id: body.project_id || null,
        // optional columns
        team_id: body.team_id || null,
        source: 'public-form'
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
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