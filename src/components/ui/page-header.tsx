import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="break-words text-2xl font-semibold leading-tight text-foreground sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}