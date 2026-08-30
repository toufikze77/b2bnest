import { useLocation } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

interface Meta {
  title: string;
  description: string;
  noIndex?: boolean;
}

/**
 * Per-route title/description for pages that don't render their own <SEOHead />.
 * Pages with their own SEOHead are intentionally absent from this map.
 */
const ROUTE_META: Record<string, Meta> = {
  '/contact': {
    title: 'Contact B2BNest | Talk to Our Business Tools Team',
    description: 'Get in touch with the B2BNest team for support, sales questions, partnerships or feedback on our all-in-one business platform.',
  },
  '/business-tools': {
    title: 'Business Tools | CRM, Invoicing & Finance in One Place',
    description: 'Browse B2BNest business tools: CRM, invoicing, quotes, expenses, payroll, contracts and AI document generation for small businesses.',
  },
  '/ai-showcase': {
    title: 'AI Showcase | See B2BNest AI Business Tools in Action',
    description: 'Explore live examples of B2BNest AI tools for documents, business advice, insights and automation across your daily operations.',
  },
  '/ai-studio': {
    title: 'AI Studio | AI Assistant & Document Generation for Business',
    description: 'Use the B2BNest AI Studio to draft documents, analyse your business data and get instant AI answers built around your company.',
  },
  '/forum': {
    title: 'Community Forum | B2BNest Business Discussions',
    description: 'Join the B2BNest community forum to share advice, ask questions and learn how other businesses run operations more efficiently.',
  },
  '/plr': {
    title: 'PLR Business Content | Ready-to-Use Templates & Guides',
    description: 'Private label rights business content, templates and guides you can rebrand and use inside your own company or client work.',
  },
  '/privacy': {
    title: 'Privacy Policy | How B2BNest Protects Your Data',
    description: 'Read the B2BNest privacy policy covering what data we collect, how it is stored and secured, and your rights over your information.',
  },
  '/terms': {
    title: 'Terms of Service | B2BNest Platform Agreement',
    description: 'The terms and conditions that govern your use of the B2BNest business platform, subscriptions, and connected integrations.',
  },
  '/business-news': {
    title: 'Business News | Daily Updates for Founders & SMEs',
    description: 'Stay current with curated business, finance and technology news relevant to founders, freelancers and growing companies.',
  },
  '/categories/human-resources': {
    title: 'HR Templates | Contracts, Policies & Onboarding Documents',
    description: 'Download human resources templates including employment contracts, staff policies, onboarding checklists and appraisal forms.',
  },
  '/categories/legal-documents': {
    title: 'Legal Document Templates for Small Businesses',
    description: 'Professional legal templates including NDAs, service agreements, terms and client contracts, ready to customise for your business.',
  },
  '/categories/financial-forms': {
    title: 'Financial Forms | Invoices, Quotes & Expense Templates',
    description: 'Financial document templates for invoicing, quotations, expense claims, budgets and cash-flow tracking in your business.',
  },
  '/categories/operations': {
    title: 'Operations Templates | Processes, SOPs & Checklists',
    description: 'Operational templates for standard procedures, project checklists, supplier management and day-to-day business workflows.',
  },
  '/marketing-materials': {
    title: 'Marketing Templates for Small Business Campaigns',
    description: 'Marketing document templates and assets to plan campaigns, pitch clients and present your business professionally.',
  },
  '/knowledge-base/getting-started': {
    title: 'Getting Started with B2BNest | Setup Guide',
    description: 'Step-by-step guide to setting up your B2BNest workspace, inviting your team and configuring your first business tools.',
  },
  '/knowledge-base/business-tools': {
    title: 'Business Tools Guide | Using B2BNest Day to Day',
    description: 'Learn how to use B2BNest business tools for CRM, invoicing, documents and project tracking in your everyday operations.',
  },
  '/knowledge-base/integrations': {
    title: 'Integrations Guide | Connect B2BNest to Your Stack',
    description: 'How to connect B2BNest with Gmail, calendars, HMRC, banking and other services so your business data stays in sync.',
  },
  '/knowledge-base/financial-tools': {
    title: 'Financial Tools Guide | Invoicing, Payroll & Cash Flow',
    description: 'Guide to B2BNest financial tools covering invoicing, expenses, payroll, cash-flow forecasting and HMRC-ready reporting.',
  },
  '/knowledge-base/workflows': {
    title: 'Workflow Automation Guide | B2BNest Workflow Studio',
    description: 'Build automated business workflows in B2BNest: triggers, actions, notifications and integrations that remove manual work.',
  },
  '/knowledge-base/security': {
    title: 'Security Guide | How B2BNest Keeps Your Data Safe',
    description: 'Understand B2BNest security: encryption, multi-tenant data isolation, access controls, 2FA and audit logging.',
  },
  '/knowledge-base/lead-generation': {
    title: 'Lead Generation Guide | Forms, Landing Pages & Scoring',
    description: 'Capture and qualify leads with B2BNest forms, landing pages, imports and AI lead scoring built into your CRM.',
  },
  // Signed-in application areas: unique titles, kept out of the index
  '/crm': {
    title: 'CRM | Manage Contacts, Deals & Client Relationships',
    description: 'Your B2BNest CRM workspace for contacts, pipelines, deals and client activity across your organization.',
    noIndex: true,
  },
  '/project-management': {
    title: 'Project Management | Boards, Tasks & Team Delivery',
    description: 'Plan and deliver work in B2BNest with boards, tasks, timelines and team collaboration in one workspace.',
    noIndex: true,
  },
  '/dashboard': {
    title: 'Dashboard | Your B2BNest Business Workspace',
    description: 'Your personal B2BNest dashboard with business metrics, recent activity and quick access to your tools.',
    noIndex: true,
  },
  '/settings': {
    title: 'Settings | Profile, Team & Integration Preferences',
    description: 'Manage your B2BNest profile, organization, team members, billing and integration preferences.',
    noIndex: true,
  },
  '/auth': {
    title: 'Sign In or Create Your B2BNest Account',
    description: 'Sign in to B2BNest or create a free account to access CRM, invoicing, projects and AI business tools.',
    noIndex: true,
  },
};

const RouteMeta = () => {
  const { pathname } = useLocation();
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const meta = ROUTE_META[key];

  if (!meta) return null;

  return <SEOHead title={meta.title} description={meta.description} noIndex={meta.noIndex} />;
};

export default RouteMeta;
