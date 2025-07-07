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
    const { 
      message, 
      conversationType, 
      context, 
      conversationId,
      userIndustry,
      businessStage 
    } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

    // Get user from authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Build system prompt based on conversation type
    let systemPrompt = '';
    switch (conversationType) {
      case 'document_assistant':
        systemPrompt = `You are an expert business document assistant. Help users create, customize, and optimize business documents. Consider their industry: ${userIndustry}, business stage: ${businessStage}. Provide specific, actionable advice.`;
        break;
      case 'business_advisor':
        systemPrompt = `You are a strategic business advisor with expertise in ${userIndustry} industry. Provide insights on business growth, cost optimization, and strategic decisions for ${businessStage} businesses.`;
        break;
      case 'workflow_builder':
        systemPrompt = `You are an automation expert. Help users design efficient business workflows and processes. Focus on practical, implementable solutions for ${userIndustry} businesses.`;
        break;
      case 'cost_forecasting':
        systemPrompt = `You are a financial analyst specializing in business cost forecasting. Analyze patterns and provide predictions based on business data and industry trends for ${userIndustry}.`;
        break;
      default:
        systemPrompt = 'You are a helpful AI assistant for business operations and document management.';
    }

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save conversation to database
    if (conversationId) {
      // Update existing conversation
      const { data: conversation } = await supabase
        .from('ai_conversations')
        .select('messages')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (conversation) {
        const updatedMessages = [
          ...conversation.messages,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
        ];

        await supabase
          .from('ai_conversations')
          .update({ messages: updatedMessages })
          .eq('id', conversationId);
      }
    } else {
      // Create new conversation
      await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          conversation_type: conversationType,
          messages: [
            { role: 'user', content: message, timestamp: new Date().toISOString() },
            { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
          ],
          context: { userIndustry, businessStage, ...context }
        });
    }

    // Generate insights based on conversation type
    if (conversationType === 'cost_forecasting') {
      await supabase
        .from('business_insights')
        .insert({
          user_id: user.id,
          insight_type: 'cost_forecast',
          data: {
            forecast: aiResponse,
            generated_for: context,
            methodology: 'ai_analysis'
          },
          confidence_score: 0.75,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        });
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        conversationType,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-assistant function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});