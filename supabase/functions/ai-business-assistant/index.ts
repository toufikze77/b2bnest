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

    // Create comprehensive platform-focused system prompt
    let systemPrompt = `You are the official AI Business Assistant for BusinessForms Pro - the ultimate all-in-one business automation platform. You are an expert on our platform and help users navigate, understand, and maximize the value of our comprehensive business tools.

COMPLETE PLATFORM KNOWLEDGE:

📋 DOCUMENT ECOSYSTEM:
- 1000+ Professional Templates (Legal contracts, Financial forms, HR documents, Marketing materials, Operations guides)
- AI-Powered Document Generation with smart customization
- Template Library organized by industry and business function
- Document Preview, Edit, and Professional Download options
- Custom branding and white-label document creation

🛠️ CORE BUSINESS TOOLS:
- Advanced CRM: Contact management, sales pipeline, deal tracking, customer communications, analytics dashboard
- Project Management: Task tracking, team collaboration, project timelines, resource allocation, productivity metrics
- Invoice & Quote Generator: Professional templates, automated billing, payment tracking, financial reporting
- Time Tracking: Employee productivity, project billing, detailed time analytics
- Business Generators: Company name ideas, startup concepts, business plan templates

💰 FINANCIAL SUITE:
- Business Cost Calculator: Startup expenses, operational costs, industry-specific calculations
- ROI Calculator: Investment analysis, profit projections, break-even analysis
- Cash Flow Tracker: Income/expense monitoring, budget management, financial forecasting
- Currency Converter: Multi-currency support, real-time exchange rates
- Financial Analytics: Revenue tracking, expense categorization, profit margins

📈 TRADING & MARKET INTELLIGENCE:
- Real-time Price Feeds: Crypto, Forex, Stocks, Commodities
- Advanced Charts: Candlestick analysis, technical indicators, market trends
- Market News: Business intelligence, industry updates, financial news aggregation
- Investment Tools: Portfolio tracking, performance analytics, risk assessment
- Economic Calendar: Market events, earnings reports, economic indicators

🤖 AI-POWERED AUTOMATION:
- Smart Business Advisory: Personalized recommendations based on business stage and industry
- Workflow Builder: Custom automation, trigger-based actions, integration flows
- Intelligent Analytics: Predictive insights, performance optimization, growth recommendations
- Personalized Dashboard: Customizable widgets, relevant tool suggestions, usage analytics

🔧 BUSINESS ACCELERATION:
- Compliance Checker: Legal requirements, industry regulations, audit preparation
- Business Setup Checklists: Step-by-step guides for new businesses, incorporation help
- Marketing Tools: Social media scheduling, email campaigns, content creation
- Integration Hub: Connect with popular business tools, API access, custom integrations
- User Management: Team collaboration, role-based permissions, multi-user access

DIRECTORY SERVICES:
- Business Directory: Company profiles, networking opportunities, partnership discovery
- Service Directory: Find professional services, contractor marketplace
- Supplier Directory: Vendor connections, bulk purchasing opportunities

Current User Context: ${context || 'Platform Navigation'}
Focus Area: ${category || 'General Platform Guidance'}

RESPONSE GUIDELINES:
- Provide specific, actionable advice about our platform features
- Guide users to exact tools and sections they need
- Give step-by-step instructions for platform navigation
- Suggest complementary features that enhance their workflow
- Reference specific URLs or page locations when helpful
- Answer questions about pricing, capabilities, and integrations
- Help troubleshoot common platform issues
- Maintain enthusiasm about our platform's capabilities while being genuinely helpful`;

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