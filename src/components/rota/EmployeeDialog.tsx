import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { RotaEmployee } from '@/hooks/useRota';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  employee?: RotaEmployee | null;
  onSaved: () => void;
}

export default function EmployeeDialog({ open, onOpenChange, organizationId, employee, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    job_title: '',
    color: '#6366f1',
    pay_rate_pence: 0,
    contracted_hours: 0,
    is_active: true,
  });

  useEffect(() => {
    if (employee) {
      setForm({
        full_name: employee.full_name,
        email: employee.email || '',
        job_title: employee.job_title || '',
        color: employee.color || '#6366f1',
        pay_rate_pence: employee.pay_rate_pence || 0,
        contracted_hours: Number(employee.contracted_hours) || 0,
        is_active: employee.is_active,
      });
    } else {
      setForm({ full_name: '', email: '', job_title: '', color: '#6366f1', pay_rate_pence: 0, contracted_hours: 0, is_active: true });
    }
  }, [employee, open]);

  const save = async () => {
    if (!form.full_name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (employee) {
        const { error } = await supabase
          .from('rota_employees')
          .update({
            full_name: form.full_name.trim(),
            email: form.email.trim() || null,
            job_title: form.job_title.trim() || null,
            color: form.color,
            pay_rate_pence: form.pay_rate_pence,
            contracted_hours: form.contracted_hours,
            is_active: form.is_active,
          })
          .eq('id', employee.id);
        if (error) throw error;
      } else {
        // Plan gate check server-side
        const { data: canAdd, error: gateErr } = await supabase
          .rpc('rota_can_add_employee', { p_org_id: organizationId });
        if (gateErr) throw gateErr;
        if (!canAdd) {
          toast({ title: 'Limit reached', description: 'Upgrade to Business Premium to add more employees.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const { error } = await supabase.from('rota_employees').insert({
          organization_id: organizationId,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          job_title: form.job_title.trim() || null,
          color: form.color,
          pay_rate_pence: form.pay_rate_pence,
          contracted_hours: form.contracted_hours,
          is_active: form.is_active,
          created_by: user?.id,
        });
        if (error) throw error;
      }
      toast({ title: employee ? 'Employee updated' : 'Employee added' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Full name *</Label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Job title</Label>
            <Input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pay rate (£/hr)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.pay_rate_pence / 100}
                onChange={e => setForm({ ...form, pay_rate_pence: Math.round(parseFloat(e.target.value || '0') * 100) })}
              />
            </div>
            <div>
              <Label>Contracted hrs/week</Label>
              <Input
                type="number"
                step="0.5"
                value={form.contracted_hours}
                onChange={e => setForm({ ...form, contracted_hours: parseFloat(e.target.value || '0') })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label>Color</Label>
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9 w-14 rounded border" />
            <div className="flex-1" />
            <Label>Active</Label>
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
