import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (projectData: ProjectFormData) => Promise<void>;
}

export interface ProjectFormData {
  name: string;
  description: string;
  color: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed';
  deadline?: Date;
  budget?: number;
  client?: string;
  members: string[];
}

interface User {
  id: string;
  display_name: string | null;
  email: string;
  full_name: string | null;
}

const colorOptions = [
  { value: 'bg-blue-500', label: 'Blue', color: 'bg-blue-500' },
  { value: 'bg-green-500', label: 'Green', color: 'bg-green-500' },
  { value: 'bg-purple-500', label: 'Purple', color: 'bg-purple-500' },
  { value: 'bg-red-500', label: 'Red', color: 'bg-red-500' },
  { value: 'bg-yellow-500', label: 'Yellow', color: 'bg-yellow-500' },
  { value: 'bg-indigo-500', label: 'Indigo', color: 'bg-indigo-500' },
  { value: 'bg-pink-500', label: 'Pink', color: 'bg-pink-500' },
  { value: 'bg-orange-500', label: 'Orange', color: 'bg-orange-500' },
];

const CreateProjectDialog = ({ isOpen, onOpenChange, onCreateProject }: CreateProjectDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    color: 'bg-blue-500',
    status: 'planning',
    members: []
  });
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isOpen) return;
      
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, email, full_name')
          .order('full_name');
        
        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: 'bg-blue-500',
      status: 'planning',
      members: []
    });
    setSelectedUser('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      await onCreateProject(formData);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMember = () => {
    if (selectedUser && !formData.members.includes(selectedUser)) {
      const user = users.find(u => u.id === selectedUser);
      if (user) {
        setFormData(prev => ({
          ...prev,
          members: [...prev.members, selectedUser]
        }));
        setSelectedUser('');
      }
    }
  };

  const removeMember = (memberIdToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(memberId => memberId !== memberIdToRemove)
    }));
  };

  const getUserDisplayName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.full_name || user?.email || 'Unknown User';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter project name"
              required
            />
          </div>

          {/* Project Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your project"
              rows={3}
            />
          </div>

          {/* Project Color and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Color</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${formData.color}`}></div>
                      {colorOptions.find(option => option.value === formData.color)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${option.color}`}></div>
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Initial Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline and Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deadline (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deadline ? format(formData.deadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.deadline}
                    onSelect={(date) => setFormData(prev => ({ ...prev, deadline: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Budget (Optional)</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  budget: e.target.value ? parseFloat(e.target.value) : undefined 
                }))}
                placeholder="Enter budget amount"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label htmlFor="client">Client (Optional)</Label>
            <Input
              id="client"
              value={formData.client || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
              placeholder="Enter client name"
            />
          </div>

          {/* Team Members */}
          <div className="space-y-2">
            <Label>Team Members (Optional)</Label>
            <div className="flex gap-2">
              <Select
                value={selectedUser}
                onValueChange={setSelectedUser}
                disabled={loadingUsers}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a team member"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem 
                      key={user.id} 
                      value={user.id}
                      disabled={formData.members.includes(user.id)}
                    >
                      <div className="flex flex-col">
                        <span>{user.display_name || user.full_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                variant="outline" 
                onClick={addMember}
                disabled={!selectedUser || formData.members.includes(selectedUser)}
              >
                Add
              </Button>
            </div>
            {formData.members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.members.map(memberId => (
                  <div
                    key={memberId}
                    className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm"
                  >
                    {getUserDisplayName(memberId)}
                    <button
                      type="button"
                      onClick={() => removeMember(memberId)}
                      className="ml-1 text-primary hover:text-primary/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;