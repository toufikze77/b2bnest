import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Crumb, PageHeader } from '@/components/ui/page-header';

/**
 * Page header for pages with a tab row (CRM, Invoices & quotes): the standard light PageHeader
 * (breadcrumb, title, description, actions) with a full-width navy strip under it that holds only the tabs.
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
    <div className={cn('min-w-0', className)}>
      {/* Same gutters and width as PageContainer (wide) so the title lines up with the content below. */}
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8">
        <PageHeader breadcrumbs={breadcrumbs} title={title} description={description} actions={actions} className="mb-0 border-b-0 pb-5" />
      </div>
      {tabs && (
        <div data-tab-strip className="bg-brand-navy text-brand-navy-foreground dark:border-y dark:border-white/10">
          <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">{tabs}</div>
        </div>
      )}
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
