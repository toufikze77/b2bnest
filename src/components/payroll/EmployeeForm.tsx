import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

interface EmployeeFormProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onEmployeeUpdated: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  isOpen,
  onClose,
  employee,
  onEmployeeUpdated
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Employee>({
    id: '',
    firstName: '',
    lastName: '',
    niNumber: '',
    taxCode: '1257L',
    niCategory: 'A',
    annualSalary: 30000,
    payFrequency: 'MTH'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    } else {
      setFormData({
        id: '',
        firstName: '',
        lastName: '',
        niNumber: '',
        taxCode: '1257L',
        niCategory: 'A',
        annualSalary: 30000,
        payFrequency: 'MTH'
      });
    }
  }, [employee, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.firstName || !formData.lastName || !formData.annualSalary) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        user_id: user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        ni_number: formData.niNumber || null,
        tax_code: formData.taxCode,
        ni_category: formData.niCategory,
        annual_salary: formData.annualSalary,
        pay_frequency: formData.payFrequency
      };

      if (employee?.id) {
        // Update existing employee
        const { error } = await supabase
          .from('payroll_employees')
          .update(payload)
          .eq('id', employee.id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Employee updated successfully!');
      } else {
        // Create new employee
        const { error } = await supabase
          .from('payroll_employees')
          .insert([payload]);

        if (error) throw error;
        toast.success('Employee created successfully!');
      }

      onEmployeeUpdated();
      onClose();
    } catch (error) {
      console.error('Employee save error:', error);
      toast.error('Failed to save employee');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof Employee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {employee?.id ? 'Edit Employee' : 'Add New Employee'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="niNumber">National Insurance Number</Label>
              <Input
                id="niNumber"
                value={formData.niNumber}
                onChange={(e) => handleInputChange('niNumber', e.target.value)}
                placeholder="QQ123456A"
              />
            </div>

            <div>
              <Label htmlFor="taxCode">Tax Code *</Label>
              <Input
                id="taxCode"
                value={formData.taxCode}
                onChange={(e) => handleInputChange('taxCode', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="niCategory">NI Category *</Label>
              <Select 
                value={formData.niCategory} 
                onValueChange={(value) => handleInputChange('niCategory', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Standard</SelectItem>
                  <SelectItem value="B">B - Married women/widows</SelectItem>
                  <SelectItem value="C">C - Over state pension age</SelectItem>
                  <SelectItem value="H">H - Apprentice</SelectItem>
                  <SelectItem value="M">M - Under 21</SelectItem>
                  <SelectItem value="Z">Z - Deferred</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payFrequency">Pay Frequency *</Label>
              <Select 
                value={formData.payFrequency} 
                onValueChange={(value: 'MTH' | 'WK') => handleInputChange('payFrequency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MTH">Monthly</SelectItem>
                  <SelectItem value="WK">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="annualSalary">Annual Salary (£) *</Label>
              <Input
                id="annualSalary"
                type="number"
                min={1}
                value={formData.annualSalary}
                onChange={(e) => handleInputChange('annualSalary', Number(e.target.value))}
                required
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (employee?.id ? 'Update Employee' : 'Add Employee')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeForm;