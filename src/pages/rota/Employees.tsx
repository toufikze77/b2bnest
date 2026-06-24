import { useState } from 'react';
import RotaLayout from './RotaLayout';
import { useRota } from '@/hooks/useRota';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import EmployeeDialog from '@/components/rota/EmployeeDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RotaEmployee } from '@/hooks/useRota';

export default function Employees() {
  const { organizationId, employees, fetchEmployees, loading } = useRota();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RotaEmployee | null>(null);
  const { toast } = useToast();

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (e: RotaEmployee) => { setEditing(e); setDialogOpen(true); };

  const remove = async (e: RotaEmployee) => {
    if (!confirm(`Remove ${e.full_name}? Their shifts will also be deleted.`)) return;
    const { error } = await supabase.from('rota_employees').delete().eq('id', e.id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Employee removed' }); fetchEmployees(); }
  };

  return (
    <RotaLayout>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Team ({employees.length})</h2>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Add employee</Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : employees.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No employees yet. Add your first team member to start scheduling.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pay rate</TableHead>
                <TableHead>Contracted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: e.color || '#6366f1' }} />
                      <span className="font-medium">{e.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{e.job_title || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{e.email || '—'}</TableCell>
                  <TableCell>£{(e.pay_rate_pence / 100).toFixed(2)}/hr</TableCell>
                  <TableCell>{Number(e.contracted_hours)}h</TableCell>
                  <TableCell>
                    {e.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Archived</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {organizationId && (
        <EmployeeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          organizationId={organizationId}
          employee={editing}
          onSaved={fetchEmployees}
        />
      )}
    </RotaLayout>
  );
}
