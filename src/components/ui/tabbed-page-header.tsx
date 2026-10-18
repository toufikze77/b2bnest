import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Crumb, PageHeader } from '@/components/ui/page-header';

/**
 * Page header for pages with a tab row (CRM, Invoices & quotes): the standard light PageHeader
 * (breadcrumb, title, description, actions) with a navy tab strip under it that holds only the tabs.
 * The strip stays within the content width (same edges as the title and the cards) and is rounded like a card.
 * The page keeps its own controlled <Tabs> and passes its <TabsList> in `tabs`; this component owns no tab state.
 */
export function TabbedPageHeader({ breadcrumbs, title, description, actions, tabs, className }: {
  breadcrumbs?: Crumb[];
  title: string;
  description?: string;
  actions?: ReactNode;
  /** The page's own TabsList (style it with tabStripListClass / tabStripTriggerClass). */
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    // One container (same max width and gutters as the page body / PageContainer "wide"), so the title,
    // the strip and the cards below share the same left and right edges at every breakpoint.
    <div className={cn('mx-auto w-full min-w-0 max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8', className)}>
      <PageHeader breadcrumbs={breadcrumbs} title={title} description={description} actions={actions} className="mb-0 border-b-0 pb-6" />
      {tabs && <TabStrip>{tabs}</TabStrip>}
    </div>
  );
}

/**
 * The navy tab bar on its own, for a page whose tabs sit further down (e.g. under summary cards).
 * Rounded like the cards; overflow-hidden keeps the sideways scroll of the tab list inside the rounded shape.
 * px-1 keeps the first tab's focus ring off the corner.
 */
export function TabStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-tab-strip className={cn('overflow-hidden rounded-card bg-brand-navy px-1 text-brand-navy-foreground dark:border dark:border-white/10', className)}>
      {children}
    </div>
  );
}

/** TabsList on the navy strip: scrolls sideways inside itself on narrow screens. */
export const tabStripListClass = 'flex h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 text-brand-navy-muted';
/**
 * A tab on the navy strip: light text, white + bold-weight underline marker when active (never colour alone),
 * 44px tall on phones, focus ring visible on navy (inset so the strip's overflow never clips it).
 */
export const tabStripTriggerClass = 'min-h-touch shrink-0 rounded-none border-b-[3px] border-transparent px-3 py-2.5 text-body font-semibold text-brand-navy-muted shadow-none hover:text-white focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-offset-0 data-[state=active]:border-nav-marker data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-white data-[state=active]:shadow-none';
/** Thin divider between tab groups on the strip. */
export const tabStripDividerClass = 'mx-2 h-5 w-px shrink-0 self-center bg-white/25';
