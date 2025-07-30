import { supabase } from '@/integrations/supabase/client';
import { templateService } from './templateService';
import type { Template } from '@/types/template';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'document' | 'template' | 'tool';
  url?: string;
  thumbnail?: string;
  price?: number;
  tags?: string[];
  rating?: number;
  featured?: boolean;
}

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  icon?: string;
  tags: string[];
  featured: boolean;
}

// Define available tools in the platform
const PLATFORM_TOOLS: ToolDefinition[] = [
  {
    id: 'invoice-generator',
    title: 'Invoice Generator',
    description: 'Create professional invoices with customizable templates',
    category: 'Financial Forms',
    url: '/dashboard',
    icon: '📄',
    tags: ['invoice', 'billing', 'finance', 'business'],
    featured: true
  },
  {
    id: 'quote-creator',
    title: 'Quote Creator',
    description: 'Generate professional quotes and estimates for clients',
    category: 'Financial Forms',
    url: '/dashboard',
    icon: '💰',
    tags: ['quote', 'estimate', 'sales', 'pricing'],
    featured: true
  },
  {
    id: 'contract-generator',
    title: 'Contract Generator',
    description: 'Create legal contracts with AI assistance',
    category: 'Legal Documents',
    url: '/dashboard',
    icon: '📋',
    tags: ['contract', 'legal', 'agreement', 'ai'],
    featured: true
  },
  {
    id: 'business-card-designer',
    title: 'Business Card Designer',
    description: 'Design professional business cards online',
    category: 'Marketing Materials',
    url: '/dashboard',
    icon: '💼',
    tags: ['business card', 'design', 'branding', 'marketing'],
    featured: true
  },
  {
    id: 'email-signature-generator',
    title: 'Email Signature Generator',
    description: 'Create professional email signatures',
    category: 'Marketing Materials',
    url: '/dashboard',
    icon: '✉️',
    tags: ['email', 'signature', 'professional', 'branding'],
    featured: false
  },
  {
    id: 'qr-code-generator',
    title: 'QR Code Generator',
    description: 'Generate QR codes for various purposes',
    category: 'Operations',
    url: '/dashboard',
    icon: '🔲',
    tags: ['qr code', 'generator', 'marketing', 'technology'],
    featured: false
  },
  {
    id: 'cost-calculator',
    title: 'Business Cost Calculator',
    description: 'Calculate startup and operational costs',
    category: 'Financial Forms',
    url: '/dashboard',
    icon: '🧮',
    tags: ['calculator', 'costs', 'business', 'finance'],
    featured: true
  },
  {
    id: 'cash-flow-tracker',
    title: 'Cash Flow Tracker',
    description: 'Monitor and track business cash flow',
    category: 'Financial Forms',
    url: '/dashboard',
    icon: '📊',
    tags: ['cash flow', 'tracking', 'finance', 'analytics'],
    featured: true
  },
  {
    id: 'time-tracker',
    title: 'Time Tracker',
    description: 'Track time spent on projects and tasks',
    category: 'Operations',
    url: '/dashboard',
    icon: '⏱️',
    tags: ['time tracking', 'productivity', 'projects', 'management'],
    featured: false
  },
  {
    id: 'todo-list',
    title: 'Advanced Todo List',
    description: 'Manage tasks with advanced features',
    category: 'Operations',
    url: '/dashboard',
    icon: '✅',
    tags: ['todo', 'tasks', 'productivity', 'management'],
    featured: false
  },
  {
    id: 'crm',
    title: 'CRM System',
    description: 'Manage customer relationships and sales',
    category: 'Operations',
    url: '/crm',
    icon: '👥',
    tags: ['crm', 'customers', 'sales', 'management'],
    featured: true
  },
  {
    id: 'ai-workspace',
    title: 'AI Workspace',
    description: 'Collaborative AI-powered workspace',
    category: 'AI Tools',
    url: '/ai-workspace',
    icon: '🤖',
    tags: ['ai', 'workspace', 'collaboration', 'productivity'],
    featured: true
  },
  {
    id: 'ai-showcase',
    title: 'AI Showcase',
    description: 'Explore AI-powered business features',
    category: 'AI Tools',
    url: '/ai-showcase',
    icon: '🌟',
    tags: ['ai', 'showcase', 'features', 'demo'],
    featured: true
  },
  {
    id: 'document-templates',
    title: 'Document Templates',
    description: 'Browse and download business document templates',
    category: 'Templates',
    url: '/',
    icon: '📁',
    tags: ['templates', 'documents', 'business', 'forms'],
    featured: true
  }
];

class UnifiedSearchService {
  private static instance: UnifiedSearchService;
  private searchCache = new Map<string, SearchResult[]>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): UnifiedSearchService {
    if (!UnifiedSearchService.instance) {
      UnifiedSearchService.instance = new UnifiedSearchService();
    }
    return UnifiedSearchService.instance;
  }

  // Fast search with caching and debouncing
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const cacheKey = `search_${query.toLowerCase()}_${limit}`;
    const now = Date.now();

    // Check cache first
    if (this.searchCache.has(cacheKey) && 
        this.cacheExpiry.get(cacheKey)! > now) {
      return this.searchCache.get(cacheKey)!;
    }

    try {
      // Search in parallel for better performance
      const [documents, templates, tools] = await Promise.all([
        this.searchDocuments(query, Math.ceil(limit / 3)),
        this.searchTemplates(query, Math.ceil(limit / 3)),
        this.searchTools(query, Math.ceil(limit / 3))
      ]);

      // Combine and rank results
      const allResults = [...documents, ...templates, ...tools];
      const rankedResults = this.rankResults(allResults, query).slice(0, limit);

      // Cache results
      this.searchCache.set(cacheKey, rankedResults);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return rankedResults;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  private async searchDocuments(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%,tags.cs.{${query}}`)
        .limit(limit);

      if (error) throw error;

      return (data || []).map(doc => ({
        id: doc.id,
        title: doc.title,
        description: doc.description || '',
        category: doc.category,
        type: 'document' as const,
        thumbnail: doc.thumbnail_url || undefined,
        price: doc.price ? Number(doc.price) : 0,
        tags: doc.tags || [],
        featured: false
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  private async searchTemplates(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const templates = templateService.searchTemplates(query, {
        categories: [],
        licenses: [],
        priceRange: [0, 1000],
        fileTypes: [],
        tags: [],
        rating: 0
      });

      return templates.slice(0, limit).map(template => ({
        id: template.id,
        title: template.title,
        description: template.description,
        category: template.category.toString(),
        type: 'template' as const,
        thumbnail: template.thumbnailUrl,
        price: template.price,
        tags: template.tags,
        rating: template.rating,
        featured: template.featured
      }));
    } catch (error) {
      console.error('Error searching templates:', error);
      return [];
    }
  }

  private searchTools(query: string, limit: number): SearchResult[] {
    const queryLower = query.toLowerCase();
    
    return PLATFORM_TOOLS
      .filter(tool => 
        tool.title.toLowerCase().includes(queryLower) ||
        tool.description.toLowerCase().includes(queryLower) ||
        tool.category.toLowerCase().includes(queryLower) ||
        tool.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
      .slice(0, limit)
      .map(tool => ({
        id: tool.id,
        title: tool.title,
        description: tool.description,
        category: tool.category,
        type: 'tool' as const,
        url: tool.url,
        thumbnail: tool.icon,
        tags: tool.tags,
        featured: tool.featured
      }));
  }

  // Advanced ranking algorithm for better SEO and relevance
  private rankResults(results: SearchResult[], query: string): SearchResult[] {
    const queryLower = query.toLowerCase();
    
    return results.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Exact title match gets highest priority
      if (a.title.toLowerCase() === queryLower) scoreA += 100;
      if (b.title.toLowerCase() === queryLower) scoreB += 100;

      // Title starts with query
      if (a.title.toLowerCase().startsWith(queryLower)) scoreA += 50;
      if (b.title.toLowerCase().startsWith(queryLower)) scoreB += 50;

      // Title contains query
      if (a.title.toLowerCase().includes(queryLower)) scoreA += 30;
      if (b.title.toLowerCase().includes(queryLower)) scoreB += 30;

      // Description contains query
      if (a.description.toLowerCase().includes(queryLower)) scoreA += 20;
      if (b.description.toLowerCase().includes(queryLower)) scoreB += 20;

      // Category match
      if (a.category.toLowerCase().includes(queryLower)) scoreA += 15;
      if (b.category.toLowerCase().includes(queryLower)) scoreB += 15;

      // Tags match
      const aTagMatch = a.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ? 10 : 0;
      const bTagMatch = b.tags?.some(tag => tag.toLowerCase().includes(queryLower)) ? 10 : 0;
      scoreA += aTagMatch;
      scoreB += bTagMatch;

      // Featured items get boost
      if (a.featured) scoreA += 25;
      if (b.featured) scoreB += 25;

      // Tools get slight boost for better user experience
      if (a.type === 'tool') scoreA += 5;
      if (b.type === 'tool') scoreB += 5;

      // Rating boost for templates/documents
      if (a.rating) scoreA += a.rating * 2;
      if (b.rating) scoreB += b.rating * 2;

      return scoreB - scoreA;
    });
  }

  // Get suggestions for autocomplete
  getSuggestions(query: string): string[] {
    if (!query || query.length < 2) return [];

    const queryLower = query.toLowerCase();
    const suggestions = new Set<string>();

    // Add tool suggestions
    PLATFORM_TOOLS.forEach(tool => {
      if (tool.title.toLowerCase().includes(queryLower)) {
        suggestions.add(tool.title);
      }
      tool.tags.forEach(tag => {
        if (tag.toLowerCase().includes(queryLower)) {
          suggestions.add(tag);
        }
      });
    });

    // Add common search terms
    const commonTerms = [
      'invoice template', 'contract generator', 'business card',
      'email signature', 'qr code', 'cost calculator', 'time tracker',
      'crm system', 'ai workspace', 'document templates', 'legal forms',
      'financial forms', 'hr documents', 'marketing materials'
    ];

    commonTerms.forEach(term => {
      if (term.toLowerCase().includes(queryLower)) {
        suggestions.add(term);
      }
    });

    return Array.from(suggestions).slice(0, 8);
  }

  // Get popular searches for empty state
  getPopularSearches(): string[] {
    return [
      'Invoice Generator',
      'Contract Templates',
      'Business Cards',
      'CRM System',
      'AI Workspace',
      'Legal Documents',
      'Financial Forms',
      'Time Tracker'
    ];
  }

  // Clear cache when needed
  clearCache(): void {
    this.searchCache.clear();
    this.cacheExpiry.clear();
  }
}

export const unifiedSearchService = UnifiedSearchService.getInstance();