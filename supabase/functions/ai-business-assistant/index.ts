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

// Enhanced AI Agents Configuration with specialized capabilities
const AI_AGENTS = {
  specialist: {
    model: 'gpt-4.1-2025-04-14',
    temperature: 0.2,
    maxTokens: 1000,
    role: 'Platform Expert & Feature Specialist',
    expertise: ['technical_features', 'specifications', 'integrations', 'advanced_capabilities']
  },
  advisor: {
    model: 'gpt-4.1-2025-04-14',
    temperature: 0.4,
    maxTokens: 800,
    role: 'Business Strategy & Process Advisor',
    expertise: ['business_optimization', 'roi_analysis', 'workflow_efficiency', 'growth_strategies']
  },
  navigator: {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 600,
    role: 'Platform Navigation & User Experience Guide',
    expertise: ['navigation', 'user_interface', 'step_by_step_guidance', 'quick_actions']
  },
  synthesizer: {
    model: 'gpt-4.1-2025-04-14',
    temperature: 0.3,
    maxTokens: 1200,
    role: 'Master AI Coordinator & Response Synthesizer',
    expertise: ['response_synthesis', 'context_understanding', 'intelligent_prioritization']
  }
};

// Comprehensive Platform Knowledge Base
const PLATFORM_KNOWLEDGE = {
  navigation: {
    dashboard: "/dashboard - Personalized dashboard with widgets, analytics, and quick access tools",
    crm: "/crm - Complete CRM suite with contacts, deals, analytics, and automation",
    projectManagement: "/project-management - Advanced project tracking, team collaboration, time management",
    documents: "/documents - 1000+ templates, AI generation, legal forms, contracts, invoices",
    finance: "/finance - Financial calculators, invoice generation, ROI analysis, cash flow tracking",
    trading: "/trading - Real-time market data, technical analysis, portfolio management, crypto tracking",
    settings: "/settings - User preferences, account settings, integrations, security options",
    aiStudio: "/ai-studio - AI-powered business tools, document generation, analytics",
    businessTools: "/business-tools - Comprehensive business toolkit and utilities"
  },
  features: {
    documents: {
      templates: "1000+ professional templates across all business categories",
      generation: "AI-powered document creation with custom branding and automation",
      categories: "Legal contracts, HR forms, marketing materials, financial documents, operations manuals"
    },
    crm: {
      contacts: "Advanced contact management with custom fields and relationship tracking",
      pipeline: "Visual sales pipeline with deal stages, probability tracking, and forecasting",
      analytics: "Comprehensive sales analytics, performance metrics, and reporting dashboards",
      automation: "Workflow automation, email sequences, and communication tracking"
    },
    finance: {
      invoicing: "Professional invoice and quote generation with multi-currency support",
      calculators: "ROI, cost analysis, break-even, loan, and investment calculators",
      tracking: "Cash flow monitoring, expense tracking, and financial planning tools",
      reporting: "Financial reports, P&L statements, and business analytics"
    },
    trading: {
      data: "Real-time market data for stocks, forex, crypto, and commodities",
      analysis: "Technical analysis tools, charting, and market intelligence",
      portfolio: "Portfolio tracking, performance analysis, and risk management",
      alerts: "Price alerts, market news, and trading notifications"
    },
    ai: {
      automation: "Smart workflow automation and business process optimization",
      analytics: "Predictive analytics, trend analysis, and business intelligence",
      generation: "AI-powered content creation, document generation, and data processing",
      personalization: "Intelligent recommendations and personalized user experiences"
    }
  },
  pricing: {
    free: {
      access: "Basic template library, limited CRM features, standard calculators",
      limits: "Up to 10 documents per month, basic analytics, community support"
    },
    pro: {
      access: "Full template library, advanced CRM, premium analytics, AI features",
      benefits: "Unlimited documents, advanced reporting, priority support, integrations"
    },
    enterprise: {
      access: "All features plus custom integrations, team management, white-label options",
      benefits: "Dedicated support, custom development, enterprise security, SLA guarantees"
    }
  },
  integrations: {
    accounting: "QuickBooks, Xero, FreshBooks integration for seamless financial management",
    communication: "Email marketing, CRM sync, notification systems",
    productivity: "Google Workspace, Microsoft 365, Slack integration",
    payment: "Stripe, PayPal, crypto payment processing",
    analytics: "Google Analytics, business intelligence tools, custom reporting"
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

    // Enhanced user intent analysis with conversation context
    const intentAnalysis = await analyzeUserIntent(message, category, context, user.id, supabase);
    console.log('Enhanced Intent Analysis:', intentAnalysis);

    // Determine which agents are most relevant based on intent
    const relevantAgents = selectRelevantAgents(intentAnalysis, category);
    console.log('Selected Agents:', relevantAgents);

    // Get responses from relevant AI agents in parallel for optimal performance
    const agentPromises = [];
    const agentTypes = [];

    if (relevantAgents.includes('specialist')) {
      agentPromises.push(getSpecialistResponse(message, category, context, intentAnalysis));
      agentTypes.push('specialist');
    }
    if (relevantAgents.includes('advisor')) {
      agentPromises.push(getAdvisorResponse(message, category, context, intentAnalysis));
      agentTypes.push('advisor');
    }
    if (relevantAgents.includes('navigator')) {
      agentPromises.push(getNavigatorResponse(message, category, context, intentAnalysis));
      agentTypes.push('navigator');
    }

    const agentResponses = await Promise.all(agentPromises);
    
    // Create response object with agent insights
    const agentInsights: any = {};
    agentTypes.forEach((type, index) => {
      agentInsights[type] = agentResponses[index];
    });

    // Synthesize final intelligent response using enhanced coordinator
    const finalResponse = await synthesizeResponses({
      agentInsights,
      intent: intentAnalysis,
      category,
      message,
      relevantAgents,
      userContext: { userId: user.id, conversationHistory: context }
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
      quickActions: generateQuickActions(category, intentAnalysis),
      confidence: intentAnalysis.confidence,
      agentInsights: Object.keys(agentInsights).reduce((acc: any, key) => {
        acc[key] = {
          summary: agentInsights[key].substring(0, 100) + '...',
          expertise: AI_AGENTS[key as keyof typeof AI_AGENTS]?.expertise || [],
          relevance: calculateRelevanceScore(intentAnalysis, key)
        };
        return acc;
      }, {}),
      intelligenceMetrics: {
        totalAgentsUsed: relevantAgents.length,
        processingTime: Date.now(),
        intentComplexity: intentAnalysis.complexity,
        responseQuality: calculateResponseQuality(intentAnalysis, finalResponse)
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

// Enhanced AI Agent Functions with Advanced Intelligence
async function analyzeUserIntent(message: string, category: string, context: string, userId: string, supabase: any) {
  try {
    // Get user's conversation history for better context understanding
    const { data: conversationHistory } = await supabase
      .from('ai_conversations')
      .select('message, response, category, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const contextualPrompt = `You are an advanced intent analysis AI for BusinessForms Pro. Analyze the user's message with deep contextual understanding.

ANALYSIS FRAMEWORK:
- intent_type: navigation|feature_inquiry|support|pricing|integration|workflow_optimization|troubleshooting|comparison
- complexity: low|medium|high|expert (based on technical depth required)
- urgency: low|medium|high|critical (based on business impact)
- confidence: 0-1 (your confidence in the analysis)
- keywords: [relevant platform features/terms mentioned]
- category_match: boolean (does message align with selected category)
- emotional_tone: neutral|frustrated|excited|curious|confused
- business_context: startup|established|enterprise|personal
- expected_outcome: information|action|guidance|solution
- followup_likelihood: low|medium|high (probability user will ask follow-ups)

CONVERSATION HISTORY: ${JSON.stringify(conversationHistory?.slice(0, 3) || [])}

Return valid JSON only.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{
          role: 'system',
          content: contextualPrompt
        }, {
          role: 'user',
          content: `Category: ${category}, Message: "${message}", Context: ${context}`
        }],
        max_tokens: 300,
        temperature: 0.1
      })
    });

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content || '{}');
    
    // Add enhanced metrics
    analysis.timestamp = new Date().toISOString();
    analysis.conversation_length = conversationHistory?.length || 0;
    
    return analysis;
  } catch (error) {
    console.error('Enhanced intent analysis error:', error);
    return { 
      intent_type: 'general', 
      complexity: 'medium', 
      urgency: 'medium', 
      confidence: 0.5, 
      keywords: [], 
      category_match: false,
      emotional_tone: 'neutral',
      business_context: 'established',
      expected_outcome: 'information',
      followup_likelihood: 'medium'
    };
  }
}

// Intelligent Agent Selection based on Intent Analysis
function selectRelevantAgents(intentAnalysis: any, category: string): string[] {
  const agents = [];
  
  // Always include navigator for navigation requests
  if (intentAnalysis.intent_type === 'navigation' || intentAnalysis.complexity === 'low') {
    agents.push('navigator');
  }
  
  // Include specialist for technical and feature inquiries
  if (['feature_inquiry', 'integration', 'troubleshooting'].includes(intentAnalysis.intent_type) || 
      intentAnalysis.complexity === 'high' || intentAnalysis.complexity === 'expert') {
    agents.push('specialist');
  }
  
  // Include advisor for business strategy and optimization
  if (['workflow_optimization', 'pricing', 'comparison'].includes(intentAnalysis.intent_type) || 
      intentAnalysis.business_context !== 'personal') {
    agents.push('advisor');
  }
  
  // For complex queries, use all agents
  if (intentAnalysis.complexity === 'expert' || intentAnalysis.urgency === 'critical') {
    return ['specialist', 'advisor', 'navigator'];
  }
  
  // Default: ensure at least one agent is selected
  if (agents.length === 0) {
    agents.push('navigator');
  }
  
  return agents;
}

// Enhanced Agent Response Functions with Specialized Intelligence

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
  const systemPrompt = `You are the Master AI Coordinator for BusinessForms Pro - an advanced AI system that synthesizes multiple specialized agent responses into the perfect user experience.

ADVANCED SYNTHESIS FRAMEWORK:
🎯 INTELLIGENCE PRIORITIES:
- Prioritize based on user intent: ${data.intent.intent_type}
- Adapt complexity to user context: ${data.intent.complexity}
- Match emotional tone: ${data.intent.emotional_tone || 'professional'}
- Align with business context: ${data.intent.business_context || 'business'}

🔄 RESPONSE OPTIMIZATION:
- Lead with most relevant agent insights based on intent analysis
- Seamlessly blend technical accuracy with practical guidance
- Include specific platform examples and step-by-step actions
- Provide clear next steps and follow-up suggestions
- Maintain platform expertise while being conversational

📊 QUALITY METRICS:
- Ensure response completeness (addresses all aspects of query)
- Verify accuracy (all platform information is correct)
- Confirm actionability (user can immediately apply guidance)
- Check engagement (response encourages platform exploration)

AGENT INSIGHTS AVAILABLE:
${Object.keys(data.agentInsights).map(agent => 
  `${agent.toUpperCase()}: ${data.agentInsights[agent]}`
).join('\n')}

SYNTHESIS INSTRUCTIONS:
1. Start with the most relevant information based on intent analysis
2. Integrate insights from ${data.relevantAgents.join(', ')} agents intelligently
3. Provide specific BusinessForms Pro examples and navigation paths
4. End with clear next steps and platform recommendations
5. Maintain enthusiasm while being practical and helpful

Create a unified, intelligent response that exceeds user expectations.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_AGENTS.synthesizer.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User Query: "${data.message}" | Category: ${data.category}` }
      ],
      max_tokens: AI_AGENTS.synthesizer.maxTokens,
      temperature: AI_AGENTS.synthesizer.temperature
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

function generateQuickActions(category: string, intentAnalysis?: any): string[] {
  const baseActions: { [key: string]: string[] } = {
    'CRM': ["Navigate to CRM Dashboard", "Add New Contact", "View Sales Pipeline", "Generate CRM Reports"],
    'Project Management': ["Create New Project", "View Task Board", "Team Performance", "Time Tracking"],
    'Finance': ["Generate Invoice", "Calculate ROI", "Track Cash Flow", "Financial Reports"],
    'Trading': ["View Market Data", "Analyze Charts", "Track Portfolio", "Set Price Alerts"],
    'Documents': ["Browse Templates", "Generate Document", "Legal Forms", "Custom Branding"],
    'AI': ["AI Document Assistant", "Business Insights", "Workflow Automation", "Predictive Analytics"],
    'General': ["Platform Tour", "Feature Overview", "Quick Setup", "Help Center"]
  };

  let actions = baseActions[category] || baseActions['General'];

  // Enhance actions based on intent analysis
  if (intentAnalysis) {
    if (intentAnalysis.urgency === 'high') {
      actions = actions.map(action => `🚀 ${action} (Priority)`);
    } else if (intentAnalysis.intent_type === 'navigation') {
      actions = actions.map(action => `📍 ${action.replace('View', 'Navigate to')}`);
    } else if (intentAnalysis.intent_type === 'feature_inquiry') {
      actions = actions.map(action => `💡 Learn: ${action}`);
    }
  }

  return actions;
}

// Advanced Intelligence Helper Functions
function calculateRelevanceScore(intentAnalysis: any, agentType: string): number {
  const relevanceMap: { [key: string]: { [key: string]: number } } = {
    specialist: {
      feature_inquiry: 0.9,
      integration: 0.95,
      troubleshooting: 0.85,
      support: 0.7
    },
    advisor: {
      workflow_optimization: 0.95,
      pricing: 0.9,
      comparison: 0.85,
      feature_inquiry: 0.6
    },
    navigator: {
      navigation: 0.95,
      support: 0.8,
      feature_inquiry: 0.7,
      workflow_optimization: 0.5
    }
  };

  return relevanceMap[agentType]?.[intentAnalysis.intent_type] || 0.5;
}

function calculateResponseQuality(intentAnalysis: any, response: string): number {
  let quality = 0.5; // Base quality score
  
  // Boost quality based on response length and detail
  if (response.length > 200) quality += 0.1;
  if (response.length > 500) quality += 0.1;
  
  // Boost quality based on intent complexity handling
  if (intentAnalysis.complexity === 'high' && response.length > 400) quality += 0.15;
  if (intentAnalysis.complexity === 'expert' && response.length > 600) quality += 0.2;
  
  // Boost quality based on confidence in intent analysis
  quality += intentAnalysis.confidence * 0.2;
  
  // Cap at 1.0
  return Math.min(quality, 1.0);
}