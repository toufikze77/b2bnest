import { useEffect, useMemo, useState } from 'react';
import RotaLayout from './RotaLayout';
import { useRota, RotaShift } from '@/hooks/useRota';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Copy, Send } from 'lucide-react';
import ShiftDialog from '@/components/rota/ShiftDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

function shiftHours(s: RotaShift) {
  const [sh, sm] = s.start_time.split(':').map(Number);
  const [eh, em] = s.end_time.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm) - (s.break_minutes || 0);
  return Math.max(0, mins / 60);
}

export default function Schedule() {
  const { organizationId, employees, shifts, fetchShifts, isRotaPremium } = useRota();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dialog, setDialog] = useState<{ employeeId: string; date: string; shift: RotaShift | null } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  useEffect(() => {
    if (organizationId) fetchShifts(fmt(weekStart), fmt(weekEnd));
  }, [organizationId, weekStart, fetchShifts]);

  const shiftsByCell: Record<string, RotaShift[]> = {};
  for (const s of shifts) {
    const k = `${s.employee_id}|${s.shift_date}`;
    (shiftsByCell[k] ||= []).push(s);
  }

  const totalHours = (empId: string) => shifts
    .filter(s => s.employee_id === empId)
    .reduce((sum, s) => sum + shiftHours(s), 0);

  const grandHours = shifts.reduce((s, x) => s + shiftHours(x), 0);
  const grandCost = shifts.reduce((s, x) => {
    const emp = employees.find(e => e.id === x.employee_id);
    return s + shiftHours(x) * ((emp?.pay_rate_pence || 0) / 100);
  }, 0);

  const copyPrevious = async () => {
    if (!organizationId) return;
    const prevStart = addDays(weekStart, -7);
    const prevEnd = addDays(weekStart, -1);
    const { data } = await supabase.from('rota_shifts').select('*')
      .eq('organization_id', organizationId)
      .gte('shift_date', fmt(prevStart)).lte('shift_date', fmt(prevEnd));
    if (!data || data.length === 0) {
      toast({ title: 'No shifts in previous week to copy' });
      return;
    }
    const rows = data.map(s => ({
      organization_id: organizationId,
      employee_id: s.employee_id,
      shift_date: fmt(addDays(new Date(s.shift_date), 7)),
      start_time: s.start_time,
      end_time: s.end_time,
      break_minutes: s.break_minutes,
      role: s.role,
      location: s.location,
      notes: s.notes,
      status: 'draft' as const,
      created_by: user?.id,
    }));
    const { error } = await supabase.from('rota_shifts').insert(rows);
    if (error) toast({ title: 'Copy failed', description: error.message, variant: 'destructive' });
    else { toast({ title: `Copied ${rows.length} shifts` }); fetchShifts(fmt(weekStart), fmt(weekEnd)); }
  };

  const publishWeek = async () => {
    if (!organizationId) return;
    if (!isRotaPremium) {
      toast({ title: 'Upgrade required', description: 'Publishing shifts is a Business Premium feature.', variant: 'destructive' });
      return;
    }
    const { error: e1 } = await supabase.from('rota_week_publications').upsert({
      organization_id: organizationId,
      week_start: fmt(weekStart),
      published_by: user?.id,
      published_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,week_start' });
    const { error: e2 } = await supabase.from('rota_shifts').update({ status: 'published' })
      .eq('organization_id', organizationId)
      .gte('shift_date', fmt(weekStart)).lte('shift_date', fmt(weekEnd));
    if (e1 || e2) toast({ title: 'Publish failed', description: (e1 || e2)?.message, variant: 'destructive' });
    else { toast({ title: 'Week published' }); fetchShifts(fmt(weekStart), fmt(weekEnd)); }
  };

  return (
    <RotaLayout>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <span className="font-semibold ml-2">
              {weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground mr-2">
              {grandHours.toFixed(1)}h · £{grandCost.toFixed(2)}
            </div>
            <Button variant="outline" size="sm" onClick={copyPrevious}><Copy className="h-4 w-4 mr-1" />Copy last week</Button>
            <Button size="sm" onClick={publishWeek}><Send className="h-4 w-4 mr-1" />Publish</Button>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Add employees first to start scheduling.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 w-48 sticky left-0 bg-background z-10">Employee</th>
                  {days.map(d => (
                    <th key={fmt(d)} className="p-2 text-left border-l min-w-[140px]">
                      <div className="font-semibold">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="text-xs text-muted-foreground">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    </th>
                  ))}
                  <th className="p-2 text-right w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {employees.filter(e => e.is_active).map(emp => (
                  <tr key={emp.id} className="border-t">
                    <td className="p-2 align-top sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: emp.color || '#6366f1' }} />
                        <div>
                          <div className="font-medium">{emp.full_name}</div>
                          <div className="text-xs text-muted-foreground">{emp.job_title || ''}</div>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const key = `${emp.id}|${fmt(d)}`;
                      const cellShifts = shiftsByCell[key] || [];
                      return (
                        <td key={key} className="p-1 align-top border-l min-h-[70px]">
                          <div className="space-y-1">
                            {cellShifts.map(s => (
                              <button
                                key={s.id}
                                onClick={() => setDialog({ employeeId: emp.id, date: fmt(d), shift: s })}
                                className="block w-full text-left rounded px-2 py-1 text-xs text-white hover:opacity-90"
                                style={{ background: emp.color || '#6366f1' }}
                              >
                                <div className="font-medium">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</div>
                                {s.role && <div className="opacity-90">{s.role}</div>}
                                {s.status === 'published' && <div className="opacity-80 text-[10px]">● Published</div>}
                              </button>
                            ))}
                            <button
                              onClick={() => setDialog({ employeeId: emp.id, date: fmt(d), shift: null })}
                              className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded py-1"
                            >
                              <Plus className="h-3 w-3 inline" /> Add
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    {(() => {
                      const total = totalHours(emp.id);
                      const contracted = Number(emp.contracted_hours) || 0;
                      const over = contracted > 0 && total > contracted;
                      return (
                        <td
                          className="p-2 text-right align-top"
                          title={contracted > 0 ? `Contracted: ${contracted}h` : 'No contracted hours set'}
                        >
                          <div className={`font-medium ${over ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                            {total.toFixed(1)}h
                          </div>
                          {contracted > 0 && (
                            over ? (
                              <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-300 dark:border-orange-500/40">
                                ⚠ +{(total - contracted).toFixed(1)}h over
                              </span>
                            ) : (
                              <div className="text-[10px] text-muted-foreground">of {contracted}h</div>
                            )
                          )}
                        </td>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {organizationId && dialog && (
        <ShiftDialog
          open={!!dialog}
          onOpenChange={(v) => !v && setDialog(null)}
          organizationId={organizationId}
          employeeId={dialog.employeeId}
          shiftDate={dialog.date}
          shift={dialog.shift}
          onSaved={() => fetchShifts(fmt(weekStart), fmt(weekEnd))}
        />
      )}
    </RotaLayout>
  );
}
