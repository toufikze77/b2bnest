import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CalendarIcon, Loader2, X, Plus, DollarSign, Users, Target, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface EditProjectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onUpdateProject: (updatedProject: Project) => void;
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed';
  deadline?: Date;
  budget?: number;
  client?: string;
  members: string[];
  created_at: string;
  updated_at: string;
  user_id: string;
  progress?: number;
  stage?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  estimated_hours?: number;
  actual_hours?: number;
  custom_fields?: Record<string, any>;
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

const stageOptions = [
  { value: 'discovery', label: '🔍 Discovery', description: 'Initial research and planning' },
  { value: 'proposal', label: '📋 Proposal', description: 'Creating proposals and estimates' },
  { value: 'design', label: '🎨 Design', description: 'Design and prototyping phase' },
  { value: 'development', label: '⚡ Development', description: 'Active development work' },
  { value: 'testing', label: '🧪 Testing', description: 'Quality assurance and testing' },
  { value: 'review', label: '👀 Review', description: 'Client review and feedback' },
  { value: 'deployment', label: '🚀 Deployment', description: 'Going live and deployment' },
  { value: 'maintenance', label: '🔧 Maintenance', description: 'Ongoing support and maintenance' },
];

const EditProjectDialog = ({ isOpen, onOpenChange, project, onUpdateProject }: EditProjectDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState<Partial<Project>>({});
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        ...project,
        deadline: project.deadline ? new Date(project.deadline) : undefined,
        stage: project.stage || 'discovery',
        priority: project.priority || 'medium',
        progress: project.progress || 0,
        estimated_hours: project.estimated_hours || 0,
        actual_hours: project.actual_hours || 0,
        custom_fields: project.custom_fields || {}
      });
    }
  }, [project, isOpen]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !formData.name?.trim()) return;

    setLoading(true);
    try {
      const updateData = {
        ...formData,
        deadline: formData.deadline?.toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', project.id)
        .select()
        .single();

      if (error) throw error;

      onUpdateProject({
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        status: data.status as 'planning' | 'active' | 'on-hold' | 'completed',
      } as Project);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating project:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMember = () => {
    if (selectedUser && !formData.members?.includes(selectedUser)) {
      setFormData(prev => ({
        ...prev,
        members: [...(prev.members || []), selectedUser]
      }));
      setSelectedUser('');
    }
  };

  const removeMember = (memberIdToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members?.filter(memberId => memberId !== memberIdToRemove) || []
    }));
  };

  const addCustomField = () => {
    if (customFieldKey.trim() && customFieldValue.trim()) {
      setFormData(prev => ({
        ...prev,
        custom_fields: {
          ...prev.custom_fields,
          [customFieldKey.trim()]: customFieldValue.trim()
        }
      }));
      setCustomFieldKey('');
      setCustomFieldValue('');
    }
  };

  const removeCustomField = (key: string) => {
    setFormData(prev => {
      const newCustomFields = { ...prev.custom_fields };
      delete newCustomFields[key];
      return {
        ...prev,
        custom_fields: newCustomFields
      };
    });
  };

  const getUserDisplayName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.full_name || user?.email || 'Unknown User';
  };

  if (!project) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${formData.color || project.color}`}></div>
            Edit Project: {project.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={formData.client || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="Enter client name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Color</Label>
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
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="critical">🔴 Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Project Stage</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map(stage => (
                      <SelectItem key={stage.value} value={stage.value}>
                        <div className="flex flex-col">
                          <span>{stage.label}</span>
                          <span className="text-xs text-muted-foreground">{stage.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">📋 Planning</SelectItem>
                    <SelectItem value="active">⚡ Active</SelectItem>
                    <SelectItem value="on-hold">⏸️ On Hold</SelectItem>
                    <SelectItem value="completed">✅ Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Progress ({formData.progress || 0}%)</Label>
                <div className="space-y-2">
                  <Progress value={formData.progress || 0} className="h-2" />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress || 0}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      progress: parseInt(e.target.value) || 0 
                    }))}
                    placeholder="Progress percentage"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your project"
              rows={3}
            />
          </div>

          {/* Financial & Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Budget</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    budget: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  placeholder="0.00"
                  className="pl-10"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estimated Hours</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={formData.estimated_hours || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    estimated_hours: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder="0"
                  className="pl-10"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Actual Hours</Label>
              <div className="relative">
                <Target className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={formData.actual_hours || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    actual_hours: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder="0"
                  className="pl-10"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label>Deadline</Label>
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

          {/* Team Members */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members
            </Label>
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
                      disabled={formData.members?.includes(user.id)}
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
                disabled={!selectedUser || formData.members?.includes(selectedUser)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.members && formData.members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.members.map(memberId => (
                  <Badge
                    key={memberId}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {getUserDisplayName(memberId)}
                    <button
                      type="button"
                      onClick={() => removeMember(memberId)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          <div className="space-y-2">
            <Label>Custom Fields</Label>
            <div className="flex gap-2">
              <Input
                value={customFieldKey}
                onChange={(e) => setCustomFieldKey(e.target.value)}
                placeholder="Field name"
                className="flex-1"
              />
              <Input
                value={customFieldValue}
                onChange={(e) => setCustomFieldValue(e.target.value)}
                placeholder="Field value"
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addCustomField}
                disabled={!customFieldKey.trim() || !customFieldValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.custom_fields && Object.keys(formData.custom_fields).length > 0 && (
              <div className="space-y-2 mt-2">
                {Object.entries(formData.custom_fields).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between bg-muted p-2 rounded">
                    <div>
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomField(key)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
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
            <Button type="submit" disabled={loading || !formData.name?.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;