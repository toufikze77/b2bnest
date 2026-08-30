import {
  TemplateBoard,
  TemplateCategoryDef,
  TemplatePlan,
  TemplateType,
  WorkspaceTemplate,
} from '@/types/workspaceTemplate';

export const TEMPLATE_CATEGORIES: TemplateCategoryDef[] = [
  {
    id: 'business-management',
    name: 'Business Management',
    subcategories: [
      'Business Operations',
      'Business Planning',
      'Goals & Objectives',
      'KPI Tracking',
      'Management Dashboard',
    ],
  },
  {
    id: 'sales-crm',
    name: 'Sales & CRM',
    subcategories: [
      'CRM',
      'Sales Pipeline',
      'Lead Management',
      'Customer Management',
      'Sales Follow-Up',
      'Sales Forecast',
      'Customer Onboarding',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    subcategories: [
      'Marketing Campaigns',
      'Content Calendar',
      'Social Media Planning',
      'Email Marketing',
      'Product Launch',
      'Marketing Analytics',
      'Event Marketing',
    ],
  },
  {
    id: 'project-management',
    name: 'Project Management',
    subcategories: [
      'Simple Project',
      'Agile Project',
      'Project Portfolio',
      'Client Projects',
      'Project Requests',
      'Project Budget',
      'Project Risks',
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    subcategories: [
      'Expense Tracking',
      'Budget Planning',
      'Cash Flow',
      'Invoice Tracking',
      'Accounts Receivable',
      'Financial Dashboard',
    ],
  },
  {
    id: 'hr',
    name: 'HR',
    subcategories: [
      'Recruitment',
      'Employee Onboarding',
      'Employee Management',
      'Leave Tracking',
      'Performance Reviews',
      'Training Management',
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    subcategories: [
      'Operations Management',
      'Inventory',
      'Suppliers',
      'Assets',
      'Orders',
      'Maintenance',
      'Workflow Management',
    ],
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    subcategories: [
      'Support Tickets',
      'Customer Complaints',
      'Customer Feedback',
      'SLA Management',
      'Customer Onboarding',
    ],
  },
  {
    id: 'ai-automation',
    name: 'AI & Automation',
    subcategories: [
      'AI Lead Qualification',
      'AI Customer Support',
      'AI Email Assistant',
      'AI Marketing',
      'AI Sales Assistant',
      'AI Reporting',
      'AI Workflow Automation',
    ],
  },
];

export const INDUSTRIES = [
  'Startups',
  'Retail',
  'Hospitality',
  'Real Estate',
  'Construction',
  'Professional Services',
  'Healthcare',
  'Education',
  'E-commerce',
  'Technology',
  'Agencies',
  'Freelancers',
];

const DEFAULT_STATUSES = ['Backlog', 'To do', 'In progress', 'Review', 'Done'];
const DEFAULT_VIEWS = ['Table', 'Kanban', 'Timeline', 'Dashboard'];
const COLORS = ['#1e40af', '#2563eb', '#0891b2', '#7c3aed', '#0f766e', '#b45309', '#be123c'];

type GroupSeed = [string, string[]];
type BoardSeed = [string, string[], GroupSeed[], string[]?];

interface Seed {
  slug: string;
  name: string;
  description: string;
  long: string;
  category: string;
  subcategory: string;
  type: TemplateType;
  tags: string[];
  industries?: string[];
  ai?: string[];
  automations?: string[];
  features?: string[];
  who?: string[];
  manage?: string[];
  flow?: string[];
  plan?: TemplatePlan;
  featured?: boolean;
  created: string;
  boards: BoardSeed[];
}

const STATUS_BY_GROUP: TemplateBoard['groups'][number]['tasks'][number]['status'][] = [
  'todo',
  'todo',
  'in-progress',
  'review',
  'done',
];

const buildBoard = (seed: BoardSeed, index: number, template: Seed): TemplateBoard => {
  const [name, columns, groups, views] = seed;
  return {
    name,
    description: `${template.name} — ${name}`,
    color: COLORS[(template.slug.length + index) % COLORS.length],
    columns,
    statuses: DEFAULT_STATUSES,
    views: views ?? DEFAULT_VIEWS,
    groups: groups.map(([groupName, tasks], groupIndex) => ({
      name: groupName,
      tasks: tasks.map((title, taskIndex) => ({
        title,
        description: `${groupName} · ${template.name}`,
        status: STATUS_BY_GROUP[Math.min(groupIndex, STATUS_BY_GROUP.length - 1)],
        priority: groupIndex === 0 ? 'high' : taskIndex === 0 ? 'medium' : 'low',
        dayOffset: groupIndex * 7 + (taskIndex + 1) * 2,
        estimatedHours: 2,
      })),
    })),
  };
};

const toTemplate = (seed: Seed): WorkspaceTemplate => {
  const boards = seed.boards.map((b, i) => buildBoard(b, i, seed));
  return {
    id: seed.slug,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    longDescription: seed.long,
    category: seed.category,
    subcategory: seed.subcategory,
    industries: seed.industries ?? ['Professional Services', 'Startups'],
    templateType: seed.type,
    tags: seed.tags,
    isAiPowered: !!seed.ai?.length,
    aiFeatures: seed.ai ?? [],
    automations: seed.automations ?? [
      'Due-date reminders on every task',
      'Email notification when an item is assigned',
      'Status change notifies the item owner',
    ],
    features: seed.features ?? [
      'Pre-built board structure with groups and tasks',
      'Owners, due dates, priorities and time estimates',
      'Works with B2BNest projects, tasks and dashboards',
    ],
    whoItsFor: seed.who ?? ['Business owners', 'Team leads', 'Operations managers'],
    helpsYouManage: seed.manage ?? [
      'A repeatable process instead of ad-hoc spreadsheets',
      'Clear ownership and deadlines for every step',
      'Visible progress across the whole team',
    ],
    exampleWorkflow: seed.flow ?? [
      'Use the template to create your workspace',
      'Assign owners and due dates',
      'Work the board and track progress on the dashboard',
    ],
    plan: seed.plan ?? 'free',
    status: 'published',
    featured: !!seed.featured,
    isCustom: false,
    previewImages: [],
    createdAt: seed.created,
    updatedAt: seed.created,
    boards,
  };
};

const SEEDS: Seed[] = [
  // ───────────── Sales & CRM ─────────────
  {
    slug: 'ai-powered-crm',
    name: 'AI-Powered CRM',
    description: 'Manage contacts, leads and deals in one place with AI lead scoring and follow-up drafting.',
    long:
      'A complete customer relationship workspace: contacts, an inbound lead queue and a deal pipeline, connected to B2BNest AI so you can score leads, summarise conversations and draft follow-ups without leaving the board.',
    category: 'sales-crm',
    subcategory: 'CRM',
    type: 'crm',
    tags: ['crm', 'sales', 'leads', 'deals', 'pipeline', 'contacts', 'follow-up'],
    industries: ['Startups', 'Agencies', 'Professional Services', 'Technology'],
    ai: [
      'AI lead scoring (0–100) on the Lead Management board',
      'AI-drafted follow-up emails from the AI Assistant',
      'AI summaries of activity notes and next best action',
    ],
    who: ['Founders selling directly', 'Sales teams of 1–20', 'Agencies managing client pipelines'],
    manage: ['Every contact and company in one record', 'Deal value and stage across the pipeline', 'Follow-ups so no lead goes cold'],
    flow: [
      'A lead arrives from a form or import and lands in New leads',
      'AI scores the lead and you qualify or park it',
      'Qualified leads become deals and move through the pipeline',
      'Won deals hand over to Customer onboarding',
    ],
    featured: true,
    created: '2026-08-01',
    boards: [
      [
        'Contacts',
        ['Name', 'Company', 'Email', 'Phone', 'Owner', 'Lead source', 'Created date'],
        [
          ['Import & set up', ['Import your existing contact list', 'Set contact owners', 'Tag key accounts']],
          ['Active contacts', ['Log last conversation', 'Confirm decision maker', 'Schedule quarterly check-in']],
        ],
      ],
      [
        'Leads',
        ['Lead', 'Company', 'Lead source', 'AI score', 'Stage', 'Owner', 'Next follow-up'],
        [
          ['New leads', ['Review inbound enquiries', 'Run AI lead scoring', 'Assign an owner']],
          ['Qualifying', ['Send intro message', 'Book discovery call', 'Record budget and timeline']],
          ['Qualified', ['Convert to a deal', 'Share proposal outline', 'Agree next steps']],
        ],
      ],
      [
        'Deals',
        ['Deal', 'Contact', 'Deal value', 'Stage', 'Probability', 'Owner', 'Expected close'],
        [
          ['Pipeline', ['Prepare proposal', 'Send quote from B2BNest invoicing', 'Handle objections']],
          ['Negotiation', ['Agree commercial terms', 'Send contract for signature']],
          ['Closed', ['Mark won or lost with a reason', 'Hand over to delivery', 'Request a testimonial']],
        ],
      ],
      [
        'Activities',
        ['Activity', 'Related to', 'Type', 'Owner', 'Due date', 'Outcome'],
        [
          ['This week', ['Call top three open deals', 'Send follow-up emails', 'Update pipeline notes']],
          ['Recurring', ['Weekly pipeline review', 'Monthly dormant-lead re-engagement']],
        ],
      ],
    ],
  },
  {
    slug: 'sales-pipeline',
    name: 'Sales Pipeline',
    description: 'Track every opportunity from first contact to closed-won with clear stages and values.',
    long: 'A focused pipeline board for teams that already keep contacts elsewhere and just need disciplined deal tracking with values, probability and close dates.',
    category: 'sales-crm',
    subcategory: 'Sales Pipeline',
    type: 'board',
    tags: ['sales', 'pipeline', 'deals', 'forecast', 'revenue'],
    created: '2026-07-20',
    boards: [
      [
        'Sales Pipeline',
        ['Opportunity', 'Account', 'Value', 'Stage', 'Probability', 'Owner', 'Close date'],
        [
          ['Discovery', ['Qualify the opportunity', 'Map decision makers', 'Confirm budget']],
          ['Proposal', ['Build the proposal', 'Present to stakeholders', 'Send pricing']],
          ['Negotiation', ['Handle objections', 'Agree terms', 'Send contract']],
          ['Closed', ['Record outcome and reason', 'Kick off delivery']],
        ],
      ],
    ],
  },
  {
    slug: 'lead-management',
    name: 'Lead Management',
    description: 'Capture, qualify and route inbound leads so nothing sits unanswered.',
    long: 'A lead intake and qualification workspace that pairs with B2BNest lead capture forms and AI lead scoring.',
    category: 'sales-crm',
    subcategory: 'Lead Management',
    type: 'workflow',
    tags: ['leads', 'prospecting', 'qualification', 'inbound', 'sales'],
    ai: ['AI lead scoring on every new lead', 'AI-suggested qualification questions'],
    created: '2026-07-28',
    boards: [
      [
        'Lead Management',
        ['Lead', 'Source', 'AI score', 'Status', 'Owner', 'First response', 'Next follow-up'],
        [
          ['Inbox', ['Review new form submissions', 'De-duplicate against existing contacts', 'Assign an owner']],
          ['Qualifying', ['Respond within one working hour', 'Score fit and intent', 'Book a call']],
          ['Routed', ['Pass qualified leads to sales', 'Park low-intent leads for nurture']],
        ],
      ],
    ],
  },
  {
    slug: 'sales-follow-up',
    name: 'Sales Follow-Up',
    description: 'A disciplined cadence so every prospect gets the right touch at the right time.',
    long: 'Runs a structured multi-touch follow-up cadence across email, phone and social, with reminders and outcomes recorded per prospect.',
    category: 'sales-crm',
    subcategory: 'Sales Follow-Up',
    type: 'automation',
    tags: ['follow-up', 'cadence', 'sales', 'outreach', 'reminders'],
    ai: ['AI-drafted follow-up messages tailored to the last interaction'],
    created: '2026-07-14',
    boards: [
      [
        'Follow-Up Cadence',
        ['Prospect', 'Touch number', 'Channel', 'Owner', 'Due date', 'Outcome'],
        [
          ['Touch 1–2', ['Send intro email', 'Connect on LinkedIn']],
          ['Touch 3–5', ['Follow-up call', 'Share a relevant case study', 'Send value recap email']],
          ['Close the loop', ['Send break-up email', 'Move to nurture list']],
        ],
      ],
    ],
  },
  {
    slug: 'sales-forecast',
    name: 'Sales Forecast',
    description: 'Roll deals into a weighted forecast and review it every month.',
    long: 'A forecasting board that turns pipeline into a committed, best-case and pipeline view with a monthly review ritual.',
    category: 'sales-crm',
    subcategory: 'Sales Forecast',
    type: 'dashboard',
    tags: ['forecast', 'revenue', 'sales', 'planning', 'reporting'],
    ai: ['AI summary of forecast movement between reviews'],
    created: '2026-07-05',
    boards: [
      [
        'Sales Forecast',
        ['Deal', 'Value', 'Weighted value', 'Category', 'Owner', 'Close month'],
        [
          ['Commit', ['Verify close dates', 'Confirm signature path']],
          ['Best case', ['Identify blockers', 'Agree a mutual action plan']],
          ['Review', ['Compare forecast vs actual', 'Publish the monthly forecast note']],
        ],
      ],
    ],
  },
  {
    slug: 'customer-onboarding',
    name: 'Customer Onboarding',
    description: 'Give every new customer the same smooth first 30 days.',
    long: 'A repeatable onboarding runbook from signed contract to first value, with kick-off, setup, training and a 30-day review.',
    category: 'sales-crm',
    subcategory: 'Customer Onboarding',
    type: 'project',
    tags: ['onboarding', 'customer', 'success', 'handover', 'retention'],
    created: '2026-08-06',
    boards: [
      [
        'Customer Onboarding',
        ['Customer', 'Owner', 'Stage', 'Kick-off date', 'Go-live date', 'Health'],
        [
          ['Handover', ['Review the signed scope', 'Introduce the delivery team', 'Collect access and assets']],
          ['Setup', ['Configure the account', 'Import customer data', 'Run the training session']],
          ['First value', ['Confirm first successful outcome', 'Agree success metrics']],
          ['30-day review', ['Run the review call', 'Log feedback', 'Identify expansion opportunities']],
        ],
      ],
    ],
  },

  // ───────────── Business Management ─────────────
  {
    slug: 'business-operations-dashboard',
    name: 'Business Operations Dashboard',
    description: 'One command centre for the weekly, monthly and quarterly running of your business.',
    long:
      'A management workspace that pulls the operating rhythm of the business into one place: weekly priorities, monthly reporting, quarterly planning and the owners behind each.',
    category: 'business-management',
    subcategory: 'Management Dashboard',
    type: 'multi-component',
    tags: ['operations', 'management', 'dashboard', 'reporting', 'rhythm'],
    ai: ['AI business reporting summaries from your B2BNest data', 'AI-suggested priorities based on overdue work'],
    featured: true,
    created: '2026-08-10',
    boards: [
      [
        'Operating Rhythm',
        ['Item', 'Owner', 'Cadence', 'Status', 'Due date', 'Notes'],
        [
          ['Weekly', ['Weekly leadership meeting', 'Review cash position', 'Review sales pipeline']],
          ['Monthly', ['Close the month in finance', 'Publish the management report', 'Review KPIs vs target']],
          ['Quarterly', ['Set quarterly objectives', 'Review team capacity', 'Refresh the 12-month plan']],
        ],
      ],
      [
        'Business KPIs',
        ['KPI', 'Owner', 'Target', 'Actual', 'Period', 'Trend'],
        [
          ['Revenue', ['Track monthly recurring revenue', 'Track new business won']],
          ['Delivery', ['Track on-time delivery rate', 'Track utilisation']],
          ['Customer', ['Track churn', 'Track satisfaction score']],
        ],
      ],
      [
        'Management Actions',
        ['Action', 'Owner', 'Priority', 'Due date', 'Status'],
        [
          ['Open actions', ['Log decisions from the leadership meeting', 'Assign owners and dates']],
          ['Follow-up', ['Chase overdue actions', 'Close completed actions with an outcome']],
        ],
      ],
    ],
  },
  {
    slug: 'business-plan',
    name: 'Business Planning',
    description: 'Turn a business plan into dated, owned actions instead of a static document.',
    long: 'Breaks a business plan into market, offer, financial and go-to-market workstreams, each with owners and milestones.',
    category: 'business-management',
    subcategory: 'Business Planning',
    type: 'project',
    tags: ['business plan', 'strategy', 'planning', 'startup', 'growth'],
    industries: ['Startups', 'Freelancers', 'Professional Services'],
    created: '2026-06-30',
    boards: [
      [
        'Business Plan',
        ['Workstream', 'Owner', 'Status', 'Milestone date', 'Notes'],
        [
          ['Market', ['Define the target customer', 'Size the market', 'Map competitors']],
          ['Offer', ['Define the core offer', 'Set pricing', 'Write the value proposition']],
          ['Financials', ['Build the 12-month forecast', 'Set the funding requirement']],
          ['Go to market', ['Choose the first two channels', 'Set the launch date']],
        ],
      ],
    ],
  },
  {
    slug: 'goals-okrs',
    name: 'Goals & Objectives (OKRs)',
    description: 'Set quarterly objectives, measurable key results and weekly check-ins.',
    long: 'An OKR workspace that keeps company objectives, key results and the initiatives behind them visible and reviewed every week.',
    category: 'business-management',
    subcategory: 'Goals & Objectives',
    type: 'board',
    tags: ['okr', 'goals', 'objectives', 'strategy', 'kpi'],
    created: '2026-07-11',
    boards: [
      [
        'Quarterly OKRs',
        ['Objective / Key result', 'Owner', 'Target', 'Current', 'Confidence', 'Due date'],
        [
          ['Set', ['Draft company objectives', 'Define measurable key results', 'Agree owners']],
          ['Execute', ['Link initiatives to key results', 'Weekly confidence check-in']],
          ['Review', ['Score the quarter', 'Carry forward or retire objectives']],
        ],
      ],
    ],
  },
  {
    slug: 'kpi-tracking',
    name: 'KPI Tracking',
    description: 'Track the numbers that actually run your business, month by month.',
    long: 'A KPI register with owners, targets, actuals and a monthly update ritual so reporting stops being a scramble.',
    category: 'business-management',
    subcategory: 'KPI Tracking',
    type: 'dashboard',
    tags: ['kpi', 'metrics', 'reporting', 'performance', 'dashboard'],
    ai: ['AI commentary explaining month-on-month movements'],
    created: '2026-07-02',
    boards: [
      [
        'KPI Register',
        ['KPI', 'Category', 'Owner', 'Target', 'Actual', 'Period'],
        [
          ['Define', ['Agree the ten KPIs that matter', 'Set targets for the year', 'Assign an owner per KPI']],
          ['Collect', ['Pull monthly actuals', 'Note anomalies']],
          ['Report', ['Publish the monthly KPI pack', 'Agree corrective actions']],
        ],
      ],
    ],
  },

  // ───────────── Marketing ─────────────
  {
    slug: 'marketing-campaign-planner',
    name: 'Marketing Campaign Planner',
    description: 'Plan, produce and measure campaigns across every channel from one board.',
    long:
      'Replaces scattered campaign spreadsheets with a single planning board: brief, production, scheduling and results, with budget and channel tracking.',
    category: 'marketing',
    subcategory: 'Marketing Campaigns',
    type: 'project',
    tags: ['marketing', 'campaign', 'content', 'channels', 'budget', 'automation'],
    ai: ['AI campaign copy drafting', 'AI-generated channel plan suggestions'],
    featured: true,
    created: '2026-08-12',
    boards: [
      [
        'Campaign Planner',
        ['Asset / Task', 'Channel', 'Owner', 'Status', 'Publish date', 'Budget', 'Result'],
        [
          ['Brief', ['Define the campaign goal and audience', 'Set the budget', 'Agree the offer and message']],
          ['Production', ['Write the copy', 'Design the creative', 'Internal review and approval']],
          ['Launch', ['Schedule posts and emails', 'Set up tracking links', 'Brief sales on the campaign']],
          ['Results', ['Collect performance data', 'Report on cost per lead', 'Decide what to repeat']],
        ],
      ],
    ],
  },
  {
    slug: 'content-calendar',
    name: 'Content Calendar',
    description: 'A rolling editorial calendar from idea to published, with owners and dates.',
    long: 'Keeps a publishing rhythm going: an idea backlog, a production line and a published archive with performance notes.',
    category: 'marketing',
    subcategory: 'Content Calendar',
    type: 'board',
    tags: ['content', 'calendar', 'editorial', 'blog', 'seo', 'marketing'],
    ai: ['AI topic and outline suggestions', 'AI first-draft copy'],
    created: '2026-08-02',
    boards: [
      [
        'Content Calendar',
        ['Title', 'Format', 'Channel', 'Owner', 'Status', 'Publish date', 'Keyword'],
        [
          ['Ideas', ['Collect topic ideas', 'Research keywords', 'Prioritise by business impact']],
          ['In production', ['Write the draft', 'Edit and fact-check', 'Create the visuals']],
          ['Scheduled', ['Schedule the publish date', 'Prepare the promotion posts']],
          ['Published', ['Log performance after 30 days', 'Refresh older top performers']],
        ],
      ],
    ],
  },
  {
    slug: 'social-media-planning',
    name: 'Social Media Planning',
    description: 'Plan a month of social posts per channel with approvals and scheduling.',
    long: 'A monthly social planning board covering pillars, drafting, approval and post-performance review.',
    category: 'marketing',
    subcategory: 'Social Media Planning',
    type: 'board',
    tags: ['social media', 'posts', 'scheduling', 'brand', 'marketing'],
    ai: ['AI post copy and hook variations'],
    created: '2026-07-22',
    boards: [
      [
        'Social Planner',
        ['Post', 'Channel', 'Pillar', 'Owner', 'Status', 'Publish date', 'Engagement'],
        [
          ['Plan', ['Set the monthly content pillars', 'Map posts to the calendar']],
          ['Create', ['Write post copy', 'Produce the visual', 'Get approval']],
          ['Publish & review', ['Schedule the posts', 'Log engagement weekly']],
        ],
      ],
    ],
  },
  {
    slug: 'email-marketing',
    name: 'Email Marketing',
    description: 'Run newsletters and nurture sequences with a clear send calendar.',
    long: 'Plan, build, test and measure email sends and automated sequences, including list hygiene and deliverability checks.',
    category: 'marketing',
    subcategory: 'Email Marketing',
    type: 'workflow',
    tags: ['email', 'newsletter', 'nurture', 'sequence', 'marketing'],
    ai: ['AI subject line and body drafting'],
    created: '2026-07-17',
    boards: [
      [
        'Email Programme',
        ['Send', 'Segment', 'Owner', 'Status', 'Send date', 'Open rate', 'Clicks'],
        [
          ['Plan', ['Define the segment', 'Set the goal for each send']],
          ['Build', ['Write the email', 'Build and preview', 'Send a test and proof it']],
          ['Send & measure', ['Schedule the send', 'Record opens and clicks', 'Clean bounced addresses']],
        ],
      ],
    ],
  },
  {
    slug: 'product-launch',
    name: 'Product Launch',
    description: 'Coordinate everything from positioning to launch day and post-launch review.',
    long: 'A cross-team launch plan covering positioning, assets, enablement, launch-day tasks and the post-launch retrospective.',
    category: 'marketing',
    subcategory: 'Product Launch',
    type: 'project',
    tags: ['launch', 'product', 'go-to-market', 'marketing', 'release'],
    created: '2026-08-04',
    boards: [
      [
        'Launch Plan',
        ['Task', 'Workstream', 'Owner', 'Status', 'Due date', 'Dependency'],
        [
          ['Positioning', ['Write the positioning statement', 'Agree pricing and packaging', 'Define the launch audience']],
          ['Assets', ['Build the landing page', 'Produce the demo video', 'Write the launch emails']],
          ['Enablement', ['Brief sales and support', 'Publish the FAQ']],
          ['Launch & review', ['Launch day checklist', 'Monitor sign-ups and issues', 'Run the retrospective']],
        ],
      ],
    ],
  },
  {
    slug: 'seo-campaign-management',
    name: 'SEO Campaign Management',
    description: 'Run keyword research, on-page fixes and content production as one tracked programme.',
    long:
      'A structured SEO programme: technical fixes, keyword targets, content production and monthly ranking reviews — all with owners and due dates.',
    category: 'marketing',
    subcategory: 'Marketing Analytics',
    type: 'project',
    tags: ['seo', 'search', 'keywords', 'analytics', 'content', 'traffic'],
    industries: ['Agencies', 'E-commerce', 'Technology', 'Professional Services'],
    created: '2026-08-14',
    boards: [
      [
        'SEO Programme',
        ['Task', 'Target keyword', 'Page', 'Owner', 'Status', 'Due date', 'Position'],
        [
          ['Audit', ['Run a technical crawl', 'Fix indexing and sitemap issues', 'Fix broken links and redirects']],
          ['Keywords', ['Build the keyword map', 'Prioritise by intent and difficulty']],
          ['On-page', ['Rewrite titles and meta descriptions', 'Improve internal linking', 'Add structured data']],
          ['Content & review', ['Publish target-keyword pages', 'Review rankings monthly', 'Report traffic and conversions']],
        ],
      ],
    ],
  },
  {
    slug: 'event-marketing',
    name: 'Event Marketing',
    description: 'Plan an event end to end: promotion, logistics, run-of-show and follow-up.',
    long: 'Covers everything from venue and speakers to registration promotion and the post-event lead follow-up.',
    category: 'marketing',
    subcategory: 'Event Marketing',
    type: 'project',
    tags: ['event', 'webinar', 'conference', 'promotion', 'marketing'],
    industries: ['Agencies', 'Hospitality', 'Education', 'Professional Services'],
    created: '2026-06-24',
    boards: [
      [
        'Event Plan',
        ['Task', 'Workstream', 'Owner', 'Status', 'Due date', 'Cost'],
        [
          ['Set up', ['Confirm date, venue or platform', 'Set the budget', 'Confirm speakers']],
          ['Promotion', ['Build the registration page', 'Run the invitation campaign', 'Send reminders']],
          ['Delivery', ['Prepare the run-of-show', 'Rehearse', 'Run the event']],
          ['Follow-up', ['Send the thank-you and recording', 'Route leads to sales', 'Review cost per attendee']],
        ],
      ],
    ],
  },

  // ───────────── Project Management ─────────────
  {
    slug: 'simple-project',
    name: 'Simple Project',
    description: 'A clean, no-fuss project board for small teams and one-off pieces of work.',
    long: 'The fastest way to get organised: scope, tasks, owners, deadlines and a done column. Ideal for a first project.',
    category: 'project-management',
    subcategory: 'Simple Project',
    type: 'project',
    tags: ['project', 'tasks', 'simple', 'planning', 'team'],
    featured: true,
    created: '2026-08-08',
    boards: [
      [
        'Project Board',
        ['Task', 'Owner', 'Status', 'Priority', 'Start date', 'Due date', 'Notes'],
        [
          ['Plan', ['Define scope and success criteria', 'List deliverables', 'Set the milestone dates']],
          ['This week', ['Kick off with stakeholders', 'Assign owners', 'Unblock dependencies']],
          ['In progress', ['Deliver milestone one', 'Weekly status update']],
          ['Done', ['Sign-off', 'Lessons learned']],
        ],
      ],
    ],
  },
  {
    slug: 'agile-sprint',
    name: 'Agile Project (Sprints)',
    description: 'Run two-week sprints with a backlog, sprint board, review and retrospective.',
    long: 'An agile delivery workspace: refined backlog, sprint commitment, in-flight work, review and retro actions.',
    category: 'project-management',
    subcategory: 'Agile Project',
    type: 'board',
    tags: ['agile', 'scrum', 'sprint', 'backlog', 'development'],
    industries: ['Technology', 'Startups', 'Agencies'],
    created: '2026-07-26',
    boards: [
      [
        'Sprint Board',
        ['Item', 'Epic', 'Owner', 'Status', 'Story points', 'Sprint', 'Due date'],
        [
          ['Backlog', ['Write user stories', 'Estimate and refine', 'Prioritise the backlog']],
          ['Sprint commitment', ['Run sprint planning', 'Commit the sprint scope']],
          ['In progress', ['Daily stand-up notes', 'Code review and QA']],
          ['Review & retro', ['Sprint demo', 'Retrospective actions']],
        ],
      ],
    ],
  },
  {
    slug: 'client-projects',
    name: 'Client Projects',
    description: 'Run multiple client engagements with budgets, milestones and approvals.',
    long: 'Built for agencies and consultancies: one board per client engagement with scope, milestones, approvals and billable time.',
    category: 'project-management',
    subcategory: 'Client Projects',
    type: 'multi-component',
    tags: ['client', 'agency', 'delivery', 'billable', 'milestones'],
    industries: ['Agencies', 'Professional Services', 'Freelancers'],
    created: '2026-08-05',
    boards: [
      [
        'Client Delivery',
        ['Deliverable', 'Client', 'Owner', 'Status', 'Due date', 'Budget', 'Billable hours'],
        [
          ['Onboarding', ['Confirm scope and contract', 'Set up the client workspace', 'Run the kick-off']],
          ['Delivery', ['Produce the first deliverable', 'Client review and feedback', 'Apply revisions']],
          ['Billing', ['Log billable time', 'Raise the invoice', 'Confirm payment']],
        ],
      ],
      [
        'Client Requests',
        ['Request', 'Client', 'Type', 'Priority', 'Owner', 'Status', 'Due date'],
        [
          ['New requests', ['Triage incoming requests', 'Confirm whether in scope']],
          ['Scheduled', ['Estimate and schedule', 'Confirm the date with the client']],
        ],
      ],
    ],
  },
  {
    slug: 'website-project-management',
    name: 'Website Project Management',
    description: 'Deliver a website build from discovery to launch without losing a single task.',
    long:
      'A full website delivery plan: discovery, content, design, build, QA and launch, with client approval points built into each stage.',
    category: 'project-management',
    subcategory: 'Client Projects',
    type: 'project',
    tags: ['website', 'web development', 'design', 'build', 'launch', 'client'],
    industries: ['Agencies', 'Freelancers', 'Technology'],
    created: '2026-08-13',
    boards: [
      [
        'Website Build',
        ['Task', 'Stage', 'Owner', 'Status', 'Due date', 'Approval'],
        [
          ['Discovery', ['Agree goals and audience', 'Map the site structure', 'Sign off the scope']],
          ['Design', ['Wireframe key pages', 'Produce the visual design', 'Client design approval']],
          ['Build', ['Build the page templates', 'Integrate forms and analytics', 'Add content']],
          ['Launch', ['Cross-browser and mobile QA', 'SEO and speed checks', 'Go live and hand over']],
        ],
      ],
    ],
  },
  {
    slug: 'project-portfolio',
    name: 'Project Portfolio',
    description: 'See every active project, its owner, health and budget in one view.',
    long: 'A portfolio-level board for leaders juggling many projects: status, RAG health, budget and next milestone per project.',
    category: 'project-management',
    subcategory: 'Project Portfolio',
    type: 'dashboard',
    tags: ['portfolio', 'projects', 'overview', 'health', 'budget'],
    created: '2026-07-09',
    boards: [
      [
        'Portfolio',
        ['Project', 'Owner', 'Health', 'Status', 'Budget', 'Spent', 'Next milestone'],
        [
          ['Active', ['List all active projects', 'Assign a single owner to each', 'Set the next milestone date']],
          ['Review', ['Weekly health review', 'Escalate red projects']],
          ['Closed', ['Capture lessons learned', 'Archive the project']],
        ],
      ],
    ],
  },
  {
    slug: 'project-risks',
    name: 'Project Risks & Issues',
    description: 'Log risks, score them and track mitigations before they become problems.',
    long: 'A risk and issue register with likelihood, impact, mitigation owner and review dates.',
    category: 'project-management',
    subcategory: 'Project Risks',
    type: 'board',
    tags: ['risk', 'issues', 'raid', 'governance', 'project'],
    industries: ['Construction', 'Professional Services', 'Healthcare', 'Technology'],
    created: '2026-06-28',
    boards: [
      [
        'Risk Register',
        ['Risk / Issue', 'Likelihood', 'Impact', 'Score', 'Mitigation owner', 'Status', 'Review date'],
        [
          ['Identify', ['Run a risk workshop', 'Log known risks', 'Score likelihood and impact']],
          ['Mitigate', ['Agree mitigation actions', 'Assign owners and dates']],
          ['Review', ['Monthly risk review', 'Close resolved risks']],
        ],
      ],
    ],
  },
  {
    slug: 'project-budget',
    name: 'Project Budget',
    description: 'Track planned versus actual spend for every workstream.',
    long: 'Keeps project finances honest: budget lines, committed spend, actuals and variance with a monthly reforecast.',
    category: 'project-management',
    subcategory: 'Project Budget',
    type: 'board',
    tags: ['budget', 'cost', 'project', 'finance', 'variance'],
    created: '2026-06-20',
    boards: [
      [
        'Project Budget',
        ['Budget line', 'Workstream', 'Budget', 'Committed', 'Actual', 'Variance', 'Owner'],
        [
          ['Set up', ['Break the budget into lines', 'Record supplier quotes']],
          ['Track', ['Log purchase orders', 'Record invoices received']],
          ['Review', ['Monthly variance review', 'Reforecast to completion']],
        ],
      ],
    ],
  },

  // ───────────── Finance ─────────────
  {
    slug: 'financial-dashboard',
    name: 'Financial Dashboard',
    description: 'Bring revenue, costs, cash and receivables into a single monthly finance routine.',
    long:
      'A finance command centre pairing with B2BNest invoicing and expenses: month-end close, cash position, receivables chasing and management reporting.',
    category: 'finance',
    subcategory: 'Financial Dashboard',
    type: 'multi-component',
    tags: ['finance', 'cash flow', 'reporting', 'invoices', 'expenses', 'month end'],
    ai: ['AI narrative on monthly financial performance'],
    featured: true,
    created: '2026-08-11',
    boards: [
      [
        'Month-End Close',
        ['Task', 'Owner', 'Status', 'Due date', 'Period'],
        [
          ['Prepare', ['Reconcile the bank feed', 'Chase missing receipts', 'Post accruals and prepayments']],
          ['Report', ['Produce the profit and loss', 'Produce the balance sheet', 'Write the management commentary']],
          ['Review', ['Review with the leadership team', 'Agree corrective actions']],
        ],
      ],
      [
        'Cash Flow',
        ['Item', 'Type', 'Amount', 'Date', 'Confirmed', 'Owner'],
        [
          ['Money in', ['Forecast customer receipts', 'Confirm expected payment dates']],
          ['Money out', ['Schedule supplier payments', 'Forecast payroll and tax']],
          ['Position', ['Update the 13-week cash forecast', 'Flag any shortfall early']],
        ],
      ],
      [
        'Accounts Receivable',
        ['Invoice', 'Customer', 'Amount', 'Due date', 'Days overdue', 'Owner', 'Status'],
        [
          ['Due soon', ['Send a courtesy reminder before the due date']],
          ['Overdue', ['Send the first chase', 'Call the customer', 'Escalate or agree a payment plan']],
        ],
      ],
    ],
  },
  {
    slug: 'expense-tracking',
    name: 'Expense Tracking',
    description: 'Capture, categorise and approve every business expense.',
    long: 'A simple expense workflow with receipt capture, categorisation, approval and reimbursement, ready for your accountant.',
    category: 'finance',
    subcategory: 'Expense Tracking',
    type: 'workflow',
    tags: ['expenses', 'receipts', 'approval', 'reimbursement', 'finance'],
    ai: ['AI receipt scanning to extract vendor, amount, date and category'],
    created: '2026-07-30',
    boards: [
      [
        'Expenses',
        ['Expense', 'Vendor', 'Amount', 'Category', 'Date', 'Submitted by', 'Status'],
        [
          ['Submitted', ['Upload the receipt', 'Confirm the extracted amount and category']],
          ['Approved', ['Manager approval', 'Mark as reimbursable or company card']],
          ['Reconciled', ['Match against the bank transaction', 'Export for the accountant']],
        ],
      ],
    ],
  },
  {
    slug: 'budget-planning',
    name: 'Budget Planning',
    description: 'Build an annual budget by department and review it every month.',
    long: 'Annual budget build and monthly variance review, department by department, with owners for each line.',
    category: 'finance',
    subcategory: 'Budget Planning',
    type: 'board',
    tags: ['budget', 'planning', 'forecast', 'departments', 'finance'],
    created: '2026-07-06',
    boards: [
      [
        'Annual Budget',
        ['Line', 'Department', 'Annual budget', 'Month to date', 'Year to date', 'Variance', 'Owner'],
        [
          ['Build', ['Collect departmental submissions', 'Challenge and consolidate', 'Approve the budget']],
          ['Track', ['Post monthly actuals', 'Explain variances over 10%']],
          ['Reforecast', ['Quarterly reforecast', 'Reallocate underspend']],
        ],
      ],
    ],
  },
  {
    slug: 'invoice-tracking',
    name: 'Invoice Tracking',
    description: 'Know exactly what has been raised, sent, paid and chased.',
    long: 'Tracks the full invoice lifecycle alongside B2BNest invoicing, from draft to payment received.',
    category: 'finance',
    subcategory: 'Invoice Tracking',
    type: 'board',
    tags: ['invoice', 'billing', 'payments', 'cash', 'finance'],
    created: '2026-07-13',
    boards: [
      [
        'Invoices',
        ['Invoice', 'Customer', 'Amount', 'Issue date', 'Due date', 'Status', 'Owner'],
        [
          ['Draft', ['Confirm billable work for the period', 'Prepare the invoice']],
          ['Sent', ['Send to the customer', 'Confirm receipt']],
          ['Paid', ['Record the payment', 'Reconcile against the bank']],
        ],
      ],
    ],
  },

  // ───────────── HR ─────────────
  {
    slug: 'recruitment-pipeline',
    name: 'Recruitment Pipeline',
    description: 'Track every role and candidate from application to offer.',
    long: 'A hiring board covering vacancy approval, sourcing, interview stages, scorecards and the offer process.',
    category: 'hr',
    subcategory: 'Recruitment',
    type: 'board',
    tags: ['recruitment', 'hiring', 'candidates', 'interviews', 'hr'],
    created: '2026-07-24',
    boards: [
      [
        'Hiring Pipeline',
        ['Candidate', 'Role', 'Stage', 'Owner', 'Interview date', 'Score', 'Source'],
        [
          ['Open roles', ['Write the job description', 'Approve the vacancy and budget', 'Publish the advert']],
          ['Screening', ['Review applications', 'Run screening calls']],
          ['Interviews', ['First interview', 'Task or technical stage', 'Final interview']],
          ['Offer', ['Make the offer', 'Take references', 'Confirm the start date']],
        ],
      ],
    ],
  },
  {
    slug: 'employee-onboarding',
    name: 'Employee Onboarding',
    description: 'Give every new starter a consistent first 90 days.',
    long: 'From contract and equipment to first-week training and the probation review, with owners across HR, IT and the line manager.',
    category: 'hr',
    subcategory: 'Employee Onboarding',
    type: 'project',
    tags: ['onboarding', 'new starter', 'hr', 'induction', 'probation'],
    created: '2026-08-03',
    boards: [
      [
        'New Starter',
        ['Task', 'Owner', 'Team', 'Status', 'Due date'],
        [
          ['Before day one', ['Send the offer and contract', 'Collect right-to-work documents', 'Prepare accounts and equipment']],
          ['First week', ['Run the welcome session', 'Assign an onboarding buddy', 'Walk through tools and processes']],
          ['First 90 days', ['Set 30/60/90 day goals', 'Schedule check-ins', 'Complete the probation review']],
        ],
      ],
    ],
  },
  {
    slug: 'performance-reviews',
    name: 'Performance Reviews',
    description: 'Run a fair, on-time review cycle for the whole team.',
    long: 'Coordinates self-assessment, manager review, calibration and outcome conversations across a review cycle.',
    category: 'hr',
    subcategory: 'Performance Reviews',
    type: 'workflow',
    tags: ['performance', 'reviews', 'appraisal', 'hr', 'feedback'],
    created: '2026-06-26',
    boards: [
      [
        'Review Cycle',
        ['Employee', 'Manager', 'Stage', 'Review date', 'Rating', 'Outcome'],
        [
          ['Prepare', ['Confirm the review window', 'Share the review form', 'Collect self-assessments']],
          ['Review', ['Manager writes the review', 'Calibration meeting']],
          ['Close', ['Hold the review conversation', 'Agree development goals', 'Record the outcome']],
        ],
      ],
    ],
  },
  {
    slug: 'leave-tracking',
    name: 'Leave & Absence Tracking',
    description: 'Approve holiday and track absence without spreadsheet chaos.',
    long: 'A leave request and approval board with balances, cover arrangements and a team calendar view.',
    category: 'hr',
    subcategory: 'Leave Tracking',
    type: 'workflow',
    tags: ['leave', 'holiday', 'absence', 'approval', 'hr', 'rota'],
    created: '2026-06-18',
    boards: [
      [
        'Leave Requests',
        ['Employee', 'Type', 'Start date', 'End date', 'Days', 'Cover', 'Status'],
        [
          ['Requested', ['Submit the request', 'Check the team calendar for clashes']],
          ['Approved', ['Manager approval', 'Arrange cover', 'Update the rota']],
          ['Recorded', ['Deduct from the balance', 'Log any unplanned absence']],
        ],
      ],
    ],
  },
  {
    slug: 'training-management',
    name: 'Training Management',
    description: 'Plan and record training, certifications and renewal dates.',
    long: 'A training matrix with required courses per role, completion dates and automatic renewal reminders.',
    category: 'hr',
    subcategory: 'Training Management',
    type: 'board',
    tags: ['training', 'certification', 'compliance', 'learning', 'hr'],
    industries: ['Healthcare', 'Construction', 'Hospitality', 'Education'],
    created: '2026-06-14',
    boards: [
      [
        'Training Matrix',
        ['Employee', 'Course', 'Required by role', 'Completed on', 'Expires on', 'Status'],
        [
          ['Plan', ['List the required training per role', 'Book the courses', 'Set the budget']],
          ['Deliver', ['Run or attend the training', 'Record attendance']],
          ['Renew', ['Track expiry dates', 'Book refresher training']],
        ],
      ],
    ],
  },

  // ───────────── Operations ─────────────
  {
    slug: 'operations-management',
    name: 'Operations Management',
    description: 'Run daily, weekly and monthly operations from one board.',
    long: 'The operational backbone: recurring checks, standard procedures, incidents and continuous improvement actions.',
    category: 'operations',
    subcategory: 'Operations Management',
    type: 'multi-component',
    tags: ['operations', 'process', 'sop', 'checklist', 'improvement'],
    industries: ['Retail', 'Hospitality', 'Construction', 'Professional Services'],
    created: '2026-07-19',
    boards: [
      [
        'Operations Board',
        ['Task', 'Frequency', 'Owner', 'Status', 'Due date', 'Notes'],
        [
          ['Daily', ['Opening checks', 'Handover notes', 'Closing checks']],
          ['Weekly', ['Team operations meeting', 'Review open incidents', 'Stock and supplies check']],
          ['Monthly', ['Review process performance', 'Update the standard operating procedures']],
        ],
      ],
      [
        'Improvements',
        ['Improvement', 'Problem solved', 'Owner', 'Impact', 'Status', 'Due date'],
        [
          ['Ideas', ['Collect ideas from the team', 'Score by impact and effort']],
          ['In progress', ['Pilot the change', 'Measure the result', 'Roll out or revert']],
        ],
      ],
    ],
  },
  {
    slug: 'inventory-management',
    name: 'Inventory Management',
    description: 'Track stock levels, reorder points and stock counts.',
    long: 'Keeps stock under control with SKU records, reorder levels, purchase orders and a periodic count routine.',
    category: 'operations',
    subcategory: 'Inventory',
    type: 'board',
    tags: ['inventory', 'stock', 'sku', 'reorder', 'warehouse'],
    industries: ['Retail', 'E-commerce', 'Hospitality'],
    created: '2026-07-15',
    boards: [
      [
        'Inventory',
        ['Item', 'SKU', 'Location', 'On hand', 'Reorder level', 'Supplier', 'Status'],
        [
          ['Set up', ['List products and SKUs', 'Set reorder levels', 'Record supplier lead times']],
          ['Operate', ['Record stock movements', 'Raise purchase orders', 'Check deliveries against orders']],
          ['Review', ['Run the stock count', 'Review slow-moving items']],
        ],
      ],
    ],
  },
  {
    slug: 'supplier-management',
    name: 'Supplier Management',
    description: 'Keep supplier records, contracts and reviews in one place.',
    long: 'A supplier register with contract dates, pricing, performance reviews and renewal reminders.',
    category: 'operations',
    subcategory: 'Suppliers',
    type: 'board',
    tags: ['suppliers', 'procurement', 'contracts', 'vendors', 'operations'],
    created: '2026-06-22',
    boards: [
      [
        'Suppliers',
        ['Supplier', 'Category', 'Contact', 'Contract end', 'Annual spend', 'Rating', 'Owner'],
        [
          ['Onboard', ['Collect supplier details and insurance', 'Agree terms and pricing']],
          ['Manage', ['Track spend against contract', 'Log delivery and quality issues']],
          ['Review', ['Annual supplier review', 'Renegotiate or replace']],
        ],
      ],
    ],
  },
  {
    slug: 'asset-maintenance',
    name: 'Assets & Maintenance',
    description: 'Track equipment, service schedules and repair requests.',
    long: 'An asset register with planned maintenance schedules, breakdown reporting and warranty tracking.',
    category: 'operations',
    subcategory: 'Maintenance',
    type: 'board',
    tags: ['assets', 'maintenance', 'equipment', 'servicing', 'operations'],
    industries: ['Construction', 'Hospitality', 'Healthcare', 'Retail'],
    created: '2026-06-10',
    boards: [
      [
        'Asset Register',
        ['Asset', 'Location', 'Owner', 'Last service', 'Next service', 'Condition', 'Warranty end'],
        [
          ['Register', ['List all assets and locations', 'Record purchase and warranty details']],
          ['Planned maintenance', ['Schedule servicing', 'Record completed services']],
          ['Repairs', ['Log breakdowns', 'Track repair costs', 'Decide repair or replace']],
        ],
      ],
    ],
  },
  {
    slug: 'order-fulfilment',
    name: 'Order Fulfilment',
    description: 'Move every order from received to delivered with no gaps.',
    long: 'An order pipeline covering picking, packing, dispatch, delivery confirmation and returns.',
    category: 'operations',
    subcategory: 'Orders',
    type: 'workflow',
    tags: ['orders', 'fulfilment', 'shipping', 'delivery', 'ecommerce'],
    industries: ['E-commerce', 'Retail'],
    created: '2026-06-16',
    boards: [
      [
        'Orders',
        ['Order', 'Customer', 'Items', 'Value', 'Status', 'Dispatch date', 'Tracking'],
        [
          ['Received', ['Confirm payment', 'Check stock availability']],
          ['Fulfilment', ['Pick and pack', 'Book the courier', 'Send tracking to the customer']],
          ['Aftercare', ['Confirm delivery', 'Handle returns and refunds']],
        ],
      ],
    ],
  },
  {
    slug: 'payment-integration-rollout',
    name: 'Payment & Merchant Setup',
    description: 'Get card payments, checkout and reconciliation live safely.',
    long:
      'A rollout plan for adding or switching payment providers: merchant onboarding, checkout integration, testing, go-live and reconciliation.',
    category: 'operations',
    subcategory: 'Workflow Management',
    type: 'project',
    tags: ['payments', 'merchant', 'checkout', 'integration', 'reconciliation'],
    industries: ['E-commerce', 'Retail', 'Technology'],
    created: '2026-08-15',
    boards: [
      [
        'Payments Rollout',
        ['Task', 'Stage', 'Owner', 'Status', 'Due date', 'Risk'],
        [
          ['Setup', ['Choose the payment provider', 'Complete merchant onboarding checks', 'Agree fees and payout schedule']],
          ['Integration', ['Connect the checkout', 'Configure refunds and receipts', 'Test with sandbox payments']],
          ['Go live', ['Run a live test transaction', 'Enable for all customers']],
          ['Operate', ['Reconcile payouts to invoices weekly', 'Monitor failed payments and chargebacks']],
        ],
      ],
    ],
  },

  // ───────────── Customer Support ─────────────
  {
    slug: 'support-tickets',
    name: 'Support Tickets',
    description: 'A shared queue so no customer request slips through.',
    long: 'A support desk board with triage, priority, assignment and resolution tracking against response targets.',
    category: 'customer-support',
    subcategory: 'Support Tickets',
    type: 'board',
    tags: ['support', 'tickets', 'helpdesk', 'customer', 'sla'],
    ai: ['AI-drafted first replies from the AI Assistant', 'AI ticket categorisation suggestions'],
    created: '2026-08-07',
    boards: [
      [
        'Ticket Queue',
        ['Ticket', 'Customer', 'Type', 'Priority', 'Owner', 'Opened', 'Due', 'Status'],
        [
          ['New', ['Triage incoming tickets', 'Set priority and owner', 'Send first response']],
          ['In progress', ['Investigate the issue', 'Update the customer', 'Escalate if needed']],
          ['Resolved', ['Confirm the fix with the customer', 'Add to the knowledge base']],
        ],
      ],
    ],
  },
  {
    slug: 'customer-feedback',
    name: 'Customer Feedback',
    description: 'Collect feedback, spot themes and close the loop with customers.',
    long: 'Turns scattered feedback into themes, actions and follow-up so customers see their input change the product or service.',
    category: 'customer-support',
    subcategory: 'Customer Feedback',
    type: 'workflow',
    tags: ['feedback', 'nps', 'voice of customer', 'improvement', 'support'],
    ai: ['AI theme detection across feedback entries'],
    created: '2026-07-08',
    boards: [
      [
        'Feedback',
        ['Feedback', 'Customer', 'Theme', 'Sentiment', 'Owner', 'Status', 'Follow-up date'],
        [
          ['Collected', ['Log feedback from calls, email and surveys', 'Tag the theme and sentiment']],
          ['Actioned', ['Turn recurring themes into improvement tasks', 'Assign an owner']],
          ['Closed', ['Tell the customer what changed', 'Publish the improvement internally']],
        ],
      ],
    ],
  },
  {
    slug: 'sla-management',
    name: 'SLA Management',
    description: 'Define response targets and track how well you meet them.',
    long: 'Sets service levels per customer tier, tracks breaches and drives corrective action.',
    category: 'customer-support',
    subcategory: 'SLA Management',
    type: 'dashboard',
    tags: ['sla', 'service level', 'support', 'performance', 'targets'],
    created: '2026-06-12',
    boards: [
      [
        'SLA Tracking',
        ['Customer / Tier', 'Response target', 'Resolution target', 'Achieved %', 'Breaches', 'Owner', 'Period'],
        [
          ['Define', ['Agree targets per customer tier', 'Document the escalation path']],
          ['Measure', ['Record response and resolution times', 'Flag breaches immediately']],
          ['Improve', ['Review breaches monthly', 'Fix the root cause']],
        ],
      ],
    ],
  },
  {
    slug: 'customer-complaints',
    name: 'Customer Complaints',
    description: 'Handle complaints properly and learn from every one.',
    long: 'A complaint handling process with acknowledgement, investigation, resolution, and root-cause action so it does not repeat.',
    category: 'customer-support',
    subcategory: 'Customer Complaints',
    type: 'workflow',
    tags: ['complaints', 'escalation', 'root cause', 'customer', 'quality'],
    industries: ['Retail', 'Hospitality', 'Healthcare', 'Professional Services'],
    created: '2026-06-08',
    boards: [
      [
        'Complaints',
        ['Complaint', 'Customer', 'Severity', 'Owner', 'Received', 'Resolved', 'Root cause'],
        [
          ['Received', ['Acknowledge within 24 hours', 'Record the details and severity']],
          ['Investigating', ['Gather the facts', 'Agree the remedy with the customer']],
          ['Resolved', ['Confirm resolution in writing', 'Log the root cause and preventive action']],
        ],
      ],
    ],
  },

  // ───────────── AI & Automation ─────────────
  {
    slug: 'ai-workflow-automation',
    name: 'AI Workflow Automation',
    description: 'Find manual work, automate it, and measure the hours saved.',
    long:
      'A structured programme for automating repetitive business processes with B2BNest workflows and AI: identify, design, build, test and measure each automation.',
    category: 'ai-automation',
    subcategory: 'AI Workflow Automation',
    type: 'ai-workflow',
    tags: ['ai', 'automation', 'workflow', 'efficiency', 'process'],
    ai: [
      'AI drafting of the automation steps in Workflow Studio',
      'AI summaries of workflow run results',
      'AI suggestions for the next process to automate',
    ],
    automations: [
      'Trigger a workflow when an item reaches a status',
      'Scheduled workflow runs with result logging',
      'Email or notification on workflow failure',
    ],
    featured: true,
    created: '2026-08-16',
    boards: [
      [
        'Automation Programme',
        ['Automation', 'Process', 'Owner', 'Status', 'Hours saved / month', 'Go-live date'],
        [
          ['Identify', ['List repetitive manual tasks', 'Estimate time spent per month', 'Prioritise by hours saved']],
          ['Design', ['Map the current process', 'Define the trigger and the actions']],
          ['Build & test', ['Build the workflow in Workflow Studio', 'Run a test with real data', 'Fix failures']],
          ['Live', ['Switch the automation on', 'Review run logs weekly', 'Record hours saved']],
        ],
      ],
    ],
  },
  {
    slug: 'ai-lead-qualification',
    name: 'AI Lead Qualification',
    description: 'Score and route every inbound lead automatically, then work the best ones first.',
    long:
      'Combines B2BNest lead capture with AI scoring so your team spends its time on the leads most likely to buy, with a clear routing rule for everything else.',
    category: 'ai-automation',
    subcategory: 'AI Lead Qualification',
    type: 'ai-workflow',
    tags: ['ai', 'leads', 'scoring', 'qualification', 'sales', 'routing'],
    ai: ['AI lead scoring 0–100', 'AI enrichment notes on each lead', 'AI-suggested next action per lead'],
    created: '2026-08-09',
    boards: [
      [
        'AI Lead Qualification',
        ['Lead', 'Source', 'AI score', 'Reason', 'Route', 'Owner', 'Next action'],
        [
          ['Set up', ['Define your ideal customer profile', 'Set the scoring thresholds', 'Agree routing rules']],
          ['Run', ['Review AI-scored leads daily', 'Work high-score leads first', 'Send low-score leads to nurture']],
          ['Improve', ['Compare AI scores to closed-won deals', 'Tune the scoring criteria monthly']],
        ],
      ],
    ],
  },
  {
    slug: 'ai-customer-support',
    name: 'AI Customer Support Assistant',
    description: 'Draft replies with AI, keep a human in the loop, and grow your knowledge base.',
    long:
      'An AI-assisted support workflow: AI drafts the first reply from your knowledge base, an agent reviews and sends, and every resolved ticket feeds the knowledge base back.',
    category: 'ai-automation',
    subcategory: 'AI Customer Support',
    type: 'ai-workflow',
    tags: ['ai', 'support', 'tickets', 'knowledge base', 'customer'],
    ai: ['AI-drafted replies', 'AI ticket summarisation', 'AI knowledge base article drafting'],
    created: '2026-08-09',
    boards: [
      [
        'AI Support Desk',
        ['Ticket', 'Customer', 'AI draft', 'Agent', 'Status', 'Resolution time'],
        [
          ['Set up', ['Load your FAQs into the knowledge base', 'Agree the tone of voice', 'Set escalation rules']],
          ['Operate', ['Review the AI draft reply', 'Send or rewrite', 'Escalate complex tickets']],
          ['Improve', ['Turn resolved tickets into articles', 'Review AI reply quality weekly']],
        ],
      ],
    ],
  },
  {
    slug: 'ai-email-assistant',
    name: 'AI Email Assistant',
    description: 'Clear the inbox faster with AI-drafted replies and follow-ups.',
    long: 'A workflow for handling high email volume: triage, AI drafting, approval and follow-up scheduling.',
    category: 'ai-automation',
    subcategory: 'AI Email Assistant',
    type: 'ai-workflow',
    tags: ['ai', 'email', 'inbox', 'productivity', 'communication'],
    ai: ['AI reply drafting', 'AI summarisation of long threads'],
    created: '2026-07-31',
    boards: [
      [
        'Email Workflow',
        ['Email / Thread', 'Category', 'AI draft', 'Owner', 'Status', 'Due date'],
        [
          ['Triage', ['Categorise incoming email', 'Decide reply, delegate or archive']],
          ['Respond', ['Generate the AI draft', 'Review and personalise', 'Send']],
          ['Follow up', ['Schedule the follow-up', 'Close the thread when answered']],
        ],
      ],
    ],
  },
  {
    slug: 'ai-business-reporting',
    name: 'AI Business Reporting',
    description: 'Turn your B2BNest data into a written management report every month.',
    long:
      'A reporting routine where AI writes the first draft of the monthly management commentary from your revenue, project and customer data, ready for you to review.',
    category: 'ai-automation',
    subcategory: 'AI Reporting',
    type: 'ai-workflow',
    tags: ['ai', 'reporting', 'insights', 'management', 'analytics'],
    ai: ['AI-written monthly commentary', 'AI-highlighted anomalies and trends'],
    created: '2026-08-09',
    boards: [
      [
        'Monthly Reporting',
        ['Section', 'Data source', 'Owner', 'Status', 'Due date'],
        [
          ['Collect', ['Confirm the month is closed in finance', 'Pull sales and delivery numbers']],
          ['Draft', ['Generate the AI commentary', 'Check the figures against source data']],
          ['Publish', ['Review with the leadership team', 'Circulate the report', 'Log the agreed actions']],
        ],
      ],
    ],
  },
  {
    slug: 'ai-marketing-planner',
    name: 'AI Marketing Planner',
    description: 'Plan a quarter of marketing with AI help on angles, copy and calendar.',
    long: 'Uses AI to go from a business goal to a full quarterly marketing plan with channels, content angles and a production calendar.',
    category: 'ai-automation',
    subcategory: 'AI Marketing',
    type: 'ai-workflow',
    tags: ['ai', 'marketing', 'planning', 'content', 'campaign'],
    ai: ['AI channel and angle recommendations', 'AI content outlines and copy drafts'],
    created: '2026-08-09',
    boards: [
      [
        'AI Marketing Plan',
        ['Initiative', 'Channel', 'AI input', 'Owner', 'Status', 'Launch date'],
        [
          ['Plan', ['State the quarterly goal', 'Generate channel recommendations', 'Choose the three biggest bets']],
          ['Produce', ['Generate outlines and drafts', 'Edit for brand voice', 'Approve for publication']],
          ['Measure', ['Track results by channel', 'Reallocate spend to what works']],
        ],
      ],
    ],
  },
  {
    slug: 'ai-sales-assistant',
    name: 'AI Sales Assistant',
    description: 'Prepare for every call, draft every follow-up and keep the pipeline honest.',
    long:
      'An AI-supported sales routine: pre-call research briefs, AI-drafted follow-ups after every meeting and an AI pipeline health check before each review.',
    category: 'ai-automation',
    subcategory: 'AI Sales Assistant',
    type: 'ai-workflow',
    tags: ['ai', 'sales', 'assistant', 'pipeline', 'follow-up'],
    ai: ['AI pre-call briefs', 'AI follow-up email drafting', 'AI pipeline risk analysis'],
    created: '2026-08-09',
    boards: [
      [
        'AI Sales Routine',
        ['Deal / Call', 'Account', 'AI brief', 'Owner', 'Date', 'Next step'],
        [
          ['Prepare', ['Generate the pre-call brief', 'Confirm the meeting objective']],
          ['Follow up', ['Log the call notes', 'Generate the follow-up email', 'Set the next step and date']],
          ['Review', ['Run the AI pipeline health check', 'Action at-risk deals']],
        ],
      ],
    ],
  },
];

export const BUILT_IN_TEMPLATES: WorkspaceTemplate[] = SEEDS.map(toTemplate);
