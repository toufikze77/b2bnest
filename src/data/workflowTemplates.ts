export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  presetNodes?: any[];
}

export const workflowCategories = [
  { id: 'hr', name: 'Human Resources', icon: 'Users' },
  { id: 'sales', name: 'Sales & CRM', icon: 'TrendingUp' },
  { id: 'marketing', name: 'Marketing', icon: 'Megaphone' },
  { id: 'finance', name: 'Finance & Accounting', icon: 'DollarSign' },
  { id: 'operations', name: 'Operations', icon: 'Settings' },
  { id: 'customer', name: 'Customer Service', icon: 'Headphones' },
  { id: 'it', name: 'IT & Development', icon: 'Code' },
  { id: 'custom', name: 'Custom Workflow', icon: 'Sparkles' }
];

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Workflow',
    description: 'Start from scratch with an empty canvas',
    category: 'custom',
    icon: 'FileText'
  },
  {
    id: 'hr-onboarding',
    name: 'Employee Onboarding',
    description: 'Automate new employee onboarding tasks and document collection',
    category: 'hr',
    icon: 'UserPlus'
  },
  {
    id: 'hr-leave',
    name: 'Leave Request Management',
    description: 'Handle employee leave requests with approval workflow',
    category: 'hr',
    icon: 'Calendar'
  },
  {
    id: 'sales-lead',
    name: 'Lead Qualification',
    description: 'Automatically qualify and route new sales leads',
    category: 'sales',
    icon: 'Target'
  },
  {
    id: 'sales-follow',
    name: 'Follow-up Automation',
    description: 'Send automated follow-ups to prospects and customers',
    category: 'sales',
    icon: 'Mail'
  },
  {
    id: 'marketing-email',
    name: 'Email Campaign',
    description: 'Create and manage automated email marketing campaigns',
    category: 'marketing',
    icon: 'Send'
  },
  {
    id: 'marketing-social',
    name: 'Social Media Posting',
    description: 'Schedule and automate social media content publishing',
    category: 'marketing',
    icon: 'Share2'
  },
  {
    id: 'finance-invoice',
    name: 'Invoice Processing',
    description: 'Automate invoice creation, sending, and payment tracking',
    category: 'finance',
    icon: 'Receipt'
  },
  {
    id: 'finance-expense',
    name: 'Expense Approval',
    description: 'Manage expense submissions and approval workflows',
    category: 'finance',
    icon: 'CreditCard'
  },
  {
    id: 'ops-inventory',
    name: 'Inventory Management',
    description: 'Track inventory levels and trigger reorder notifications',
    category: 'operations',
    icon: 'Package'
  },
  {
    id: 'ops-task',
    name: 'Task Assignment',
    description: 'Automatically assign and track operational tasks',
    category: 'operations',
    icon: 'CheckSquare'
  },
  {
    id: 'customer-ticket',
    name: 'Support Ticket Routing',
    description: 'Automatically categorize and route customer support tickets',
    category: 'customer',
    icon: 'HelpCircle'
  },
  {
    id: 'customer-feedback',
    name: 'Feedback Collection',
    description: 'Gather and analyze customer feedback automatically',
    category: 'customer',
    icon: 'MessageSquare'
  },
  {
    id: 'it-deploy',
    name: 'Deployment Pipeline',
    description: 'Automate code deployment and testing workflows',
    category: 'it',
    icon: 'Rocket'
  },
  {
    id: 'it-backup',
    name: 'Backup & Monitoring',
    description: 'Schedule automated backups and system health checks',
    category: 'it',
    icon: 'Database'
  }
];
