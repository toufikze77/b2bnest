
import { TemplateCategory } from '@/types/template';

export const templateCategories: TemplateCategory[] = [
  {
    id: 'legal',
    name: 'Legal Documents',
    description: 'Contracts, agreements, and legal forms',
    icon: 'FileText',
    color: 'bg-blue-500',
    subcategories: ['Contracts', 'NDAs', 'Terms of Service', 'Privacy Policies', 'Employment Law']
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Employee forms and HR documents',
    icon: 'Users',
    color: 'bg-green-500',
    subcategories: ['Onboarding', 'Performance Reviews', 'Job Descriptions', 'Policies', 'Training']
  },
  {
    id: 'finance',
    name: 'Financial Forms',
    description: 'Invoices, receipts, and financial documents',
    icon: 'Calculator',
    color: 'bg-purple-500',
    subcategories: ['Invoices', 'Receipts', 'Budgets', 'Reports', 'Tax Forms']
  },
  {
    id: 'marketing',
    name: 'Marketing Materials',
    description: 'Brochures, flyers, and marketing templates',
    icon: 'Megaphone',
    color: 'bg-pink-500',
    subcategories: ['Brochures', 'Social Media', 'Email Templates', 'Presentations', 'Banners']
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Business operations and workflow forms',
    icon: 'Briefcase',
    color: 'bg-orange-500',
    subcategories: ['SOPs', 'Checklists', 'Reports', 'Planning', 'Quality Control']
  },
  {
    id: 'business-resources',
    name: 'Business Resources',
    description: 'Software and hardware referrals for business growth',
    icon: 'Settings',
    color: 'bg-indigo-500',
    subcategories: ['Software Tools', 'Hardware Solutions', 'SaaS Platforms', 'Business Apps', 'Tech Reviews']
  },
  {
    id: 'project-management',
    name: 'Project Management & Collaboration',
    description: 'Project planning, team collaboration, and workflow management tools',
    icon: 'Kanban',
    color: 'bg-cyan-500',
    subcategories: ['Project Planning', 'Team Collaboration', 'Task Management', 'Workflow Templates', 'Meeting Notes']
  },
  {
    id: 'professional-services',
    name: 'Professional Services',
    description: 'Hire verified professionals - Available for yearly subscribers to list services',
    icon: 'UserCheck',
    color: 'bg-emerald-500',
    subcategories: ['Consulting', 'Design Services', 'Development', 'Marketing Services', 'Legal Services']
  }
];
