import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    setIsDeleting(employeeId);
    
    try {
      const { error } = await supabase
        .from('payroll_employees')
        .delete()
        .eq('id', employeeId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('Employee deleted successfully!');
      onEmployeesUpdated();
    } catch (error) {
      console.error('Delete employee error:', error);
      toast.error('Failed to delete employee');
    } finally {
      setIsDeleting(null);
    }
  };

  const formatSalary = (salary: number, frequency: string) => {
    if (frequency === 'WK') {
      return `£${(salary / 52).toFixed(0)}/week (£${salary.toLocaleString()}/year)`;
    }
    return `£${(salary / 12).toFixed(0)}/month (£${salary.toLocaleString()}/year)`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees ({employees.length})
            </CardTitle>
            <Button onClick={handleAddEmployee}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No employees yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first employee to start managing payroll
              </p>
              <Button onClick={handleAddEmployee}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Employee
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>NI Number</TableHead>
                  <TableHead>Tax Code</TableHead>
                  <TableHead>NI Category</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {employee.payFrequency === 'MTH' ? 'Monthly' : 'Weekly'} pay
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {employee.niNumber || 'Not provided'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.taxCode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{employee.niCategory}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatSalary(employee.annualSalary, employee.payFrequency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditEmployee(employee)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteEmployee(employee.id)}
                          disabled={isDeleting === employee.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeForm
        isOpen={showEmployeeForm}
        onClose={() => setShowEmployeeForm(false)}
        employee={selectedEmployee}
        onEmployeeUpdated={onEmployeesUpdated}
      />
    </>
  );
};

export default EmployeeList;