import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/lazyPage';

export const UPDATED_MESSAGE = 'B2BNEST has been updated since this tab was opened. Reload to get the latest version.';
export const FAILED_MESSAGE = "Something went wrong while showing this page. Your data hasn't been changed.";

type Props = { children: ReactNode; resetKey?: string };
type State = { error: unknown };

/** Keeps a page error from blanking the whole app: shows a readable message and a way out instead. */
export class ErrorBoundaryView extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State { return { error }; }

  componentDidCatch(error: unknown) { console.error('Page error:', error); }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const updated = isChunkLoadError(this.state.error);
    return (
      <main role="alert" className="mx-auto max-w-lg px-4 py-16 text-foreground">
        <h1 className="text-xl font-semibold">{updated ? 'A new version is available' : "This page couldn't load"}</h1>
        <p className="mt-3 text-base text-muted-foreground">{updated ? UPDATED_MESSAGE : FAILED_MESSAGE}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>Go to dashboard</Button>
        </div>
      </main>
    );
  }
}

/** Resets when the user navigates elsewhere, so one broken page doesn't block the rest of the app. */
export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundaryView resetKey={pathname}>{children}</ErrorBoundaryView>;
}
