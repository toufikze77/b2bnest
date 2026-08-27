import { Template } from '@/types/template';

export interface BlueprintTask {
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  /** Days from the day the template is applied. */
  dayOffset: number;
  labels?: string[];
  estimatedHours?: number;
}

export interface BlueprintGroup {
  name: string;
  tasks: BlueprintTask[];
}

export interface TemplateBlueprint {
  boardName: string;
  description: string;
  color: string;
  /** Board columns, mirroring the Monday-style group structure. */
  groups: BlueprintGroup[];
  totalTasks: number;
}

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#db2777'];

const colorFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return COLORS[hash % COLORS.length];
};

type Recipe = Record<string, string[]>;

/** Curated task recipes keyed by the keyword found in a template's title/tags. */
const RECIPES: Array<{ match: RegExp; groups: Recipe }> = [
  {
    match: /invoice|billing|payment/i,
    groups: {
      'Set up': [
        'Add company details and logo',
        'Configure tax rates and payment terms',
        'Choose default invoice template',
      ],
      'Issue invoices': [
        'Draft invoice for current client work',
        'Review line items and totals',
        'Send invoice to client',
      ],
      'Track & collect': [
        'Log payment when received',
        'Send reminder for overdue invoices',
        'Reconcile against bank transactions',
      ],
    },
  },
  {
    match: /budget|expense|financ|cash|profit/i,
    groups: {
      'Plan': ['Define budget categories', 'Set monthly targets', 'Record opening balances'],
      'Track': ['Log recurring expenses', 'Import bank transactions', 'Categorise uncategorised spend'],
      'Review': ['Compare actuals vs budget', 'Flag overspend areas', 'Publish monthly summary'],
    },
  },
  {
    match: /crm|sales|lead|pipeline|deal|prospect/i,
    groups: {
      'Prospecting': ['Build target account list', 'Import contacts', 'Qualify inbound leads'],
      'Engaged': ['Send intro sequence', 'Book discovery calls', 'Log call notes'],
      'Proposal': ['Send proposal / quote', 'Follow up on proposal', 'Negotiate terms'],
      'Closed': ['Mark deal won or lost', 'Hand over to delivery', 'Request testimonial'],
    },
  },
  {
    match: /onboard|employee|hr|recruit|hiring|staff|rota|attendance/i,
    groups: {
      'Before day one': ['Send offer and contract', 'Collect right-to-work documents', 'Prepare accounts and equipment'],
      'First week': ['Run welcome session', 'Assign onboarding buddy', 'Walk through tools and processes'],
      'First 90 days': ['Set 30/60/90 day goals', 'Schedule check-ins', 'Complete probation review'],
    },
  },
  {
    match: /marketing|campaign|content|social|seo|brand/i,
    groups: {
      'Ideas': ['Define campaign goal and audience', 'Research keywords and angles', 'Draft content calendar'],
      'In production': ['Write copy', 'Design creative assets', 'Internal review and approval'],
      'Scheduled': ['Schedule posts and emails', 'Set up tracking links', 'Brief the team'],
      'Reporting': ['Collect performance data', 'Report on results', 'Plan next iteration'],
    },
  },
  {
    match: /legal|contract|agreement|policy|nda|compliance/i,
    groups: {
      'Draft': ['Fill in party details', 'Adapt clauses to this engagement', 'Add commercial terms'],
      'Review': ['Internal review', 'Legal or advisor review', 'Send to counterparty'],
      'Execute': ['Collect signatures', 'File the executed copy', 'Diarise renewal or review date'],
    },
  },
  {
    match: /project|plan|roadmap|sprint|workflow|operation|process/i,
    groups: {
      'Backlog': ['Define scope and success criteria', 'List deliverables', 'Identify risks and dependencies'],
      'This week': ['Kick-off with stakeholders', 'Assign owners to workstreams', 'Set milestone dates'],
      'In progress': ['Execute first milestone', 'Track time and budget', 'Weekly status update'],
      'Done': ['Client sign-off', 'Retrospective and lessons learned'],
    },
  },
  {
    match: /inventory|supplier|stock|purchase|order/i,
    groups: {
      'Set up': ['List products and SKUs', 'Record supplier details', 'Set reorder levels'],
      'Operate': ['Record stock movements', 'Raise purchase orders', 'Check deliveries against orders'],
      'Review': ['Run stock count', 'Review slow-moving items', 'Renegotiate supplier pricing'],
    },
  },
];

const FALLBACK: Recipe = {
  'Getting started': [
    'Review the template and adjust to your business',
    'Add your company details',
    'Invite the people who will use this board',
  ],
  'In progress': ['Complete the first item', 'Track progress weekly', 'Attach supporting documents'],
  'Done': ['Review outcome', 'Archive completed work'],
};

const STATUS_BY_INDEX: BlueprintTask['status'][] = ['todo', 'todo', 'in-progress', 'review', 'done'];

/** Builds a ready-to-use board layout (groups + tasks) for a marketplace template. */
export const buildBlueprint = (template: Template): TemplateBlueprint => {
  const haystack = `${template.title} ${template.subcategory ?? ''} ${template.category.name} ${template.tags.join(' ')}`;
  const recipe = RECIPES.find((r) => r.match.test(haystack))?.groups ?? FALLBACK;

  let index = 0;
  const groups: BlueprintGroup[] = Object.entries(recipe).map(([name, titles], groupIndex) => ({
    name,
    tasks: titles.map((title, taskIndex) => {
      const task: BlueprintTask = {
        title,
        description: `${template.title} — ${name}`,
        status: STATUS_BY_INDEX[Math.min(groupIndex, STATUS_BY_INDEX.length - 1)],
        priority: groupIndex === 0 ? 'high' : taskIndex === 0 ? 'medium' : 'low',
        dayOffset: groupIndex * 7 + (taskIndex + 1) * 2,
        labels: [template.category.name],
        estimatedHours: 2,
      };
      index += 1;
      return task;
    }),
  }));

  return {
    boardName: template.title,
    description: template.description,
    color: colorFor(template.id),
    groups,
    totalTasks: index,
  };
};
