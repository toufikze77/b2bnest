
import { Template } from '@/types/template';
import { templateCategories } from './templateCategories';
import { templateLicenses } from './templateLicenses';

export const sampleTemplates: Template[] = [
  {
    id: '1',
    title: 'Comprehensive Non-Disclosure Agreement (NDA)',
    description: 'Professional NDA template with mutual confidentiality clauses, suitable for business partnerships, employee agreements, and vendor relationships.',
    category: templateCategories[0],
    subcategory: 'NDAs',
    tags: ['Contract', 'Confidentiality', 'Business', 'Legal', 'Professional'],
    
    fileType: 'DOCX',
    fileSize: '125 KB',
    fileName: 'comprehensive-nda-template.docx',
    fileUrl: '/templates/legal/comprehensive-nda-template.docx',
    previewUrl: '/previews/legal/comprehensive-nda-preview.pdf',
    thumbnailUrl: '/thumbnails/legal/nda-thumb.jpg',
    
    license: templateLicenses[1],
    price: 19.99,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'Legal Templates Pro',
    version: '2.1',
    lastUpdated: '2024-01-15',
    downloads: 2150,
    rating: 4.8,
    reviewCount: 89,
    
    featured: true,
    trending: true,
    isNew: false,
    difficulty: 'Intermediate',
    
    softwareRequired: ['Microsoft Word 2016+', 'Google Docs'],
    instructions: 'Fill in the highlighted sections with your specific information. Review all clauses carefully before signing.'
  },
  {
    id: '2',
    title: 'Employee Onboarding Checklist & Forms Bundle',
    description: 'Complete onboarding package including welcome checklist, tax forms, policy acknowledgments, and training schedules.',
    category: templateCategories[1],
    subcategory: 'Onboarding',
    tags: ['HR', 'Onboarding', 'Checklist', 'New Employee', 'Bundle'],
    
    fileType: 'ZIP',
    fileSize: '2.3 MB',
    fileName: 'employee-onboarding-bundle.zip',
    fileUrl: '/templates/hr/employee-onboarding-bundle.zip',
    previewUrl: '/previews/hr/onboarding-preview.pdf',
    thumbnailUrl: '/thumbnails/hr/onboarding-thumb.jpg',
    
    license: templateLicenses[0],
    price: 0,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'HR Solutions Inc',
    version: '3.0',
    lastUpdated: '2024-02-01',
    downloads: 3420,
    rating: 4.9,
    reviewCount: 156,
    
    featured: true,
    trending: false,
    isNew: true,
    difficulty: 'Beginner',
    
    softwareRequired: ['Microsoft Office Suite', 'PDF Reader'],
    instructions: 'Extract all files and customize company-specific information in each document.'
  },
  {
    id: '3',
    title: 'Professional Invoice Template with Tax Calculations',
    description: 'Modern invoice template with automatic tax calculations, payment terms, and professional branding options.',
    category: templateCategories[2],
    subcategory: 'Invoices',
    tags: ['Invoice', 'Billing', 'Finance', 'Professional', 'Tax'],
    
    fileType: 'XLSX',
    fileSize: '180 KB',
    fileName: 'professional-invoice-template.xlsx',
    fileUrl: '/templates/finance/professional-invoice-template.xlsx',
    previewUrl: '/previews/finance/invoice-preview.pdf',
    thumbnailUrl: '/thumbnails/finance/invoice-thumb.jpg',
    
    license: templateLicenses[1],
    price: 12.99,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'Finance Pro Templates',
    version: '1.5',
    lastUpdated: '2024-01-28',
    downloads: 1890,
    rating: 4.7,
    reviewCount: 78,
    
    featured: false,
    trending: true,
    isNew: false,
    difficulty: 'Beginner',
    
    softwareRequired: ['Microsoft Excel 2019+', 'Google Sheets'],
    instructions: 'Enter your business details in the designated fields. Formulas are pre-configured for automatic calculations.'
  },
  {
    id: '4',
    title: 'Social Media Content Calendar Template',
    description: 'Complete social media planning template with content ideas, posting schedule, and analytics tracking.',
    category: templateCategories[3],
    subcategory: 'Social Media',
    tags: ['Social Media', 'Marketing', 'Content', 'Planning', 'Calendar'],
    
    fileType: 'XLSX',
    fileSize: '95 KB',
    fileName: 'social-media-calendar.xlsx',
    fileUrl: '/templates/marketing/social-media-calendar.xlsx',
    previewUrl: '/previews/marketing/social-calendar-preview.pdf',
    thumbnailUrl: '/thumbnails/marketing/social-thumb.jpg',
    
    license: templateLicenses[2],
    price: 29.99,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: true,
    commercialUse: true,
    
    author: 'Marketing Masters',
    version: '2.0',
    lastUpdated: '2024-02-10',
    downloads: 965,
    rating: 4.6,
    reviewCount: 42,
    
    featured: false,
    trending: false,
    isNew: true,
    difficulty: 'Intermediate',
    
    softwareRequired: ['Microsoft Excel', 'Google Sheets'],
    instructions: 'Customize the calendar with your brand colors and content themes. Use the analytics section to track performance.'
  },
  {
    id: '5',
    title: 'Business Plan Template - Comprehensive',
    description: 'Complete business plan template with executive summary, market analysis, financial projections, and investor presentation.',
    category: templateCategories[4],
    subcategory: 'Planning',
    tags: ['Business Plan', 'Strategy', 'Planning', 'Investors', 'Comprehensive'],
    
    fileType: 'ZIP',
    fileSize: '4.2 MB',
    fileName: 'comprehensive-business-plan.zip',
    fileUrl: '/templates/operations/comprehensive-business-plan.zip',
    previewUrl: '/previews/operations/business-plan-preview.pdf',
    thumbnailUrl: '/thumbnails/operations/business-plan-thumb.jpg',
    
    license: templateLicenses[1],
    price: 49.99,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'Business Strategy Experts',
    version: '4.1',
    lastUpdated: '2024-01-20',
    downloads: 1256,
    rating: 4.9,
    reviewCount: 67,
    
    featured: true,
    trending: false,
    isNew: false,
    difficulty: 'Advanced',
    
    softwareRequired: ['Microsoft Office Suite', 'Adobe Acrobat'],
    instructions: 'Follow the step-by-step guide included. Each section has detailed instructions and examples.'
  },
  {
    id: '6',
    title: 'Service Agreement Contract Template',
    description: 'Professional service agreement template for consultants, agencies, and service providers with payment terms and deliverables.',
    category: templateCategories[0],
    subcategory: 'Contracts',
    tags: ['Contract', 'Service', 'Agreement', 'Professional', 'Consulting'],
    
    fileType: 'DOCX',
    fileSize: '98 KB',
    fileName: 'service-agreement-template.docx',
    fileUrl: '/templates/legal/service-agreement-template.docx',
    previewUrl: '/previews/legal/service-agreement-preview.pdf',
    thumbnailUrl: '/thumbnails/legal/service-agreement-thumb.jpg',
    
    license: templateLicenses[0],
    price: 0,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'Legal Forms Library',
    version: '1.8',
    lastUpdated: '2024-02-05',
    downloads: 1680,
    rating: 4.5,
    reviewCount: 93,
    
    featured: false,
    trending: false,
    isNew: false,
    difficulty: 'Intermediate',
    
    softwareRequired: ['Microsoft Word', 'Google Docs'],
    instructions: 'Customize the service description, payment terms, and deliverables sections to match your specific needs.'
  },
  {
    id: '7',
    title: 'Essential Business Software Guide & Referral Directory',
    description: 'Comprehensive guide to must-have business software with detailed comparisons, pricing, and exclusive referral links to top platforms.',
    category: templateCategories[5],
    subcategory: 'Software Tools',
    tags: ['Software', 'Business Tools', 'Referrals', 'SaaS', 'Productivity'],
    
    fileType: 'PDF',
    fileSize: '2.8 MB',
    fileName: 'business-software-guide.pdf',
    fileUrl: '/templates/business-resources/business-software-guide.pdf',
    previewUrl: '/previews/business-resources/software-guide-preview.pdf',
    thumbnailUrl: '/thumbnails/business-resources/software-thumb.jpg',
    
    license: templateLicenses[0],
    price: 0,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'Business Tech Experts',
    version: '1.0',
    lastUpdated: '2024-02-15',
    downloads: 1240,
    rating: 4.7,
    reviewCount: 85,
    
    featured: true,
    trending: true,
    isNew: true,
    difficulty: 'Beginner',
    
    softwareRequired: ['PDF Reader'],
    instructions: 'Use the referral links provided to get exclusive discounts on recommended software solutions.'
  },
  {
    id: '8',
    title: 'Hardware Procurement Checklist & Vendor Directory',
    description: 'Complete guide for business hardware procurement including vendor comparisons, specifications, and trusted supplier referrals.',
    category: templateCategories[5],
    subcategory: 'Hardware Solutions',
    tags: ['Hardware', 'Procurement', 'Business Equipment', 'Vendors', 'IT'],
    
    fileType: 'XLSX',
    fileSize: '450 KB',
    fileName: 'hardware-procurement-guide.xlsx',
    fileUrl: '/templates/business-resources/hardware-procurement-guide.xlsx',
    previewUrl: '/previews/business-resources/hardware-guide-preview.pdf',
    thumbnailUrl: '/thumbnails/business-resources/hardware-thumb.jpg',
    
    license: templateLicenses[1],
    price: 24.99,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'IT Procurement Specialists',
    version: '2.0',
    lastUpdated: '2024-02-12',
    downloads: 678,
    rating: 4.6,
    reviewCount: 34,
    
    featured: false,
    trending: true,
    isNew: true,
    difficulty: 'Intermediate',
    
    softwareRequired: ['Microsoft Excel', 'Google Sheets'],
    instructions: 'Use the comparison sheets to evaluate vendors and contact recommended suppliers through provided referral links.'
  },
  {
    id: '9',
    title: 'Comprehensive Project Management Dashboard Template',
    description: 'All-in-one project management template with Gantt charts, task tracking, team assignments, and milestone management.',
    category: templateCategories[6],
    subcategory: 'Project Planning',
    tags: ['Project Management', 'Dashboard', 'Team Collaboration', 'Planning', 'Tracking'],
    
    fileType: 'XLSX',
    fileSize: '1.2 MB',
    fileName: 'project-management-dashboard.xlsx',
    fileUrl: '/templates/project-management/project-management-dashboard.xlsx',
    previewUrl: '/previews/project-management/dashboard-preview.pdf',
    thumbnailUrl: '/thumbnails/project-management/dashboard-thumb.jpg',
    
    license: templateLicenses[1],
    price: 34.99,
    currency: 'GBP',
    isRoyaltyFree: true,
    canResell: false,
    commercialUse: true,
    
    author: 'Project Pro Solutions',
    version: '3.2',
    lastUpdated: '2024-02-20',
    downloads: 1456,
    rating: 4.8,
    reviewCount: 112,
    
    featured: true,
    trending: true,
    isNew: true,
    difficulty: 'Advanced',
    
    softwareRequired: ['Microsoft Excel 2019+', 'Google Sheets'],
    instructions: 'Customize project phases, assign team members, and track progress using the built-in formulas and charts.'
  },
  {
    id: '10',
    title: 'Professional Web Development Services - Premium Package',
    description: 'Full-stack web development services including custom design, responsive development, and ongoing maintenance. Available from verified professional developer.',
    category: templateCategories[7],
    subcategory: 'Development',
    tags: ['Web Development', 'Professional Service', 'Custom Design', 'Full-Stack', 'Maintenance'],
    
    fileType: 'PDF',
    fileSize: '890 KB',
    fileName: 'web-development-service-package.pdf',
    fileUrl: '/templates/professional-services/web-development-package.pdf',
    previewUrl: '/previews/professional-services/web-dev-preview.pdf',
    thumbnailUrl: '/thumbnails/professional-services/web-dev-thumb.jpg',
    
    license: templateLicenses[2],
    price: 2999.99,
    currency: 'GBP',
    isRoyaltyFree: false,
    canResell: false,
    commercialUse: true,
    
    author: 'TechCraft Solutions (Verified Professional)',
    version: '1.0',
    lastUpdated: '2024-02-25',
    downloads: 45,
    rating: 5.0,
    reviewCount: 8,
    
    featured: true,
    trending: false,
    isNew: true,
    difficulty: 'Beginner',
    
    softwareRequired: ['PDF Reader'],
    instructions: 'Contact the professional directly through the provided details. Service includes consultation, development, and 3 months support. Subject to terms and conditions for yearly subscribers.'
  },
  {
    id: '11',
    title: 'Merchants Cryptocurrency Integration Service',
    description: 'Complete cryptocurrency payment integration service for merchants. Accept hundreds of currencies with seamless USDC conversion, guaranteed settlement with no volatility, and instant confirmation on low-cost networks like Base & Polygon.',
    category: templateCategories[7],
    subcategory: 'Payment Integration',
    tags: ['Cryptocurrency', 'Payment Processing', 'USDC', 'Commerce', 'Blockchain', 'Coinbase'],
    
    fileType: 'PDF',
    fileSize: '1.2 MB',
    fileName: 'crypto-integration-service-package.pdf',
    fileUrl: '/templates/professional-services/crypto-integration-package.pdf',
    previewUrl: '/previews/professional-services/crypto-integration-preview.pdf',
    thumbnailUrl: '/thumbnails/professional-services/crypto-integration-thumb.jpg',
    
    license: templateLicenses[2],
    price: 1999.99,
    currency: 'GBP',
    isRoyaltyFree: false,
    canResell: false,
    commercialUse: true,
    
    author: 'CryptoCommerce Solutions (Verified Professional)',
    version: '1.0',
    lastUpdated: '2024-02-28',
    downloads: 23,
    rating: 5.0,
    reviewCount: 5,
    
    featured: true,
    trending: true,
    isNew: true,
    difficulty: 'Intermediate',
    
    softwareRequired: ['PDF Reader'],
    instructions: 'Professional cryptocurrency payment integration service includes: Accept hundreds of currencies with seamless USDC conversion, guaranteed settlement with no volatility, deposit funds in any wallet or exchange, access to Coinbase balances for customer payments, and instant confirmation on Base & Polygon networks. Contact for consultation and implementation.'
  }
];
