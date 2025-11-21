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

    // Comprehensive B2BNest platform knowledge base
    const platformKnowledge = `
B2BNest Platform Features & Capabilities:

## PROJECT MANAGEMENT
- Create and manage unlimited projects with custom fields (name, description, status, progress, deadline, client, color, budget, priority, stage)
- Track project progress with visual indicators and deadlines
- Assign team members to projects with role-based permissions
- View projects in list or kanban board format
- Filter projects by status, priority, and team members
- Time tracking for projects and tasks
- Project activity timeline and history
- Budget tracking and financial management
- Client management and communication
- File attachments and document management

## TASK MANAGEMENT
- Create tasks with priorities (low, medium, high), status, due dates
- Assign tasks to team members
- Add subtasks and checklists
- Task comments and collaboration
- Task history and activity logs
- Recurring tasks support
- Task dependencies and relationships
- Email notifications for task updates
- Search and filter tasks across projects

## INTEGRATION HUB
The Integration Hub allows users to connect external services:

### Google Calendar Integration
- Sync events and meetings with Google Calendar
- Create calendar events from within B2BNest
- View calendar availability
- Automatic event reminders

### iCloud Calendar Integration
- Connect and sync Apple iCloud Calendar
- Manage calendar events and schedules
- Two-way synchronization with iCloud
- Support for multiple Apple calendars

### Outlook Calendar Integration (Microsoft 365)
- Connect Microsoft Outlook 365 Calendar
- Sync events and meetings with Outlook
- Create and manage Outlook calendar events
- Integration with Microsoft 365 ecosystem

### OneDrive Integration
- Connect Microsoft OneDrive account via OAuth2
- Access and manage OneDrive files directly from B2BNest
- Automatic file synchronization
- Secure token management and refresh

### Twitter Integration
- Connect Twitter account for social media management
- Schedule and post tweets
- View analytics and engagement metrics
- Manage multiple Twitter accounts

### LinkedIn Integration
- Connect LinkedIn profile for professional networking
- Share content to LinkedIn
- Schedule LinkedIn posts
- Access LinkedIn analytics

### Facebook Integration
- Connect Facebook pages and accounts
- Schedule Facebook posts
- View page insights and analytics
- Manage multiple Facebook pages

### Firecrawl Web Scraper
- Scrape single web pages or entire websites
- Extract clean, structured data from websites
- Convert web content to markdown or HTML
- LLM-ready data extraction for AI applications
- Rate limiting and credit-based usage
- Support for custom include/exclude tags
- Main content extraction (removes ads, navigation, etc.)

## HMRC INTEGRATION (UK Tax Authority)
- Connect to HMRC via OAuth2 authentication
- Submit VAT returns electronically
- File Corporation Tax returns
- Submit PAYE payroll information
- View tax obligations and deadlines
- Access submission history and logs
- Sandbox mode for testing
- Automatic token refresh
- Email notifications for submission status
- Multi-organization support

### HMRC Features:
- VAT Returns: Quarterly VAT submission with automatic calculations
- Tax Returns: Corporation Tax filing with supporting documents
- PAYE Submissions: Employee payroll data submission
- Obligation Tracking: View upcoming deadlines and requirements
- Submission Logs: Complete audit trail of all HMRC interactions
- Settings: Configure company details, VAT number, UTR, PAYE reference

## WORKFLOW AUTOMATION
- Visual workflow builder with drag-and-drop interface
- Pre-built workflow templates for common business processes
- Custom workflow creation with multiple node types:
  - Trigger nodes (webhooks, schedules, events)
  - Action nodes (email, API calls, database operations)
  - Logic nodes (conditions, loops, delays)
  - Integration nodes (connect to external services)
- Workflow execution history and logs
- Error handling and retry mechanisms
- Workflow testing and debugging
- Schedule workflows to run automatically
- Real-time workflow monitoring

### Workflow Features:
- LinkedIn Post Automation
- Twitter Post Scheduling
- Email Campaign Automation
- Data Processing Pipelines
- Multi-step Business Processes
- Conditional Logic and Branching
- Parallel Execution Support

## CRM (Customer Relationship Management)
- Contact management with full profiles
- Deal pipeline with drag-and-drop stages
- Lead tracking and scoring
- Activity logging and notes
- Email integration
- Task and appointment scheduling
- Sales forecasting and reporting
- Custom fields and tags
- Multi-currency support

## PAYROLL (UK)
- Employee management
- Payroll calculations (UK tax and NI)
- Payslip generation
- PAYE and NI submissions to HMRC
- Real-Time Information (RTI) reporting
- P60 and P45 generation
- Pension auto-enrollment
- Statutory payments (SSP, SMP, SPP)

## FINANCIAL TOOLS
- Invoice generation and management
- Expense tracking and categorization
- Bill management and payments
- Cash flow tracking
- ROI calculator
- Cost calculator with industry templates
- Multi-currency support
- Tax calculations (VAT, Corporation Tax)
- Financial reporting and analytics
- Bank account integration via TrueLayer

## DOCUMENT MANAGEMENT
- Document templates library
- AI-powered document generation
- Contract generator
- Privacy policy generator
- Business cards designer
- Email signature generator
- Document version control
- Secure file storage
- Document sharing and collaboration

## AI FEATURES
- AI Document Assistant for document creation
- AI Business Advisor for strategic guidance
- Smart search across all data
- Sentiment analysis
- Content generation
- Business insights and recommendations
- Automated data classification
- Predictive analytics

## SECURITY & COMPLIANCE
- Two-factor authentication (2FA)
- Role-based access control
- Audit logs for all actions
- Data encryption at rest and in transit
- GDPR compliance
- SOC 2 Type II certified infrastructure
- Regular security audits
- Backup and disaster recovery

## COLLABORATION
- Team workspaces
- Real-time collaboration
- Comments and mentions
- Activity feeds
- File sharing
- Team chat (coming soon)
- Video conferencing integration (coming soon)

## REPORTING & ANALYTICS
- Custom dashboards
- Business insights
- Financial reports
- Project analytics
- Team performance metrics
- Export to PDF, Excel, CSV
- Scheduled reports

## MOBILE & API
- Responsive web design (mobile-friendly)
- API access for integrations
- Webhook support
- REST API documentation
- Rate limiting and quotas

## SUPPORT & RESOURCES
- Knowledge base and documentation
- Video tutorials
- Email support
- Live chat support
- Community forum
- Feature request system
- Regular platform updates
`;

    // Build system prompt based on conversation type
    let systemPrompt = '';
    switch (conversationType) {
      case 'document_assistant':
        systemPrompt = `You are an expert business document assistant for B2BNest. Help users create, customize, and optimize business documents. Consider their industry: ${userIndustry}, business stage: ${businessStage}. Provide specific, actionable advice.

${platformKnowledge}`;
        break;
      case 'business_advisor':
        systemPrompt = `You are a strategic business advisor with expertise in ${userIndustry} industry. You have deep knowledge of the B2BNest platform. Provide insights on business growth, cost optimization, and strategic decisions for ${businessStage} businesses. Guide users on how to use B2BNest features to achieve their goals.

${platformKnowledge}`;
        break;
      case 'workflow_builder':
        systemPrompt = `You are an automation expert for B2BNest. Help users design efficient business workflows and processes using B2BNest's Workflow Automation features. Focus on practical, implementable solutions for ${userIndustry} businesses. Explain how to use workflow templates, integrations, and automation nodes.

${platformKnowledge}`;
        break;
      case 'cost_forecasting':
        systemPrompt = `You are a financial analyst specializing in business cost forecasting for B2BNest users. Analyze patterns and provide predictions based on business data and industry trends for ${userIndustry}. Help users leverage B2BNest's financial tools for accurate forecasting.

${platformKnowledge}`;
        break;
      default:
        systemPrompt = `You are B2BNest AI Assistant, a helpful AI assistant for business operations and management. You have comprehensive knowledge of all B2BNest features including Project Management, Integration Hub, HMRC, Workflow Automation, CRM, Payroll, Financial Tools, and more. Help users understand and make the most of the platform.

${platformKnowledge}

When users ask about features:
- Explain how to access and use them
- Provide step-by-step guidance
- Suggest best practices
- Offer tips for optimization
- Help troubleshoot issues

Be friendly, professional, and concise. Always prioritize user success.`;
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