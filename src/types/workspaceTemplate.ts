export type TemplateType =
  | 'board'
  | 'project'
  | 'crm'
  | 'dashboard'
  | 'workflow'
  | 'automation'
  | 'ai-workflow'
  | 'multi-component';

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  board: 'Board template',
  project: 'Project template',
  crm: 'CRM template',
  dashboard: 'Dashboard template',
  workflow: 'Workflow template',
  automation: 'Automation template',
  'ai-workflow': 'AI workflow template',
  'multi-component': 'Multi-component business template',
};

export type TemplatePlan = 'free' | 'included' | 'premium';

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TemplateTask {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Days from the day the template is applied. */
  dayOffset: number;
  estimatedHours?: number;
}

export interface TemplateGroup {
  name: string;
  tasks: TemplateTask[];
}

export interface TemplateBoard {
  name: string;
  description: string;
  color: string;
  columns: string[];
  statuses: string[];
  views: string[];
  groups: TemplateGroup[];
}

export interface WorkspaceTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  subcategory: string;
  industries: string[];
  templateType: TemplateType;
  tags: string[];
  isAiPowered: boolean;
  aiFeatures: string[];
  automations: string[];
  features: string[];
  whoItsFor: string[];
  helpsYouManage: string[];
  exampleWorkflow: string[];
  plan: TemplatePlan;
  status: 'published' | 'draft' | 'archived';
  featured: boolean;
  isCustom: boolean;
  thumbnail?: string | null;
  previewImages: string[];
  createdAt: string;
  updatedAt: string;
  boards: TemplateBoard[];
}

export interface TemplateUsage {
  views: number;
  previews: number;
  useClicks: number;
  created: number;
}

export interface TemplateCategoryDef {
  id: string;
  name: string;
  subcategories: string[];
}
