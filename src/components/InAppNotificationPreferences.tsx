import { useCallback, useEffect, useState } from 'react';
import { AlarmClock, AlertCircle, AlertTriangle, BellRing, CheckCircle2, FileText, Loader2, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { IN_APP_TYPES, IN_APP_TYPE_COPY, type InAppType } from '@/lib/notifications';
import { loadTypePrefs, saveTypePref, type TypePrefs } from '@/services/notificationTypePrefsService';

const ICONS: Record<InAppType, LucideIcon> = {
  invoice_overdue: AlertTriangle,
  invoice_paid: CheckCircle2,
  quote_update: FileText,
  note_reminder: AlarmClock,
};

/** In-app (bell) notifications per type. Renders nothing until the notification_type_prefs table exists. */
export function InAppNotificationPreferences() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { toast } = useToast();
  const [state, setState] = useState<'loading' | 'ok' | 'not-enabled' | 'error'>('loading');
  const [prefs, setPrefs] = useState<TypePrefs | null>(null);
  const [saving, setSaving] = useState<InAppType | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setState('loading');
    const res = await loadTypePrefs(userId);
    if (res.status === 'ok') setPrefs(res.prefs);
    setState(res.status);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (type: InAppType, value: boolean) => {
    if (!userId || !prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, [type]: value });
    setSaving(type);
    const ok = await saveTypePref(userId, type, value);
    setSaving(null);
    if (!ok) {
      setPrefs(before);
      toast({ title: 'Preference not saved', description: 'Please try again.', variant: 'destructive' });
    }
  };

  if (!userId || state === 'not-enabled') return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BellRing className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>In-app notifications</CardTitle>
            <CardDescription>Choose what appears under the bell in B2BNEST. These never send an email.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {state === 'loading' && (
          <div className="flex items-center justify-center py-6" aria-busy="true" aria-label="Loading in-app notification preferences">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {state === 'error' && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-destructive">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />Couldn't load your in-app preferences.</span>
            <Button variant="outline" size="sm" className="h-11" onClick={load}>Try again</Button>
          </div>
        )}
        {state === 'ok' && prefs && IN_APP_TYPES.map((type) => {
          const Icon = ICONS[type];
          const id = `in-app-${type}`;
          return (
            <div key={type} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <Label htmlFor={id} className="font-medium cursor-pointer">{IN_APP_TYPE_COPY[type].label}</Label>
                  <p className="text-sm text-muted-foreground">{IN_APP_TYPE_COPY[type].description}</p>
                </div>
              </div>
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center">
                <Switch id={id} checked={prefs[type]} disabled={saving !== null} onCheckedChange={(v) => toggle(type, v)} />
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default InAppNotificationPreferences;
