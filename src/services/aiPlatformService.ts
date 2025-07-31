import { Template } from '@/types/template';
import { templateService } from './templateService';

interface PlatformTool {
  id: string;
  name: string;
  description: string;
  category: 'CRM' | 'Project Management' | 'Finance' | 'Trading' | 'Analytics' | 'Documents' | 'Tools';
  path: string;
  features: string[];
}

interface PlatformIntent {
  category: string;
  toolType: string;
  urgency: 'low' | 'medium' | 'high';
  businessStage: 'startup' | 'growing' | 'established';
}

class AIPlatformService {
  private static instance: AIPlatformService;

  private platformTools: PlatformTool[] = [
    {
      id: 'crm',
      name: 'Customer Relationship Management',
      description: 'Manage customers, deals, and sales pipeline',
      category: 'CRM',
      path: '/crm',
      features: ['Contact Management', 'Deal Tracking', 'Sales Analytics', 'Customer Communications']
    },
    {
      id: 'project-management',
      name: 'Project Management Suite',
      description: 'Track projects, tasks, and team collaboration',
      category: 'Project Management',
      path: '/project-management',
      features: ['Task Management', 'Team Collaboration', 'Project Tracking', 'Time Management']
    },
    {
      id: 'invoice-generator',
      name: 'Invoice & Billing System',
      description: 'Create professional invoices and track payments',
      category: 'Finance',
      path: '/business-tools',
      features: ['Invoice Creation', 'Payment Tracking', 'Professional Templates', 'Auto-calculations']
    },
    {
      id: 'trading-analytics',
      name: 'Trading & Market Analytics',
      description: 'Advanced trading tools and market analysis',
      category: 'Trading',
      path: '/market',
      features: ['Real-time Prices', 'Chart Analysis', 'Portfolio Tracking', 'Market News']
    },
    {
      id: 'business-calculator',
      name: 'Business Calculators',
      description: 'ROI, cost analysis, and financial planning tools',
      category: 'Finance',
      path: '/business-tools',
      features: ['ROI Calculator', 'Cost Analysis', 'Financial Planning', 'Investment Tracking']
    },
    {
      id: 'document-templates',
      name: 'Document Templates Library',
      description: 'Professional business document templates',
      category: 'Documents',
      path: '/',
      features: ['Legal Documents', 'Business Plans', 'Contracts', 'Forms']
    }
  ];

  static getInstance(): AIPlatformService {
    if (!AIPlatformService.instance) {
      AIPlatformService.instance = new AIPlatformService();
    }
    return AIPlatformService.instance;
  }

  analyzeIntent(userMessage: string): PlatformIntent {
    const message = userMessage.toLowerCase();
    
    // Determine category based on keywords
    let category = 'general';
    let toolType = 'overview';
    
    if (message.includes('crm') || message.includes('customer') || message.includes('contact') || message.includes('sales')) {
      category = 'CRM';
      toolType = 'customer-management';
    } else if (message.includes('project') || message.includes('task') || message.includes('team') || message.includes('collaboration')) {
      category = 'Project Management';
      toolType = 'project-tracking';
    } else if (message.includes('invoice') || message.includes('billing') || message.includes('payment') || message.includes('finance')) {
      category = 'Finance';
      toolType = 'financial-tools';
    } else if (message.includes('trading') || message.includes('market') || message.includes('analytics') || message.includes('chart')) {
      category = 'Trading';
      toolType = 'market-analysis';
    } else if (message.includes('document') || message.includes('template') || message.includes('contract')) {
      category = 'Documents';
      toolType = 'document-creation';
    }

    // Determine urgency
    const urgency = message.includes('urgent') || message.includes('asap') || message.includes('immediately') 
      ? 'high' 
      : message.includes('soon') || message.includes('quickly') 
      ? 'medium' 
      : 'low';

    // Determine business stage
    const businessStage = message.includes('startup') || message.includes('new business') || message.includes('just starting')
      ? 'startup'
      : message.includes('growing') || message.includes('expanding') || message.includes('scale')
      ? 'growing'
      : 'established';

    return { category, toolType, urgency, businessStage };
  }

  getRecommendedTools(intent: PlatformIntent, limit: number = 4): PlatformTool[] {
    // Filter tools based on intent
    let relevantTools = this.platformTools.filter(tool => 
      tool.category === intent.category || intent.category === 'general'
    );

    // If no category match, return all tools
    if (relevantTools.length === 0) {
      relevantTools = this.platformTools;
    }

    // Sort by relevance
    relevantTools.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Exact category match gets highest priority
      if (a.category === intent.category) scoreA += 10;
      if (b.category === intent.category) scoreB += 10;

      // Business stage relevance
      if (intent.businessStage === 'startup') {
        if (a.category === 'Documents' || a.category === 'Finance') scoreA += 5;
        if (b.category === 'Documents' || b.category === 'Finance') scoreB += 5;
      }

      return scoreB - scoreA;
    });

    return relevantTools.slice(0, limit);
  }

  generateContextualResponse(userMessage: string, tools: PlatformTool[], templates?: Template[]): string {
    const intent = this.analyzeIntent(userMessage);
    
    let response = "I'd be happy to help you with that! ";

    if (tools.length > 0) {
      response += `Based on your request, I recommend these platform features:\n\n`;
      
      tools.forEach((tool, index) => {
        response += `${index + 1}. **${tool.name}**: ${tool.description}\n`;
        response += `   • Key features: ${tool.features.slice(0, 2).join(', ')}\n\n`;
      });
    }

    if (templates && templates.length > 0) {
      response += `I also found some relevant document templates that might help:\n\n`;
    }

    // Add contextual advice based on intent
    if (intent.category === 'CRM') {
      response += "💡 Pro tip: Start with contact management and gradually expand to deal tracking as your customer base grows.";
    } else if (intent.category === 'Project Management') {
      response += "💡 Pro tip: Begin with simple task tracking and add team collaboration features as your projects become more complex.";
    } else if (intent.category === 'Finance') {
      response += "💡 Pro tip: Combine invoice generation with our financial calculators for comprehensive business planning.";
    } else if (intent.category === 'Trading') {
      response += "💡 Pro tip: Use our real-time analytics alongside market news for informed trading decisions.";
    } else {
      response += "💡 Pro tip: Explore our integrated tools - they work great together for comprehensive business management!";
    }

    return response;
  }

  getQuickActions(tools: PlatformTool[]): string[] {
    const actions = [
      "Show me all business tools",
      "I need help getting started",
      "What's most popular for my business stage?"
    ];

    if (tools.some(tool => tool.category === 'CRM')) {
      actions.push("Tell me more about CRM features");
    }
    if (tools.some(tool => tool.category === 'Finance')) {
      actions.push("Show financial planning tools");
    }
    if (tools.some(tool => tool.category === 'Trading')) {
      actions.push("I want to see trading analytics");
    }

    return actions.slice(0, 4);
  }

  getAllTools(): PlatformTool[] {
    return this.platformTools;
  }
}

export const aiPlatformService = AIPlatformService.getInstance();