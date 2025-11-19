import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const {
      company_name,
      contact_name,
      email,
      phone,
      industry,
      company_size,
      message,
      priority = 'medium'
    } = await req.json();

    // Validate required fields
    if (!company_name || !contact_name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let aiAnalysis = null;
    let aiScore = null;

    // AI analysis if Lovable AI is available
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a B2B lead qualification assistant. Analyze the following B2B form submission and provide: 1) lead quality score (0-100), 2) key insights, 3) recommended next actions. Return JSON format with keys: score, insights (array), recommendations (array).'
              },
              {
                role: 'user',
                content: `Company: ${company_name}\nContact: ${contact_name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nIndustry: ${industry || 'N/A'}\nCompany Size: ${company_size || 'N/A'}\nMessage: ${message}\nPriority: ${priority}`
              }
            ],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              const parsed = JSON.parse(content);
              aiScore = parsed.score || null;
              aiAnalysis = parsed;
            } catch {
              aiAnalysis = { raw_response: content };
            }
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
        // Continue without AI analysis
      }
    }

    // Insert submission into database
    const { data, error } = await supabase
      .from('b2b_form_submissions')
      .insert({
        company_name,
        contact_name,
        email,
        phone,
        industry,
        company_size,
        message,
        priority,
        ai_analysis: aiAnalysis,
        ai_score: aiScore,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to submit form' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        id: data.id,
        ai_score: aiScore,
        message: 'B2B form submitted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});