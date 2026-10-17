import { Link } from 'react-router-dom';
import { Home, ListChecks, Menu, NotebookPen, Users } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', to: '/dashboard', icon: Home },
  { label: 'Tasks', to: '/project-management?view=list', icon: ListChecks },
  { label: 'CRM', to: '/crm', icon: Users },
  { label: 'Notes', to: '/business-tools/notepro', icon: NotebookPen },
];

const tabCls = 'flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11.5px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring';

/** Phone-only bottom tab bar. "More" opens the full menu. */
export function MobileTabBar({ matches }: { matches: (to: string) => boolean }) {
  const { setOpenMobile, openMobile } = useSidebar();
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {tabs.map(({ label, to, icon: Icon }) => {
          const on = matches(to);
          return (
            <li key={to} className="flex flex-1">
              <Link to={to} aria-current={on ? 'page' : undefined} className={cn(tabCls, on ? 'text-link' : 'text-muted-foreground')}>
                <Icon className="h-5 w-5" aria-hidden="true" />{label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" onClick={() => setOpenMobile(true)} aria-expanded={openMobile} className={cn(tabCls, 'text-muted-foreground')}>
            <Menu className="h-5 w-5" aria-hidden="true" />More
          </button>
        </li>
      </ul>
    </nav>
  );
}
