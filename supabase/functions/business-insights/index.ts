import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisType, data, industry, businessStage } = await req.json();

    const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);
    
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    let prompt = '';
    let insightType = '';

    switch (analysisType) {
      case 'cost_forecast':
        insightType = 'cost_forecast';
        prompt = `Analyze the following business cost data for a ${businessStage} ${industry} business and provide a 3-month forecast with recommendations:
        ${JSON.stringify(data)}
        
        Provide insights on:
        1. Cost trends and patterns
        2. Potential cost savings opportunities
        3. Budget recommendations
        4. Risk factors to watch
        
        Format as JSON with forecast, recommendations, and confidence score.`;
        break;

      case 'document_usage':
        insightType = 'document_usage';
        prompt = `Analyze document usage patterns for a ${industry} business:
        ${JSON.stringify(data)}
        
        Provide insights on:
        1. Most/least used document types
        2. Seasonal patterns
        3. Recommendations for document optimization
        4. Missing document types they might need
        
        Format as JSON with analysis and recommendations.`;
        break;

      case 'industry_trends':
        insightType = 'industry_trend';
        prompt = `Provide current industry trends and predictions for ${industry} businesses at ${businessStage} stage:
        
        Focus on:
        1. Market opportunities
        2. Regulatory changes
        3. Technology adoption trends
        4. Competitive landscape
        5. Actionable recommendations
        
        Format as JSON with trends and strategic recommendations.`;
        break;

      default:
        throw new Error('Invalid analysis type');
    }

    // Generate insights using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a business analyst with expertise in cost forecasting, document management, and industry trends. Always provide actionable insights in JSON format.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    const aiData = await response.json();
    const insights = aiData.choices[0].message.content;

    // Parse the JSON response to extract confidence score
    let parsedInsights;
    let confidenceScore = 0.8; // default
    
    try {
      parsedInsights = JSON.parse(insights);
      confidenceScore = parsedInsights.confidence_score || 0.8;
    } catch (e) {
      parsedInsights = { analysis: insights, confidence_score: 0.7 };
      confidenceScore = 0.7;
    }

    // Save insights to database
    const { data: savedInsight, error } = await supabase
      .from('business_insights')
      .insert({
        user_id: user.id,
        insight_type: insightType,
        data: parsedInsights,
        confidence_score: confidenceScore,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        insight: savedInsight,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in business-insights function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});