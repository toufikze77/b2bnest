import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';

// Phase 13: one-click unsubscribe from the trial emails. Public (no sign-in). The token is checked inside the database
// (public.email_unsubscribe), which answers the same for valid, invalid and repeated tokens, so this page shows the
// same confirmation whatever the token was. It never says whether an account or email exists.
export const UNSUBSCRIBED_TITLE = "You're unsubscribed";
export const UNSUBSCRIBED_TEXT = "You won't get any more emails about your B2BNEST trial.";
export const UNSUBSCRIBE_FAILED = "We couldn't record that just now. Please open the link from the email again in a few minutes, or contact us.";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return; // once per visit, even in React's development double-run
    sent.current = true;
    // A link without a well-formed token gets the same answer; the database would ignore it anyway.
    if (!/^[0-9a-f]{64}$/.test(token)) { setState('done'); return; }
    void (supabase.rpc as unknown as Rpc)('email_unsubscribe', { _token: token })
      .then(({ error }) => setState(error ? 'failed' : 'done'), () => setState('failed'));
  }, [token]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <SEOHead title="Unsubscribe | B2BNEST" description="Unsubscribe from B2BNEST trial emails." noIndex />
      {state === 'working' && <p role="status" className="text-muted-foreground">One moment…</p>}
      {state === 'done' && (
        <section aria-labelledby="unsub-title">
          <h1 id="unsub-title" className="text-3xl font-bold text-brand-navy dark:text-foreground">{UNSUBSCRIBED_TITLE}</h1>
          <p className="mt-4 text-lg text-foreground">{UNSUBSCRIBED_TEXT}</p>
          <p className="mt-3 text-muted-foreground">
            Emails you need to use your account, such as password resets, still arrive. Changed your mind, or got this by mistake?{' '}
            <Link to="/contact" className="font-semibold text-brand-blue underline-offset-4 hover:underline">Contact us</Link>.
          </p>
        </section>
      )}
      {state === 'failed' && (
        <section aria-labelledby="unsub-failed">
          <h1 id="unsub-failed" className="text-3xl font-bold text-brand-navy dark:text-foreground">Not unsubscribed yet</h1>
          <p role="alert" className="mt-4 text-lg text-foreground">{UNSUBSCRIBE_FAILED}</p>
          <p className="mt-3"><Link to="/contact" className="font-semibold text-brand-blue underline-offset-4 hover:underline">Contact us</Link></p>
        </section>
      )}
    </main>
  );
}
