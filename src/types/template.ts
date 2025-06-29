
export interface Template {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  subcategory?: string;
  tags: string[];
  
  // File information
  fileType: 'PDF' | 'DOCX' | 'XLSX' | 'PPTX' | 'ZIP';
  fileSize: string;
  fileName: string;
  fileUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  
  // Licensing and pricing
  license: TemplateLicense;
  price: number;
  currency: string;
  isRoyaltyFree: boolean;
  canResell: boolean;
  commercialUse: boolean;
  
  // Metadata
  author: string;
  version: string;
  lastUpdated: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  
  // SEO and discovery
  featured: boolean;
  trending: boolean;
  isNew: boolean;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  
  // Requirements
  softwareRequired?: string[];
  instructions?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  subcategories: string[];
}

export interface TemplateLicense {
  type: 'Free' | 'Premium' | 'Enterprise';
  name: string;
  description: string;
  personalUse: boolean;
  commercialUse: boolean;
  resaleRights: boolean;
  modificationRights: boolean;
  distributionRights: boolean;
  creditsRequired: boolean;
}

export interface TemplateFilter {
  categories: string[];
  licenses: string[];
  priceRange: [number, number];
  fileTypes: string[];
  tags: string[];
  rating: number;
  isRoyaltyFree?: boolean;
  canResell?: boolean;
  featured?: boolean;
  trending?: boolean;
}
