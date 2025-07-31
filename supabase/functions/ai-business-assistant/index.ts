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

// AI Agents Configuration
const AI_AGENTS = {
  specialist: {
    model: 'gpt-4.1-2025-04-14',
    temperature: 0.3,
    maxTokens: 800,
    role: 'Platform Expert & Feature Specialist'
  },
  advisor: {
    model: 'gpt-4o-mini',
    temperature: 0.5,
    maxTokens: 600,
    role: 'Business Process Advisor'
  },
  navigator: {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 400,
    role: 'Platform Navigation Guide'
  }
};

// Enhanced platform knowledge base
const PLATFORM_KNOWLEDGE = {
  navigation: {
    dashboard: "/dashboard - Main user dashboard with personalized widgets",
    crm: "/crm - Customer Relationship Management tools",
    projectManagement: "/project-management - Task and project tracking",
    documents: "/documents - Template library and document generation",
    finance: "/finance - Financial tools and calculators",
    trading: "/trading - Market data and investment tools",
    settings: "/settings - User preferences and account settings"
  },
  features: {
    documents: "1000+ professional templates, AI generation, custom branding",
    crm: "Contact management, deal pipeline, sales analytics, communication tracking",
    finance: "Invoice generation, cost calculators, ROI analysis, cash flow tracking",
    trading: "Real-time prices, technical analysis, portfolio management",
    ai: "Smart recommendations, workflow automation, predictive analytics"
  },
  pricing: {
    free: "Basic document access, limited CRM, standard calculators",
    pro: "Full template library, advanced CRM, premium analytics",
    enterprise: "Custom integrations, team management, priority support"
  }
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

    // Analyze user intent and select appropriate AI agents
    const intentAnalysis = await analyzeUserIntent(message, category, context);
    console.log('Intent Analysis:', intentAnalysis);

    // Get responses from multiple AI agents in parallel
    const [specialistResponse, advisorResponse, navigatorResponse] = await Promise.all([
      getSpecialistResponse(message, category, context, intentAnalysis),
      getAdvisorResponse(message, category, context, intentAnalysis),
      getNavigatorResponse(message, category, context, intentAnalysis)
    ]);

    // Synthesize final intelligent response
    const finalResponse = await synthesizeResponses({
      specialist: specialistResponse,
      advisor: advisorResponse,
      navigator: navigatorResponse,
      intent: intentAnalysis,
      category,
      message
    });

    console.log('Final synthesized response:', finalResponse.substring(0, 200) + '...');

    // Save conversation to database
    await supabase.from('ai_conversations').insert({
      user_id: user.id,
      message: message,
      response: finalResponse,
      category: category || 'general',
      context: JSON.stringify({ originalContext: context, intentAnalysis })
    });

    return new Response(JSON.stringify({ 
      response: finalResponse,
      suggestions: generateIntelligentSuggestions(category, intentAnalysis),
      quickActions: generateQuickActions(category),
      confidence: intentAnalysis.confidence,
      agentInsights: {
        specialist: specialistResponse.substring(0, 100) + '...',
        advisor: advisorResponse.substring(0, 100) + '...',
        navigator: navigatorResponse.substring(0, 100) + '...'
      }
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
      "How do I access the CRM dashboard in BusinessForms Pro?",
      "What contact management features are available?",
      "How does the sales pipeline tracking work?",
      "Can you show me the CRM analytics and reporting tools?"
    ],
    'Project Management': [
      "Where is the Project Management section located?",
      "How do I create and assign tasks to team members?",
      "What collaboration features does the platform offer?",
      "How can I track project timelines and milestones?"
    ],
    'Finance': [
      "How do I access the Invoice Generator tool?",
      "What financial calculators are built into the platform?",
      "Where can I find the Cash Flow Tracker?",
      "How does the ROI Calculator work?"
    ],
    'Trading': [
      "Where are the real-time price feeds displayed?",
      "How do I access the trading charts and analysis tools?",
      "What market intelligence features are available?",
      "How can I track my investment portfolio?"
    ],
    'Documents': [
      "How many document templates are available?",
      "How do I search for specific business document types?",
      "What legal forms and contracts can I generate?",
      "How does the AI document generation work?"
    ],
    'General': [
      "What makes BusinessForms Pro different from other platforms?",
      "How do I navigate between different tool sections?",
      "What are the most popular features on the platform?",
      "How do I customize my dashboard and preferences?"
    ]
  };

  return suggestions[category] || suggestions['General'];
}

// AI Agent Functions
async function analyzeUserIntent(message: string, category: string, context: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `Analyze user intent for BusinessForms Pro platform queries. Return JSON with: intent_type (navigation|feature_inquiry|support|pricing|integration), complexity (low|medium|high), urgency (low|medium|high), confidence (0-1), keywords[], and category_match (boolean).`
        }, {
          role: 'user',
          content: `Category: ${category}, Message: "${message}", Context: ${context}`
        }],
        max_tokens: 200,
        temperature: 0.1
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content || '{"intent_type":"general","complexity":"medium","urgency":"medium","confidence":0.7,"keywords":[],"category_match":false}');
  } catch (error) {
    console.error('Intent analysis error:', error);
    return { intent_type: 'general', complexity: 'medium', urgency: 'medium', confidence: 0.5, keywords: [], category_match: false };
  }
}

async function getSpecialistResponse(message: string, category: string, context: string, intent: any) {
  const systemPrompt = `You are the Platform Expert & Feature Specialist for BusinessForms Pro. You have deep technical knowledge of all platform features and capabilities.

EXPERT KNOWLEDGE:
📋 DOCUMENTS: 1000+ templates, AI generation, custom branding, legal forms, contracts
🛠️ CRM: Advanced contact management, sales pipeline, deal tracking, analytics, communications
💰 FINANCE: Invoice/quote generation, cost calculators, ROI analysis, cash flow tracking, multi-currency
📈 TRADING: Real-time market data, technical analysis, portfolio management, economic calendar
🤖 AI TOOLS: Smart recommendations, workflow automation, predictive analytics, personalization
🔧 INTEGRATIONS: API access, third-party connections, automation workflows

Navigation Paths: ${JSON.stringify(PLATFORM_KNOWLEDGE.navigation)}
Features: ${JSON.stringify(PLATFORM_KNOWLEDGE.features)}

Focus on: Technical details, feature capabilities, specifications, and advanced use cases.
Category: ${category} | Intent: ${intent.intent_type} | Complexity: ${intent.complexity}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_AGENTS.specialist.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: AI_AGENTS.specialist.maxTokens,
      temperature: AI_AGENTS.specialist.temperature
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getAdvisorResponse(message: string, category: string, context: string, intent: any) {
  const systemPrompt = `You are the Business Process Advisor for BusinessForms Pro. You provide strategic guidance on how to leverage platform tools for business success.

ADVISORY FOCUS:
🎯 BUSINESS STRATEGY: How features align with business goals and growth objectives
📊 WORKFLOW OPTIMIZATION: Best practices for using multiple platform tools together
💼 PRODUCTIVITY: Tips for maximizing efficiency and ROI from platform features
🚀 GROWTH: Recommendations for scaling operations using platform capabilities
🔄 PROCESS IMPROVEMENT: Integration strategies and automation opportunities

Pricing Tiers: ${JSON.stringify(PLATFORM_KNOWLEDGE.pricing)}

Focus on: Business value, ROI, process optimization, and strategic recommendations.
Category: ${category} | Intent: ${intent.intent_type} | Urgency: ${intent.urgency}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_AGENTS.advisor.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: AI_AGENTS.advisor.maxTokens,
      temperature: AI_AGENTS.advisor.temperature
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getNavigatorResponse(message: string, category: string, context: string, intent: any) {
  const systemPrompt = `You are the Platform Navigation Guide for BusinessForms Pro. You provide clear, step-by-step guidance on accessing and using platform features.

NAVIGATION EXPERTISE:
🗺️ PLATFORM LAYOUT: Exact locations of features, tools, and settings
📍 STEP-BY-STEP GUIDES: Clear instructions for accessing any platform functionality
🔍 FEATURE DISCOVERY: Help users find the right tools for their needs
⚡ QUICK ACTIONS: Fast paths to commonly needed functions
🎛️ SETTINGS & PREFERENCES: Account configuration and customization options

URLs & Paths: ${JSON.stringify(PLATFORM_KNOWLEDGE.navigation)}

Focus on: Clear directions, specific steps, exact locations, and user-friendly guidance.
Category: ${category} | Intent: ${intent.intent_type}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_AGENTS.navigator.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: AI_AGENTS.navigator.maxTokens,
      temperature: AI_AGENTS.navigator.temperature
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function synthesizeResponses(data: any) {
  const systemPrompt = `You are the Master AI Coordinator for BusinessForms Pro. Synthesize multiple AI agent responses into one comprehensive, intelligent answer.

SYNTHESIS GUIDELINES:
- Combine technical expertise, business advice, and navigation guidance
- Prioritize most relevant information based on user intent
- Ensure response is coherent, actionable, and platform-focused
- Include specific examples and clear next steps
- Maintain enthusiasm about platform capabilities

Intent: ${data.intent.intent_type} | Category: ${data.category} | Confidence: ${data.intent.confidence}

Agent Responses:
SPECIALIST: ${data.specialist}
ADVISOR: ${data.advisor}
NAVIGATOR: ${data.navigator}

Create a unified, intelligent response that best serves the user's needs.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: data.message }
      ],
      max_tokens: 1000,
      temperature: 0.4
    })
  });

  const responseData = await response.json();
  return responseData.choices[0].message.content;
}

function generateIntelligentSuggestions(category: string, intent: any): string[] {
  const baseSuggestions = generateSuggestions(category);
  
  // Enhance suggestions based on intent analysis
  if (intent.intent_type === 'navigation') {
    return [
      `How do I navigate to the ${category} section?`,
      `What's the quickest way to access ${category} features?`,
      `Can you show me the ${category} dashboard layout?`,
      `Where are the ${category} settings located?`
    ];
  } else if (intent.intent_type === 'feature_inquiry') {
    return [
      `What advanced ${category} features are available?`,
      `How do I maximize ${category} tool efficiency?`,
      `What integrations work with ${category}?`,
      `Can you explain ${category} analytics capabilities?`
    ];
  } else if (intent.intent_type === 'pricing') {
    return [
      `What ${category} features are included in each plan?`,
      `How does ${category} pricing compare to competitors?`,
      `Are there any ${category} feature limitations?`,
      `What's the ROI of upgrading for ${category} tools?`
    ];
  }
  
  return baseSuggestions;
}

function generateSuggestions(category: string): string[] {
  const suggestions: { [key: string]: string[] } = {
    'CRM': [
      "How do I access the CRM dashboard in BusinessForms Pro?",
      "What contact management features are available?",
      "How does the sales pipeline tracking work?",
      "Can you show me the CRM analytics and reporting tools?"
    ],
    'Project Management': [
      "Where is the Project Management section located?",
      "How do I create and assign tasks to team members?",
      "What collaboration features does the platform offer?",
      "How can I track project timelines and milestones?"
    ],
    'Finance': [
      "How do I access the Invoice Generator tool?",
      "What financial calculators are built into the platform?",
      "Where can I find the Cash Flow Tracker?",
      "How does the ROI Calculator work?"
    ],
    'Trading': [
      "Where are the real-time price feeds displayed?",
      "How do I access the trading charts and analysis tools?",
      "What market intelligence features are available?",
      "How can I track my investment portfolio?"
    ],
    'Documents': [
      "How many document templates are available?",
      "How do I search for specific business document types?",
      "What legal forms and contracts can I generate?",
      "How does the AI document generation work?"
    ],
    'General': [
      "What makes BusinessForms Pro different from other platforms?",
      "How do I navigate between different tool sections?",
      "What are the most popular features on the platform?",
      "How do I customize my dashboard and preferences?"
    ]
  };

  return suggestions[category] || suggestions['General'];
}

function generateQuickActions(category: string): string[] {
  const actions: { [key: string]: string[] } = {
    'CRM': ["Navigate to CRM", "View Contact Management", "Check Sales Analytics", "Explore Lead Tracking"],
    'Project Management': ["Open Project Hub", "View Task Dashboard", "Team Collaboration Guide", "Time Tracking Tools"],
    'Finance': ["Access Invoice Generator", "Open ROI Calculator", "View Cash Flow Tracker", "Financial Planning Tools"],
    'Trading': ["Market Data Dashboard", "Real-time Price Feeds", "Chart Analysis Tools", "Portfolio Tracking"],
    'Documents': ["Browse 1000+ Templates", "AI Document Generator", "Legal Forms Library", "Business Plan Creator"],
    'General': ["Platform Overview", "Feature Navigation", "Tool Recommendations", "Getting Started Guide"]
  };

  return actions[category] || actions['General'];
}