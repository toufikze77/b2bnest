import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for optimal performance
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface ClassificationResult {
  category: string;
  confidence: number;
  subcategory?: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  processingTime: number;
}

export interface DocumentAnalysis {
  classification: ClassificationResult;
  keyTerms: string[];
  documentType: string;
  recommendedTemplates: string[];
}

class AIClassificationService {
  private classifier: any = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('Initializing AI classification model...');
      // Use a lightweight classification model that works well in browsers
      this.classifier = await pipeline(
        'text-classification',
        'microsoft/DialoGPT-medium',
        { device: 'webgpu' }
      );
      this.isInitialized = true;
      console.log('AI classification model initialized successfully');
    } catch (error) {
      console.warn('WebGPU not available, falling back to CPU');
      this.classifier = await pipeline(
        'text-classification',
        'microsoft/DialoGPT-medium',
        { device: 'cpu' }
      );
      this.isInitialized = true;
    }
  }

  async classifyDocument(text: string, fileName?: string): Promise<DocumentAnalysis> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    
    try {
      // Extract key information from document text
      const analysis = await this.analyzeDocumentContent(text, fileName);
      const processingTime = performance.now() - startTime;

      return {
        classification: {
          ...analysis.classification,
          processingTime
        },
        keyTerms: analysis.keyTerms,
        documentType: analysis.documentType,
        recommendedTemplates: analysis.recommendedTemplates
      };
    } catch (error) {
      console.error('Classification error:', error);
      return this.getFallbackAnalysis(text, fileName);
    }
  }

  private async analyzeDocumentContent(text: string, fileName?: string) {
    // Smart pattern matching for document classification
    const lowerText = text.toLowerCase();
    const patterns = {
      contract: ['agreement', 'contract', 'terms', 'conditions', 'party', 'obligations'],
      invoice: ['invoice', 'amount', 'due', 'payment', 'total', 'bill'],
      legal: ['legal', 'law', 'court', 'attorney', 'liability', 'compliance'],
      hr: ['employee', 'hiring', 'employment', 'benefits', 'salary', 'performance'],
      financial: ['financial', 'budget', 'revenue', 'profit', 'expense', 'accounting'],
      marketing: ['marketing', 'campaign', 'brand', 'promotion', 'advertising', 'customer'],
      operational: ['process', 'procedure', 'workflow', 'operations', 'management', 'policy']
    };

    let bestMatch = { category: 'general', confidence: 0.3, matches: 0 };
    
    // Analyze patterns
    Object.entries(patterns).forEach(([category, keywords]) => {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
      const confidence = Math.min(0.95, 0.4 + (matches * 0.15));
      
      if (matches > bestMatch.matches) {
        bestMatch = { category, confidence, matches };
      }
    });

    // Extract key terms (simplified approach)
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const keyTerms = [...new Set(words.slice(0, 20))].slice(0, 10);

    // Determine risk level based on content
    const riskKeywords = ['liability', 'penalty', 'lawsuit', 'breach', 'violation', 'compliance'];
    const riskMatches = riskKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const riskLevel: 'low' | 'medium' | 'high' = riskMatches >= 2 ? 'high' : riskMatches === 1 ? 'medium' : 'low';

    // Generate subcategory and tags
    const subcategory = this.generateSubcategory(bestMatch.category, lowerText);
    const tags = this.generateTags(bestMatch.category, lowerText, fileName);

    // Recommend templates
    const recommendedTemplates = this.getRecommendedTemplates(bestMatch.category);

    return {
      classification: {
        category: bestMatch.category,
        confidence: bestMatch.confidence,
        subcategory,
        tags,
        riskLevel,
        processingTime: 0
      },
      keyTerms,
      documentType: this.determineDocumentType(bestMatch.category, lowerText, fileName),
      recommendedTemplates
    };
  }

  private generateSubcategory(category: string, text: string): string {
    const subcategories: Record<string, string[]> = {
      contract: ['service-agreement', 'employment-contract', 'nda', 'vendor-agreement'],
      legal: ['compliance-doc', 'legal-notice', 'terms-of-service', 'privacy-policy'],
      hr: ['job-description', 'employee-handbook', 'performance-review', 'benefits-package'],
      financial: ['budget-report', 'financial-statement', 'expense-report', 'invoice'],
      marketing: ['marketing-plan', 'campaign-brief', 'brand-guidelines', 'press-release'],
      operational: ['sop', 'workflow-doc', 'policy-manual', 'process-guide']
    };

    const options = subcategories[category] || ['document'];
    // Simple heuristic to pick subcategory
    return options[0];
  }

  private generateTags(category: string, text: string, fileName?: string): string[] {
    const baseTags = [category];
    
    // Add urgency tags
    if (text.includes('urgent') || text.includes('asap')) {
      baseTags.push('urgent');
    }
    
    // Add confidentiality tags
    if (text.includes('confidential') || text.includes('nda')) {
      baseTags.push('confidential');
    }
    
    // Add file type tags
    if (fileName) {
      const extension = fileName.split('.').pop()?.toLowerCase();
      if (extension) {
        baseTags.push(extension);
      }
    }

    return baseTags;
  }

  private determineDocumentType(category: string, text: string, fileName?: string): string {
    if (fileName) {
      const name = fileName.toLowerCase();
      if (name.includes('contract')) return 'Contract';
      if (name.includes('invoice')) return 'Invoice';
      if (name.includes('agreement')) return 'Agreement';
    }

    const typeMap: Record<string, string> = {
      contract: 'Business Contract',
      legal: 'Legal Document',
      hr: 'HR Document',
      financial: 'Financial Document',
      marketing: 'Marketing Material',
      operational: 'Operational Document'
    };

    return typeMap[category] || 'General Document';
  }

  private getRecommendedTemplates(category: string): string[] {
    const templateMap: Record<string, string[]> = {
      contract: ['Service Agreement Template', 'NDA Template', 'Employment Contract'],
      legal: ['Terms of Service Template', 'Privacy Policy Template', 'Legal Notice'],
      hr: ['Job Description Template', 'Employee Handbook', 'Performance Review Form'],
      financial: ['Invoice Template', 'Budget Template', 'Financial Report'],
      marketing: ['Marketing Plan Template', 'Campaign Brief', 'Brand Guidelines'],
      operational: ['SOP Template', 'Process Document', 'Policy Manual']
    };

    return templateMap[category] || ['General Business Template'];
  }

  private getFallbackAnalysis(text: string, fileName?: string): DocumentAnalysis {
    return {
      classification: {
        category: 'general',
        confidence: 0.5,
        tags: ['document'],
        riskLevel: 'low',
        processingTime: 0
      },
      keyTerms: text.split(' ').slice(0, 10),
      documentType: 'Document',
      recommendedTemplates: ['General Template']
    };
  }

  // Utility method to extract text from file
  async extractTextFromFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // For demo purposes, we'll work with plain text
        // In production, you'd add PDF/Word parsing
        resolve(text || '');
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

export const aiClassificationService = new AIClassificationService();