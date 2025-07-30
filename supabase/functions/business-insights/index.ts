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
        prompt = `Analyze the following business cost data for a ${businessStage} ${industry} business and provide a detailed analysis:
        ${JSON.stringify(data)}
        
        Provide a structured analysis with:
        1. cost_trends: {average_monthly_expense: number, trend: string, pattern: string}
        2. cost_savings_opportunities: {recommendations: [{area: string, suggestion: string}]}
        3. budget_recommendations: {forecast: {Apr: number, May: number, Jun: number}, rationale: string}
        4. risk_factors: {potential_risks: [{risk: string, impact: string}]}
        
        Return ONLY a valid JSON object with the analysis structure above. Do not include markdown formatting.`;
        break;

      case 'document_usage':
        insightType = 'document_usage';
        prompt = `Analyze document usage patterns for a ${industry} business:
        ${JSON.stringify(data)}
        
        Provide a structured analysis with:
        1. usage_analysis: {top_categories: {contracts: number, invoices: number, hr_forms: number, marketing: number}, total_downloads: number}
        2. insights: {most_popular: string, least_used: string, trend: string}
        3. recommendations: [string array of optimization suggestions]
        
        Return ONLY a valid JSON object with the analysis structure above. Do not include markdown formatting.`;
        break;

      case 'industry_trends':
        insightType = 'industry_trend';
        prompt = `Provide current industry trends analysis for ${industry} businesses at ${businessStage} stage:
        
        Provide a structured analysis with:
        1. market_opportunities: [{opportunity: string, potential_impact: string}]
        2. regulatory_changes: [{change: string, timeline: string, impact: string}]
        3. technology_trends: [{trend: string, adoption_rate: string, business_impact: string}]
        4. strategic_recommendations: [string array of actionable recommendations]
        
        Return ONLY a valid JSON object with the analysis structure above. Do not include markdown formatting.`;
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
    let insights = aiData.choices[0].message.content;

    // Clean up the response - remove markdown code blocks and extra formatting
    insights = insights.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse the JSON response to extract confidence score
    let parsedInsights;
    let confidenceScore = 0.8; // default
    
    try {
      parsedInsights = JSON.parse(insights);
      confidenceScore = parsedInsights.confidence_score || 0.8;
      
      // Log successful parsing for debugging
      console.log('Successfully parsed insights:', JSON.stringify(parsedInsights, null, 2));
      
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      console.log('Raw AI response:', insights);
      
      // Fallback: create a structured response
      parsedInsights = { 
        analysis: insights,
        error: 'Failed to parse AI response',
        confidence_score: 0.7 
      };
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