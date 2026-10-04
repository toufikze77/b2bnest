import { useState } from 'react';
import { Loader2, PlugZap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Probe { ok?: boolean; stage?: string; host?: string; port?: number; smtpCode?: number; reply?: string; exception?: string }
interface Result { success?: boolean; provider?: string; probe?: Probe; error?: string; code?: string; httpError?: string }

/** Super-admin only: signs in to the mail server and quits. Never sends an email. */
export function EmailConnectionCheck() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  if (loading || !isSuperAdmin) return null;

  const check = async () => {
    setBusy(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('workflow-send-email', { body: { probe: true } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const body = ctx?.json ? await ctx.json().catch(() => null) : null;
        setResult({ ...(body ?? {}), httpError: `${ctx?.status ?? ''} ${error.message}`.trim() });
      } else setResult(data as Result);
    } catch (e) {
      setResult({ httpError: e instanceof Error ? e.message : 'Request failed' });
    } finally { setBusy(false); }
  };

  const p = result?.probe;
  const rows: [string, string | number | undefined][] = p ? [
    ['Result', p.ok ? 'Signed in successfully' : 'Failed'], ['Provider', result?.provider], ['Server', p.host ? `${p.host}:${p.port}` : undefined],
    ['Stage', p.stage], ['SMTP code', p.smtpCode], ['Server reply', p.reply], ['Exception', p.exception],
  ] : [['Error', result?.error], ['Code', result?.code], ['HTTP', result?.httpError]];

  return (
    <Card className="mb-6 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><PlugZap className="h-4 w-4 text-primary" />Email connection (super admin)</CardTitle>
        <CardDescription>Signs in to the mail server and logs out. No email is sent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={check} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}Check email connection
        </Button>
        {result && (
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 rounded-md border border-border bg-muted/40 p-3 text-sm" role="status">
            {rows.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-words font-mono text-xs leading-5">{String(v)}</dd></div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
