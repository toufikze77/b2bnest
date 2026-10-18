import { Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}

export function PageBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList className="text-xs">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem className="min-w-0">
                {last || !item.to ? (
                  <BreadcrumbPage className="truncate text-muted-foreground">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild><Link to={item.to} className="inline-flex min-h-touch items-center truncate rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">{item.label}</Link></BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function PageHeader({ title, description, eyebrow, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    // The actions sit beside the title when there is room and wrap under it when there isn't, so a page with many
    // controls never squeezes its title column (the title keeps at least 20rem, or the full width on phones).
    <header className={cn('mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-border pb-5', className)}>
      <div className="min-w-0 flex-[1_1_20rem]">
        {breadcrumbs?.length ? <PageBreadcrumbs items={breadcrumbs} /> : eyebrow && <div className="mb-1.5 text-xs font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="break-words text-page-title text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
