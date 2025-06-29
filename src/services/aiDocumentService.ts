
import { Template } from '@/types/template';
import { templateService } from './templateService';

export interface DocumentIntent {
  category: string;
  subcategory?: string;
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  businessStage: 'startup' | 'growing' | 'established';
}

export class AIDocumentService {
  private static instance: AIDocumentService;

  static getInstance(): AIDocumentService {
    if (!AIDocumentService.instance) {
      AIDocumentService.instance = new AIDocumentService();
    }
    return AIDocumentService.instance;
  }

  // Analyze user intent from their message
  analyzeIntent(userMessage: string): DocumentIntent {
    const message = userMessage.toLowerCase();
    
    let category = 'general';
    let subcategory = undefined;
    let urgency: 'low' | 'medium' | 'high' = 'medium';
    let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
    let businessStage: 'startup' | 'growing' | 'established' = 'growing';

    // Analyze category
    if (message.includes('nda') || message.includes('confidential') || message.includes('non-disclosure')) {
      category = 'legal';
      subcategory = 'NDAs';
    } else if (message.includes('contract') || message.includes('agreement')) {
      category = 'legal';
      subcategory = 'Contracts';
    } else if (message.includes('invoice') || message.includes('billing')) {
      category = 'financial';
      subcategory = 'Invoices';
    } else if (message.includes('hr') || message.includes('employee') || message.includes('hiring')) {
      category = 'hr';
      subcategory = 'Onboarding';
    } else if (message.includes('marketing') || message.includes('social')) {
      category = 'marketing';
      subcategory = 'Social Media';
    }

    // Analyze urgency
    if (message.includes('urgent') || message.includes('asap') || message.includes('immediately')) {
      urgency = 'high';
    } else if (message.includes('when I have time') || message.includes('eventually')) {
      urgency = 'low';
    }

    // Analyze complexity
    if (message.includes('simple') || message.includes('basic') || message.includes('quick')) {
      complexity = 'simple';
    } else if (message.includes('comprehensive') || message.includes('detailed') || message.includes('advanced')) {
      complexity = 'complex';
    }

    // Analyze business stage
    if (message.includes('startup') || message.includes('new business') || message.includes('just starting')) {
      businessStage = 'startup';
    } else if (message.includes('established') || message.includes('mature') || message.includes('large company')) {
      businessStage = 'established';
    }

    return { category, subcategory, urgency, complexity, businessStage };
  }

  // Get personalized recommendations based on intent
  getPersonalizedRecommendations(intent: DocumentIntent, limit: number = 4): Template[] {
    let templates = templateService.searchTemplates('', {
      categories: intent.category !== 'general' ? [intent.category] : [],
      licenses: [],
      priceRange: [0, 1000],
      fileTypes: [],
      tags: [],
      rating: 0
    });

    // Sort by relevance to business stage and complexity
    templates = templates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Prioritize based on business stage
      if (intent.businessStage === 'startup') {
        if (a.price === 0) scoreA += 10;
        if (b.price === 0) scoreB += 10;
        if (a.difficulty === 'Beginner') scoreA += 5;
        if (b.difficulty === 'Beginner') scoreB += 5;
      } else if (intent.businessStage === 'established') {
        if (a.difficulty === 'Advanced') scoreA += 5;
        if (b.difficulty === 'Advanced') scoreB += 5;
      }

      // Prioritize based on complexity preference
      if (intent.complexity === 'simple' && a.difficulty === 'Beginner') scoreA += 8;
      if (intent.complexity === 'simple' && b.difficulty === 'Beginner') scoreB += 8;
      if (intent.complexity === 'complex' && a.difficulty === 'Advanced') scoreA += 8;
      if (intent.complexity === 'complex' && b.difficulty === 'Advanced') scoreB += 8;

      // Featured and trending templates get bonus points
      if (a.featured) scoreA += 3;
      if (b.featured) scoreB += 3;
      if (a.trending) scoreA += 2;
      if (b.trending) scoreB += 2;

      // Higher rated templates get bonus
      scoreA += a.rating;
      scoreB += b.rating;

      return scoreB - scoreA;
    });

    return templates.slice(0, limit);
  }

  // Generate contextual response based on user input
  generateContextualResponse(userMessage: string, templates: Template[]): string {
    const intent = this.analyzeIntent(userMessage);
    const message = userMessage.toLowerCase();
    
    let response = '';

    if (templates.length === 0) {
      response = "I understand you're looking for business documents. While I couldn't find exact matches for your specific request, let me suggest some popular templates that might be helpful. You can also try rephrasing your request or browse our categories.";
    } else {
      // Generate personalized response based on intent
      if (intent.businessStage === 'startup') {
        response = "Great! As a startup, having the right documents is crucial for establishing credibility and legal protection. ";
      } else if (intent.businessStage === 'established') {
        response = "Perfect! For established businesses, having comprehensive and professional documents is essential. ";
      }

      if (intent.urgency === 'high') {
        response += "I understand this is urgent, so I've prioritized templates that are ready to use immediately. ";
      }

      if (intent.complexity === 'simple') {
        response += "I've focused on straightforward, easy-to-use templates that won't overwhelm you. ";
      } else if (intent.complexity === 'complex') {
        response += "I've selected comprehensive templates with advanced features for your detailed needs. ";
      }

      response += `Here are ${templates.length} excellent template${templates.length === 1 ? '' : 's'} that match your requirements:`;
    }

    return response;
  }

  // Get quick action suggestions based on templates
  getQuickActions(templates: Template[]): string[] {
    const actions = [];
    
    if (templates.some(t => t.price === 0)) {
      actions.push("Show me only free templates");
    }
    
    if (templates.some(t => t.featured)) {
      actions.push("What makes these templates featured?");
    }
    
    if (templates.some(t => t.difficulty === 'Beginner')) {
      actions.push("I need something simple to start with");
    }
    
    actions.push("Can you explain how to use these?");
    actions.push("Show me related documents");
    
    return actions.slice(0, 3);
  }
}

export const aiDocumentService = AIDocumentService.getInstance();
