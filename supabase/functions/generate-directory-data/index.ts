import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { region, type, count = 10 } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompts = {
      suppliers: `Generate ${count} realistic suppliers for ${region}. Include name, contact_person, email, phone, address, website, payment_terms. Focus on diverse industries like manufacturing, technology, logistics, food service, etc.`,
      companies: `Generate ${count} realistic companies for ${region}. Include name, description, industry, size, location, website, founded_year. Make them diverse across different sectors and sizes.`,
      services: `Generate ${count} realistic business services for ${region}. Include title, description, category, subcategory, price, currency, contact_email, contact_phone, website_url. Cover professional services like consulting, legal, marketing, IT support, etc.`
    };

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
            content: `You are a business directory data generator. Generate realistic ${type} data for ${region}. Return ONLY a valid JSON array with no additional text or markdown. Ensure all data is realistic and region-appropriate.` 
          },
          { role: 'user', content: prompts[type as keyof typeof prompts] }
        ],
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('No content generated from AI');
    }

    let generatedData;
    try {
      // Extract JSON from the response, handling potential markdown formatting
      const content = data.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      generatedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: generatedData,
      region,
      type,
      count: generatedData.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-directory-data function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});