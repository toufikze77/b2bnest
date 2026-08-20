import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { supabase } from '@/integrations/supabase/client';
import { logAdminAction } from '@/lib/adminApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const TOGGLES: { key: string; label: string; description: string }[] = [
  { key: 'maintenance_mode', label: 'Maintenance mode', description: 'Show a maintenance notice to non-admin users.' },
  { key: 'signups_enabled', label: 'Allow new signups', description: 'Turn off to temporarily close registration.' },
  { key: 'ai_enabled', label: 'AI features enabled', description: 'Platform-wide kill switch for AI tools.' },
  { key: 'community_enabled', label: 'Community enabled', description: 'Enable social posts and the forum.' },
];

const TEXTS: { key: string; label: string; placeholder: string }[] = [
  { key: 'support_email', label: 'Support email', placeholder: 'notifications@b2bnest.online' },
  { key: 'announcement', label: 'Platform announcement', placeholder: 'Shown as a banner to all users' },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from('platform_settings').select('key, value');
    if (error) toast({ title: 'Failed to load settings', description: error.message, variant: 'destructive' });
    const map: Record<string, any> = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
    setValues(map);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string, value: any) => {
    setSaving(true);
    setValues((v) => ({ ...v, [key]: value }));
    const { error } = await (supabase as any)
      .from('platform_settings')
      .upsert({ key, value, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    await logAdminAction('settings.update', 'platform_settings', key, { value });
    toast({ title: 'Setting saved' });
  };

  return (
    <>
      <AdminPageHeader title="Settings" description="Platform-wide configuration. Changes apply to every tenant." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature switches</CardTitle>
            <CardDescription>Enable or disable platform capabilities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">{t.label}</Label>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Switch
                  disabled={loading || saving}
                  checked={values[t.key] === true}
                  onCheckedChange={(v) => save(t.key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform details</CardTitle>
            <CardDescription>Press Save after editing a field.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TEXTS.map((t) => (
              <div key={t.key} className="space-y-2">
                <Label htmlFor={t.key}>{t.label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={t.key}
                    placeholder={t.placeholder}
                    value={typeof values[t.key] === 'string' ? values[t.key] : (values[t.key] ?? '')}
                    onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))}
                  />
                  <Button variant="outline" disabled={saving} onClick={() => save(t.key, values[t.key] ?? '')}>Save</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
