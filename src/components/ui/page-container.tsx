import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const widths = {
  narrow: 'max-w-4xl',
  default: 'max-w-6xl',
  wide: 'max-w-[1440px]',
  full: 'max-w-[1760px]',
} as const;

interface PageContainerProps {
  children: ReactNode;
  width?: keyof typeof widths;
  className?: string;
}

/** Standard authenticated page frame: shared width, gutters and vertical rhythm. No page background — the shell owns it. */
export function PageContainer({ children, width = 'wide', className }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8', widths[width], className)}>
      {children}
    </div>
  );
}
