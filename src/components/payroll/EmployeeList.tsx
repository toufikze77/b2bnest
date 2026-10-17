import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog, DeleteOutcome } from '@/components/finance/ConfirmDeleteDialog';
import { isInUseError } from '@/lib/moneyOut';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EmployeeForm from './EmployeeForm';

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  niNumber?: string;
  taxCode: string;
  niCategory: 'A' | 'B' | 'C' | 'H' | 'M' | 'Z' | string;
  annualSalary: number;
  payFrequency: 'MTH' | 'WK';
};

interface EmployeeListProps {
  employees: Employee[];
  onEmployeesUpdated: () => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEmployeesUpdated
}) => {
  const { user } = useAuth();
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeForm(true);
  };

  // Same delete as before (owner-filtered); the confirmation is now a dialog instead of window.confirm.
  const handleDeleteEmployee = async (): Promise<DeleteOutcome> => {
    if (!user || !deleting) return null;
    const name = `${deleting.firstName} ${deleting.lastName}`;
    try {
      const { error } = await supabase
        .from('payroll_employees')
        .delete()
        .eq('id', deleting.id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success(`Employee ${name} deleted`);
      setDeleting(null);
      onEmployeesUpdated();
      return null;
    } catch (error) {
      console.error('Delete employee error:', error);
      toast.error('Failed to delete employee');
      return isInUseError(error as { code?: string; message?: string })
        ? { message: `${name} can’t be deleted because saved pay runs still include them. Nothing was changed.` }
        : { message: `${name} couldn’t be deleted. Nothing was changed. Please try again.` };
    }
  };

  const formatSalary = (salary: number, frequency: string) => {
    if (frequency === 'WK') {
      return `£${(salary / 52).toFixed(0)}/week (£${salary.toLocaleString()}/year)`;
    }
    return `£${(salary / 12).toFixed(0)}/month (£${salary.toLocaleString()}/year)`;
  };

  const name = (e: Employee) => `${e.firstName} ${e.lastName}`;
  const actions = (e: Employee) => (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" variant="outline" className="min-h-touch md:min-h-9" onClick={() => handleEditEmployee(e)} aria-label={`Edit ${name(e)}`}>
        <Edit className="h-4 w-4" aria-hidden="true" /><span className="hidden lg:inline">Edit</span>
      </Button>
      <Button size="sm" variant="outline" className="min-h-touch md:min-h-9" onClick={() => setDeleting(e)} aria-label={`Delete ${name(e)}`}>
        {/* Red icon only: the red token is 3.4:1 as text on white, below the 4.5:1 text minimum. */}
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" /><span className="hidden lg:inline">Delete</span>
      </Button>
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-card-title">
            <Users className="h-5 w-5" aria-hidden="true" />
            Employees ({employees.length})
          </h3>
          <Button onClick={handleAddEmployee} className="min-h-touch md:min-h-0">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add employee
          </Button>
        </div>
        {employees.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-control border border-dashed p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-body font-semibold">No employees yet</p>
            <p className="text-body text-muted-foreground">Add your first employee to start managing payroll.</p>
            <Button onClick={handleAddEmployee} className="min-h-touch md:min-h-0">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add employee
            </Button>
          </div>
        ) : (
          <>
            {/* Phones: cards, so Edit and Delete are always on screen (the old wide table hid them off to the right). */}
            <ul aria-label="Employees" className="divide-y divide-border rounded-control border border-border md:hidden">
              {employees.map((e) => (
                <li key={e.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name(e)}</p>
                    <p className="text-small text-muted-foreground">Tax code {e.taxCode} · NI category {e.niCategory} · {e.payFrequency === 'MTH' ? 'Monthly' : 'Weekly'} pay</p>
                    <p className="text-small text-muted-foreground">{formatSalary(e.annualSalary, e.payFrequency)}</p>
                  </div>
                  {actions(e)}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-control border border-border md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Employees</caption>
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-medium">Employee</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">NI number</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Tax code</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">NI category</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Salary</th>
                    <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{name(employee)}</div>
                        <div className="text-small text-muted-foreground">{employee.payFrequency === 'MTH' ? 'Monthly' : 'Weekly'} pay</div>
                      </td>
                      <td className="px-3 py-2.5"><code className="rounded bg-muted px-2 py-1 text-xs">{employee.niNumber || 'Not provided'}</code></td>
                      <td className="px-3 py-2.5">{employee.taxCode}</td>
                      <td className="px-3 py-2.5">{employee.niCategory}</td>
                      <td className="px-3 py-2.5">{formatSalary(employee.annualSalary, employee.payFrequency)}</td>
                      <td className="px-3 py-2.5 text-right">{actions(employee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <EmployeeForm
        isOpen={showEmployeeForm}
        onClose={() => setShowEmployeeForm(false)}
        employee={selectedEmployee}
        onEmployeeUpdated={onEmployeesUpdated}
      />
      <ConfirmDeleteDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}
        noun="employee" name={deleting ? name(deleting) : ''} onConfirm={handleDeleteEmployee} />
    </>
  );
};

export default EmployeeList;
