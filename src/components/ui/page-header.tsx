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
                  <BreadcrumbLink asChild><Link to={item.to} className="truncate">{item.label}</Link></BreadcrumbLink>
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
    <header className={cn('mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? <PageBreadcrumbs items={breadcrumbs} /> : eyebrow && <div className="mb-1.5 text-xs font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
