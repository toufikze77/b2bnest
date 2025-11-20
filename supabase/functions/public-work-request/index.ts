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

// Input validation utilities
const sanitizeString = (str: string): string => {
  return str.replace(/[<>]/g, '').trim();
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validatePriority = (priority: string): boolean => {
  return ['low', 'medium', 'high', 'urgent'].includes(priority);
};

const containsSqlInjection = (str: string): boolean => {
  const sqlPatterns = /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bEXEC\b|\bEXECUTE\b|--|\/\*|\*\/|;)/i;
  return sqlPatterns.test(str);
};

const validateInput = (body: WorkRequestBody): { valid: boolean; error?: string } => {
  // Title validation
  if (!body.title || body.title.trim().length === 0) {
    return { valid: false, error: 'Title is required' };
  }
  if (body.title.length > 200) {
    return { valid: false, error: 'Title must be 200 characters or less' };
  }
  if (containsSqlInjection(body.title)) {
    return { valid: false, error: 'Invalid characters in title' };
  }

  // Description validation
  if (body.description && body.description.length > 5000) {
    return { valid: false, error: 'Description must be 5000 characters or less' };
  }
  if (body.description && containsSqlInjection(body.description)) {
    return { valid: false, error: 'Invalid characters in description' };
  }

  // Priority validation
  if (body.priority && !validatePriority(body.priority)) {
    return { valid: false, error: 'Invalid priority value' };
  }

  // Email validation (if provided)
  if (body.requester_email && !validateEmail(body.requester_email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const body: WorkRequestBody = await req.json();

    // Validate input
    const validation = validateInput(body);
    if (!validation.valid) {
      console.warn(`Validation failed for IP ${ip}: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }), 
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Enhanced rate limiting: max 20 per IP/day
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error: countErr } = await supabase
        .from('public_form_requests')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('ip', ip);

      if (!countErr && count !== null && count >= 20) {
        console.warn(`Rate limit exceeded for IP ${ip}: ${count} requests today`);
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Maximum 20 requests per day.' }), 
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } catch (e) {
      console.error('Rate limiting check failed:', e);
      // Continue with request if rate limit check fails
    }

    // Sanitize inputs
    const sanitizedTitle = sanitizeString(body.title);
    const sanitizedDescription = body.description ? sanitizeString(body.description.slice(0, 5000)) : '';

    // Insert todo
    const { data: inserted, error } = await supabase
      .from('todos')
      .insert({
        title: sanitizedTitle,
        description: sanitizedDescription,
        status: 'todo',
        priority: body.priority || 'medium',
        project_id: body.project_id || null,
        team_id: body.team_id || null,
        source: 'public-form'
      })
      .select('*')
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }

    // Log request for monitoring
    try {
      await supabase.from('public_form_requests').insert({ 
        ip, 
        title: sanitizedTitle.slice(0, 100), // Only store truncated title for privacy
        todo_id: inserted.id,
        user_agent: userAgent.slice(0, 255)
      });
    } catch (logErr) {
      console.error('Failed to log request:', logErr);
    }

    console.log(`Work request created successfully: ID ${inserted.id}, IP ${ip}`);

    return new Response(JSON.stringify({ success: true, id: inserted.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error('Public work request error:', { error: e.message, ip, userAgent });
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }), 
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
