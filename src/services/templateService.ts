
import { Template, TemplateFilter } from '@/types/template';
import { sampleTemplates, templateCategories, templateLicenses } from '@/data/templateData';

export class TemplateService {
  private static instance: TemplateService;
  private templates: Template[] = sampleTemplates;

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  // Search and filter templates
  searchTemplates(query: string, filters?: TemplateFilter): Template[] {
    let results = [...this.templates];

    // Text search
    if (query.trim()) {
      const queryLower = query.toLowerCase();
      results = results.filter(template => 
        template.title.toLowerCase().includes(queryLower) ||
        template.description.toLowerCase().includes(queryLower) ||
        template.category.name.toLowerCase().includes(queryLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
        template.subcategory?.toLowerCase().includes(queryLower)
      );
    }

    // Apply filters
    if (filters) {
      if (filters.categories.length > 0) {
        results = results.filter(template => 
          filters.categories.includes(template.category.id)
        );
      }

      if (filters.licenses.length > 0) {
        results = results.filter(template => 
          filters.licenses.includes(template.license.type)
        );
      }

      if (filters.fileTypes.length > 0) {
        results = results.filter(template => 
          filters.fileTypes.includes(template.fileType)
        );
      }

      if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) {
        results = results.filter(template => 
          template.price >= filters.priceRange[0] && 
          template.price <= filters.priceRange[1]
        );
      }

      if (filters.rating > 0) {
        results = results.filter(template => template.rating >= filters.rating);
      }

      if (filters.isRoyaltyFree !== undefined) {
        results = results.filter(template => template.isRoyaltyFree === filters.isRoyaltyFree);
      }

      if (filters.canResell !== undefined) {
        results = results.filter(template => template.canResell === filters.canResell);
      }

      if (filters.featured !== undefined) {
        results = results.filter(template => template.featured === filters.featured);
      }

      if (filters.trending !== undefined) {
        results = results.filter(template => template.trending === filters.trending);
      }
    }

    // Sort by relevance and popularity
    return results.sort((a, b) => {
      // Featured templates first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      
      // Then by rating and downloads
      const scoreA = a.rating * 0.7 + Math.log10(a.downloads + 1) * 0.3;
      const scoreB = b.rating * 0.7 + Math.log10(b.downloads + 1) * 0.3;
      
      return scoreB - scoreA;
    });
  }

  // Get templates by category
  getTemplatesByCategory(categoryId: string): Template[] {
    return this.templates.filter(template => template.category.id === categoryId);
  }

  // Get featured templates
  getFeaturedTemplates(): Template[] {
    return this.templates.filter(template => template.featured);
  }

  // Get trending templates
  getTrendingTemplates(): Template[] {
    return this.templates.filter(template => template.trending);
  }

  // Get free templates
  getFreeTemplates(): Template[] {
    return this.templates.filter(template => template.price === 0);
  }

  // Get royalty-free templates
  getRoyaltyFreeTemplates(): Template[] {
    return this.templates.filter(template => template.isRoyaltyFree);
  }

  // Get templates available for resale
  getResaleTemplates(): Template[] {
    return this.templates.filter(template => template.canResell);
  }

  // Get template by ID
  getTemplateById(id: string): Template | undefined {
    return this.templates.find(template => template.id === id);
  }

  // Get all categories
  getCategories() {
    return templateCategories;
  }

  // Get all licenses
  getLicenses() {
    return templateLicenses;
  }

  // Increment download count
  incrementDownloads(templateId: string): void {
    const template = this.templates.find(t => t.id === templateId);
    if (template) {
      template.downloads++;
    }
  }

  // Add rating
  addRating(templateId: string, rating: number): void {
    const template = this.templates.find(t => t.id === templateId);
    if (template) {
      const totalRating = template.rating * template.reviewCount + rating;
      template.reviewCount++;
      template.rating = totalRating / template.reviewCount;
    }
  }
}

export const templateService = TemplateService.getInstance();
