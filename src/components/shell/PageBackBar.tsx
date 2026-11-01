import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Crumb { label: string; to?: string }

interface PageBackBarProps {
  /** The current page, shown as the last breadcrumb. */
  title: string;
  /** Where Back goes when there is no page of this app behind this one (opened by link, new tab, refresh). */
  fallbackTo?: string;
  fallbackLabel?: string;
  /** Breadcrumb before the title. Defaults to one crumb: fallbackLabel → fallbackTo. */
  crumbs?: Crumb[];
}

/** True when React Router has an entry of this app behind the current one (BrowserRouter keeps `idx` in history.state). */
const hasAppHistory = () => {
  const idx = (typeof window !== 'undefined' ? (window.history.state as { idx?: unknown } | null)?.idx : undefined);
  return typeof idx === 'number' && idx > 0;
};

/**
 * Phase 29: the one back control on a Business Tools page. "Back" returns to the previous page of the app when there is
 * one, otherwise to `fallbackTo`, so it never takes the person out of the website (Chrome's own Back button can).
 */
export default function PageBackBar({ title, fallbackTo = '/business-tools', fallbackLabel = 'Business tools', crumbs }: PageBackBarProps) {
  const navigate = useNavigate();
  const trail = crumbs ?? [{ label: fallbackLabel, to: fallbackTo }];
  const goBack = () => (hasAppHistory() ? navigate(-1) : navigate(fallbackTo));

  return (
    <div className="border-b border-border bg-surface/95 backdrop-blur" data-testid="page-back-bar">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goBack}
          aria-label="Go back"
          className="min-h-touch shrink-0 gap-2 whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            {trail.map((c) => (
              <li key={c.label} className="flex min-w-0 shrink items-center gap-1">
                {c.to ? (
                  <Link to={c.to} className="truncate rounded-control hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                    {c.label}
                  </Link>
                ) : <span className="truncate">{c.label}</span>}
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </li>
            ))}
            <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">{title}</li>
          </ol>
        </nav>
      </div>
    </div>
  );
}
