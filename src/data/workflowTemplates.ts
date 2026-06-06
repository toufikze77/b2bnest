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
  },

  // --- HR ---
  { id: 'hr-offboarding', name: 'Employee Offboarding', description: 'Revoke access, collect assets, and run exit interviews', category: 'hr', icon: 'UserPlus' },
  { id: 'hr-recruitment', name: 'Candidate Pipeline', description: 'Track applicants from application to offer with auto-reminders', category: 'hr', icon: 'Users' },
  { id: 'hr-birthday', name: 'Birthday & Anniversary', description: 'Auto-send team celebrations on the right day', category: 'hr', icon: 'Calendar' },
  { id: 'hr-training', name: 'Training Reminders', description: 'Schedule mandatory training and track completion', category: 'hr', icon: 'CheckSquare' },
  { id: 'hr-review', name: 'Performance Reviews', description: 'Quarterly review cycle with manager and self assessments', category: 'hr', icon: 'Target' },

  // --- Sales ---
  { id: 'sales-quote', name: 'Quote to Cash', description: 'Generate quotes, send for e-sign, and trigger invoicing', category: 'sales', icon: 'Receipt' },
  { id: 'sales-churn', name: 'Churn Risk Alerts', description: 'Detect at-risk accounts and notify success managers', category: 'sales', icon: 'TrendingUp' },
  { id: 'sales-meeting', name: 'Meeting Booked Follow-up', description: 'WhatsApp + email confirmation when a demo is booked', category: 'sales', icon: 'Calendar' },
  { id: 'sales-renewal', name: 'Renewal Reminders', description: 'Notify customers and reps 30/14/7 days before renewal', category: 'sales', icon: 'Mail' },

  // --- Marketing ---
  { id: 'marketing-newsletter', name: 'Weekly Newsletter', description: 'Curate, schedule, and send a weekly digest automatically', category: 'marketing', icon: 'Send' },
  { id: 'marketing-abandoned', name: 'Abandoned Cart Recovery', description: 'Multi-step email + WhatsApp nudges for cart recovery', category: 'marketing', icon: 'Mail' },
  { id: 'marketing-webinar', name: 'Webinar Reminders', description: 'Confirmations, day-of reminders, and post-event follow-up', category: 'marketing', icon: 'Megaphone' },
  { id: 'marketing-launch', name: 'Product Launch Sequence', description: 'Coordinated multi-channel announcement workflow', category: 'marketing', icon: 'Rocket' },
  { id: 'marketing-review', name: 'Review Request', description: 'Ask happy customers for reviews after a purchase', category: 'marketing', icon: 'Star' },

  // --- Finance ---
  { id: 'finance-payroll', name: 'Payroll Run Reminder', description: 'Monthly payroll preparation and approval reminders', category: 'finance', icon: 'DollarSign' },
  { id: 'finance-overdue', name: 'Overdue Invoice Chaser', description: 'Auto-chase unpaid invoices on a polite escalation schedule', category: 'finance', icon: 'Receipt' },
  { id: 'finance-vat', name: 'VAT Return Reminder', description: 'Quarterly VAT preparation checklist and submission reminder', category: 'finance', icon: 'Calculator' },
  { id: 'finance-reconcile', name: 'Bank Reconciliation', description: 'Daily import and match of bank transactions', category: 'finance', icon: 'Database' },

  // --- Operations ---
  { id: 'ops-vendor', name: 'Vendor Onboarding', description: 'Collect docs, run KYC, and add new suppliers', category: 'operations', icon: 'Briefcase' },
  { id: 'ops-shipping', name: 'Order Shipping Notifications', description: 'Notify customers when orders ship via WhatsApp/email', category: 'operations', icon: 'Package' },
  { id: 'ops-maintenance', name: 'Maintenance Scheduling', description: 'Recurring maintenance tasks with assignment and tracking', category: 'operations', icon: 'Settings' },
  { id: 'ops-incident', name: 'Incident Response', description: 'Triage and route incidents to on-call teams', category: 'operations', icon: 'CheckSquare' },

  // --- Customer ---
  { id: 'customer-nps', name: 'NPS Survey', description: 'Send NPS surveys 30 days after purchase and aggregate scores', category: 'customer', icon: 'MessageSquare' },
  { id: 'customer-escalation', name: 'Ticket Escalation', description: 'Escalate aging tickets to senior support automatically', category: 'customer', icon: 'HelpCircle' },
  { id: 'customer-onboarding', name: 'Customer Onboarding', description: 'Welcome sequence with tips, resources, and check-ins', category: 'customer', icon: 'UserPlus' },
  { id: 'customer-renewal', name: 'Subscription Renewal Reminder', description: 'Notify customers ahead of subscription renewal', category: 'customer', icon: 'Calendar' },

  // --- IT ---
  { id: 'it-access', name: 'Access Request Approval', description: 'Approval workflow for new system access requests', category: 'it', icon: 'CheckSquare' },
  { id: 'it-uptime', name: 'Uptime Alerting', description: 'Ping services and alert on outages via WhatsApp', category: 'it', icon: 'Database' },
  { id: 'it-pr', name: 'PR Review Reminder', description: 'Ping reviewers when pull requests sit idle too long', category: 'it', icon: 'Code' },
  { id: 'it-bug', name: 'Bug Triage Routing', description: 'Auto-label and route bugs to the right squad', category: 'it', icon: 'HelpCircle' }
];
