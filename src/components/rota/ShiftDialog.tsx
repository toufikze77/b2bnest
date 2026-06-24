import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { RotaShift } from '@/hooks/useRota';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  employeeId: string;
  shiftDate: string;
  shift?: RotaShift | null;
  onSaved: () => void;
}

export default function ShiftDialog({ open, onOpenChange, organizationId, employeeId, shiftDate, shift, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 30,
    role: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    if (shift) {
      setForm({
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
        break_minutes: shift.break_minutes,
        role: shift.role || '',
        location: shift.location || '',
        notes: shift.notes || '',
      });
    } else {
      setForm({ start_time: '09:00', end_time: '17:00', break_minutes: 30, role: '', location: '', notes: '' });
    }
  }, [shift, open]);

  const save = async () => {
    setSaving(true);
    try {
      if (shift) {
        const { error } = await supabase.from('rota_shifts').update({
          start_time: form.start_time,
          end_time: form.end_time,
          break_minutes: form.break_minutes,
          role: form.role.trim() || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        }).eq('id', shift.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rota_shifts').insert({
          organization_id: organizationId,
          employee_id: employeeId,
          shift_date: shiftDate,
          start_time: form.start_time,
          end_time: form.end_time,
          break_minutes: form.break_minutes,
          role: form.role.trim() || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
          status: 'draft',
          created_by: user?.id,
        });
        if (error) throw error;
      }
      toast({ title: shift ? 'Shift updated' : 'Shift added' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!shift) return;
    if (!confirm('Delete this shift?')) return;
    const { error } = await supabase.from('rota_shifts').delete().eq('id', shift.id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Shift removed' }); onSaved(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shift ? 'Edit shift' : 'Add shift'} — {shiftDate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Break (minutes)</Label>
            <Input type="number" value={form.break_minutes} onChange={e => setForm({ ...form, break_minutes: parseInt(e.target.value || '0') })} />
          </div>
          <div>
            <Label>Role</Label>
            <Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Cashier" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {shift && <Button variant="destructive" onClick={remove}>Delete</Button>}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
