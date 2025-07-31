import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, category, context } = await req.json();

    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid user');
    }

    // Create system prompt based on category
    let systemPrompt = `You are an AI Business Assistant for a comprehensive business platform. You help users with:

PLATFORM FEATURES:
- CRM & Customer Management
- Project Management & Task Tracking  
- Financial Tools (Invoice generation, ROI calculators, cost analysis)
- Trading & Market Analytics
- Document Templates & Legal Forms
- Business Planning & Goal Tracking
- Integration Hub & Automation
- Compliance & Security Tools

Your responses should be:
- Practical and actionable
- Reference specific platform features when relevant
- Provide step-by-step guidance when needed
- Be concise but comprehensive
- Always maintain a professional, helpful tone

Current context: ${context || 'General business assistance'}
User's question category: ${category || 'General'}

Provide specific recommendations and guide users to relevant platform features.`;

    if (category === 'CRM') {
      systemPrompt += `\n\nFocus on CRM features: contact management, deal tracking, sales pipeline, customer communications, and analytics.`;
    } else if (category === 'Project Management') {
      systemPrompt += `\n\nFocus on project management: task tracking, team collaboration, project timelines, resource management, and productivity tools.`;
    } else if (category === 'Finance') {
      systemPrompt += `\n\nFocus on financial tools: invoice generation, payment tracking, ROI calculations, cost analysis, financial planning, and budgeting.`;
    } else if (category === 'Trading') {
      systemPrompt += `\n\nFocus on trading and analytics: market analysis, portfolio tracking, real-time prices, chart analysis, and investment tools.`;
    } else if (category === 'Documents') {
      systemPrompt += `\n\nFocus on document services: template library, legal forms, contracts, business plans, and document automation.`;
    }

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
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save conversation to database
    await supabase.from('ai_conversations').insert({
      user_id: user.id,
      message: message,
      response: aiResponse,
      category: category || 'general',
      context: context
    });

    return new Response(JSON.stringify({ 
      response: aiResponse,
      suggestions: generateSuggestions(category),
      quickActions: generateQuickActions(category)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI assistant function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I apologize, but I'm having trouble processing your request right now. Please try again or contact support if the issue persists."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateSuggestions(category: string): string[] {
  const suggestions: { [key: string]: string[] } = {
    'CRM': [
      "How do I set up my first customer contact?",
      "Show me deal tracking features",
      "Help me organize my sales pipeline",
      "What CRM analytics are available?"
    ],
    'Project Management': [
      "How do I create my first project?",
      "Show me task management features",
      "Help me set up team collaboration",
      "What project tracking tools are available?"
    ],
    'Finance': [
      "How do I create my first invoice?",
      "Show me ROI calculation tools",
      "Help me track business expenses",
      "What financial reporting is available?"
    ],
    'Trading': [
      "Show me market analysis tools",
      "How do I track my portfolio?",
      "What trading analytics are available?",
      "Help me understand market trends"
    ],
    'Documents': [
      "Show me business document templates",
      "How do I create a legal contract?",
      "What compliance documents are available?",
      "Help me generate business forms"
    ],
    'General': [
      "What tools are best for my business stage?",
      "Show me the most popular features",
      "How do I get started with the platform?",
      "What integrations are available?"
    ]
  };

  return suggestions[category] || suggestions['General'];
}

function generateQuickActions(category: string): string[] {
  const actions: { [key: string]: string[] } = {
    'CRM': ["Open CRM Dashboard", "Add New Contact", "View Sales Pipeline"],
    'Project Management': ["Create New Project", "View My Tasks", "Team Overview"],
    'Finance': ["Generate Invoice", "Financial Calculator", "Expense Tracker"],
    'Trading': ["Market Dashboard", "Portfolio Analysis", "Price Alerts"],
    'Documents': ["Browse Templates", "Create Document", "Legal Forms"],
    'General': ["Platform Tour", "Feature Overview", "Getting Started"]
  };

  return actions[category] || actions['General'];
}