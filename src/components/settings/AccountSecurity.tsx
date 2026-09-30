import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, LogOut, ShieldCheck, ShieldAlert, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T };

interface AuditRow { id: string; action: string; resource_type: string | null; created_at: string }

/**
 * Personal security for the signed-in user only. Every value shown here is
 * read from the user's own records; nothing is estimated or hardcoded.
 */
const AccountSecurity = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mfa, setMfa] = useState<Load<boolean>>({ state: 'loading' });
  const [activity, setActivity] = useState<Load<AuditRow[]>>({ state: 'loading' });
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setMfa({ state: 'loading' });
    setActivity({ state: 'loading' });
    const [m, a] = await Promise.all([
      supabase.from('user_2fa_settings').select('is_enabled').eq('user_id', user.id).maybeSingle(),
      supabase.from('audit_logs').select('id, action, resource_type, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setMfa(m.error ? { state: 'error', message: m.error.message } : { state: 'ready', data: !!m.data?.is_enabled });
    setActivity(a.error ? { state: 'error', message: a.error.message } : { state: 'ready', data: (a.data ?? []) as AuditRow[] });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const signOutOthers = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setSigningOut(false);
    if (error) return toast({ title: 'Could not sign out other devices', description: error.message, variant: 'destructive' });
    toast({ title: 'Signed out of other devices', description: 'This device stays signed in.' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Two-step sign-in</CardTitle>
          <CardDescription>An emailed code is required when you sign in, in addition to your password.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {mfa.state === 'loading' && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking…</span>}
          {mfa.state === 'error' && <span role="alert" className="text-sm text-destructive">Could not load your two-step status: {mfa.message}</span>}
          {mfa.state === 'ready' && (
            mfa.data
              ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />On for your account</Badge>
              : <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3.5 w-3.5" />Off for your account</Badge>
          )}
          <Button asChild variant="outline" size="sm"><Link to="/settings">Change in Account</Link></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
          <CardDescription>
            Sign out everywhere else, for example after using a shared computer. We can't list individual devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOutOthers} disabled={signingOut} className="gap-2">
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out other devices
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your recent activity</CardTitle>
          <CardDescription>The last 20 recorded actions on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.state === 'loading' && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>}
          {activity.state === 'error' && (
            <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
              Could not load activity: {activity.message}
              <Button size="sm" variant="outline" onClick={load}>Retry</Button>
            </div>
          )}
          {activity.state === 'ready' && (activity.data.length === 0
            ? <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
            : (
              <ul className="divide-y divide-border">
                {activity.data.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{r.action.replace(/_/g, ' ')}</span>
                      {r.resource_type && <span className="text-muted-foreground">· {r.resource_type}</span>}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSecurity;
