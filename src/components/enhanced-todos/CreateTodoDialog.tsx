import React, { useState, useEffect } from 'react';
import { Plus, Flag, Calendar as CalendarIcon, Users, Brain, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Fixed DatePicker Component
const DatePicker = ({ value, onChange, placeholder, id }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value), "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background border shadow-md z-[100]" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};

// Fixed SubtaskManager Component
const SubtaskManager = ({ subtasks, onSubtasksChange }) => {
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (newSubtask.trim()) {
      const subtask = {
        id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: newSubtask.trim(),
        completed: false,
        estimated_hours: 1
      };
      onSubtasksChange([...subtasks, subtask]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (id) => {
    onSubtasksChange(subtasks.filter(st => st.id !== id));
  };

  const updateSubtask = (id, field, value) => {
    onSubtasksChange(subtasks.map(st =>
      st.id === id ? { ...st, [field]: value } : st
    ));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          placeholder="Add a subtask..."
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
        />
        <Button onClick={addSubtask} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
     
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="flex items-center gap-2 p-2 border rounded">
          <Input
            value={subtask.title}
            onChange={(e) => updateSubtask(subtask.id, 'title', e.target.value)}
            className="flex-1"
            placeholder="Subtask title"
          />
          <Input
            type="number"
            value={subtask.estimated_hours}
            onChange={(e) => updateSubtask(subtask.id, 'estimated_hours', parseInt(e.target.value) || 0)}
            className="w-20"
            min="0"
            placeholder="Hours"
          />
          <Button
            onClick={() => removeSubtask(subtask.id)}
            variant="destructive"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

// Fixed AITaskSuggestions Component
const AITaskSuggestions = ({ taskTitle, onApplySuggestion }) => {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = async () => {
    if (!taskTitle.trim()) {
      alert('Please enter a task title first');
      return;
    }
    
    setLoading(true);
    try {
      // Simulate AI suggestions based on task title
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockSuggestions = {
        subtasks: [
          { title: `Research for: ${taskTitle}`, estimated_hours: 2 },
          { title: `Plan implementation of: ${taskTitle}`, estimated_hours: 1 },
          { title: `Execute: ${taskTitle}`, estimated_hours: 4 },
          { title: `Review and test: ${taskTitle}`, estimated_hours: 1 }
        ],
        estimated_hours: 8,
        priority: taskTitle.toLowerCase().includes('urgent') || taskTitle.toLowerCase().includes('important') ? 'high' : 'medium',
        assignee: 'john@example.com'
      };
      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
      alert('Failed to generate suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={generateSuggestions} disabled={loading || !taskTitle.trim()}>
        <Brain className="h-4 w-4 mr-2" />
        {loading ? 'Generating...' : 'Generate AI Suggestions'}
      </Button>

      {suggestions && (
        <div className="p-4 border rounded-lg bg-blue-50">
          <h4 className="font-medium mb-3">AI Suggestions:</h4>
         
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Estimated Hours: {suggestions.estimated_hours}</p>
              <p className="text-sm font-medium">Suggested Priority: {suggestions.priority}</p>
              <p className="text-sm font-medium">Suggested Assignee: {suggestions.assignee}</p>
            </div>
           
            <div>
              <p className="text-sm font-medium mb-2">Suggested Subtasks:</p>
              <ul className="text-sm space-y-1">
                {suggestions.subtasks.map((st, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{st.title}</span>
                    <span className="text-gray-500">{st.estimated_hours}h</span>
                  </li>
                ))}
              </ul>
            </div>
           
            <Button onClick={() => onApplySuggestion(suggestions)} size="sm">
              <Check className="h-4 w-4 mr-2" />
              Apply Suggestions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// AI-powered project management template
const projectManagementTemplate = {
  title: "AI-powered project management",
  description: "Comprehensive project management with task automation, team collaboration, and intelligent insights",
  features: [
    "Task automation and intelligent scheduling",
    "Team collaboration and communication tools", 
    "Real-time progress tracking and reporting",
    "Resource allocation and capacity planning",
    "AI-driven project insights and recommendations"
  ]
};

// Main Component - exported as default export
const CreateTodoDialog = ({ onCreateTodo, isOpen, onOpenChange, editTask = null, teamId = 'all', teamMembers = [] }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    start_date: '',
    estimated_hours: '',
    labels: '',
    assigned_to: '',
    phone: ''
  });
 
  const [subtasks, setSubtasks] = useState([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Populate form when editing existing task
  useEffect(() => {
    if (editTask) {
      setFormData({
        title: editTask.title || '',
        description: editTask.description || '',
        priority: editTask.priority || 'medium',
        due_date: editTask.due_date || '',
        start_date: editTask.start_date || '',
        estimated_hours: editTask.estimated_hours ? String(editTask.estimated_hours) : '',
        labels: editTask.labels ? editTask.labels.join(', ') : '',
        assigned_to: editTask.assigned_to || '',
        phone: editTask.phone || ''
      });
      setSubtasks(editTask.subtasks || []);
    } else {
      // Reset form for new task
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        start_date: '',
        estimated_hours: '',
        labels: '',
        assigned_to: '',
        phone: ''
      });
      setSubtasks([]);
    }
  }, [editTask]);

  // Fetch available users from Supabase, scoped by organization for multitenant security
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        // Get current user's organization first
        const { data: currentUserOrgs, error: orgError } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user?.id)
          .eq('is_active', true);

        if (orgError) {
          console.error('Error fetching user organizations:', orgError);
          setAvailableUsers([]);
          return;
        }

        // If user has no organizations, only show themselves
        if (!currentUserOrgs || currentUserOrgs.length === 0) {
          setAvailableUsers([
            {
              id: user?.id || 'current-user',
              display_name: user?.email?.split('@')[0] || 'Current User',
              email: user?.email || 'user@example.com',
              full_name: user?.email?.split('@')[0] || 'Current User'
            }
          ]);
          return;
        }

        // Get organization IDs the current user belongs to
        const organizationIds = currentUserOrgs.map(org => org.organization_id);

        // Get all user IDs from the same organization(s) - strict security segregation
        const { data: orgMembers, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id')
          .in('organization_id', organizationIds)
          .eq('is_active', true);

        if (membersError) {
          console.error('Error fetching organization members:', membersError);
          setAvailableUsers([{
            id: user?.id || 'current-user',
            display_name: user?.email?.split('@')[0] || 'Current User',
            email: user?.email || 'user@example.com',
            full_name: user?.email?.split('@')[0] || 'Current User'
          }]);
          setLoadingUsers(false);
          return;
        }

        const userIds = orgMembers?.map(member => member.user_id) || [];
        
        // Now fetch profile data for these users without direct table access
        const { batchGetUserDisplayInfo } = await import('@/utils/profileUtils');
        const profilesData = await batchGetUserDisplayInfo(userIds as string[]);

        // Map profiles to user format (email may be hidden by RLS)
        let users = (profilesData || []).map((profile: any) => ({
          id: profile.id,
          display_name: profile.display_name || 'Unknown User',
          email: null,
          full_name: profile.display_name || 'Unknown User'
        }));
        
        if (users.length === 0) {
          console.error('No users found');
          users = [{
            id: user?.id || 'current-user',
            display_name: user?.email?.split('@')[0] || 'Current User',
            email: user?.email || 'user@example.com',
            full_name: user?.email?.split('@')[0] || 'Current User'
          }];
        }
        
        // Always ensure current user is in the list
        const currentUserExists = users.some(u => u.id === user?.id);
        if (!currentUserExists && user?.id) {
          users.unshift({
            id: user.id,
            display_name: user?.email?.split('@')[0] || 'Current User',
            email: user?.email || 'user@example.com',
            full_name: user?.email?.split('@')[0] || 'Current User'
          });
        }

        setAvailableUsers(users);
      } catch (error) {
        console.error('Error fetching organization users:', error);
        // Security fallback - only show current user
        setAvailableUsers([
          {
            id: user?.id || 'current-user',
            display_name: user?.email?.split('@')[0] || 'Current User',
            email: user?.email || 'user@example.com',
            full_name: user?.email?.split('@')[0] || 'Current User'
          }
        ]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, teamId, Array.isArray(teamMembers) ? teamMembers.join('|') : '']);

  const handleSubmit = (e) => {
    e.preventDefault();
   
    if (!formData.title.trim()) return;

    const todoData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      due_date: formData.due_date || undefined,
      start_date: formData.start_date || undefined,
      estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : undefined,
      labels: formData.labels.split(',').map(label => label.trim()).filter(Boolean),
      assigned_to: formData.assigned_to === 'unassigned' ? undefined : formData.assigned_to
    };

    onCreateTodo(todoData);
   
    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      start_date: '',
      estimated_hours: '',
      labels: '',
      assigned_to: '',
      phone: ''
    });
    setSubtasks([]);
    setShowAISuggestions(false);
   
    onOpenChange(false);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAISuggestionApply = (suggestion) => {
    if (suggestion.subtasks) {
      setSubtasks(suggestion.subtasks.map((st, idx) => ({
        id: `ai-subtask-${idx}-${Date.now()}`,
        title: st.title,
        completed: false,
        estimated_hours: st.estimated_hours
      })));
    }
    if (suggestion.estimated_hours) {
      setFormData(prev => ({ ...prev, estimated_hours: suggestion.estimated_hours.toString() }));
    }
    if (suggestion.assignee) {
      setFormData(prev => ({ ...prev, assigned_to: suggestion.assignee }));
    }
    if (suggestion.priority) {
      setFormData(prev => ({ ...prev, priority: suggestion.priority }));
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {editTask ? 'Edit Task' : 'Create New Task'}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAISuggestions(!showAISuggestions)}
              >
                <Brain className="h-4 w-4 mr-2" />
                {showAISuggestions ? 'Hide' : 'Show'} AI Suggestions
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
       
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter task title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the task..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-md z-[200]">
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-green-600" />
                        Low
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-yellow-600" />
                        Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-red-600" />
                        High
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Estimated Hours</Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  min="0"
                  value={formData.estimated_hours}
                  onChange={(e) => handleChange('estimated_hours', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-start-date">Start Date</Label>
                <DatePicker
                  id="task-start-date"
                  value={formData.start_date}
                  onChange={(date) => handleChange('start_date', date)}
                  placeholder="Pick start date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <DatePicker
                  id="task-due-date"
                  value={formData.due_date}
                  onChange={(date) => handleChange('due_date', date)}
                  placeholder="Pick due date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleChange('assigned_to', value)}>
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-[200]">
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Unassigned
                    </div>
                  </SelectItem>
                  {loadingUsers ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Loading users...
                      </div>
                    </SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {user.display_name || user.full_name || user.email} ({user.email})
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labels">Labels (comma-separated)</Label>
              <Input
                id="labels"
                value={formData.labels}
                onChange={(e) => handleChange('labels', e.target.value)}
                placeholder="bug, feature, urgent..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Contact Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Enter contact phone number..."
              />
            </div>

            <div className="space-y-2">
              <Label>Subtasks</Label>
              <SubtaskManager
                subtasks={subtasks}
                onSubtasksChange={setSubtasks}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={(e) => handleSubmit(e)} className="flex-1">
                {editTask ? 'Update Task' : 'Create Task'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </div>

          {showAISuggestions && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">AI Task Assistant</h3>
              <AITaskSuggestions
                taskTitle={formData.title}
                onApplySuggestion={handleAISuggestionApply}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Export CreateTodoDialog as default
export default CreateTodoDialog;

// Demo wrapper component for testing
export function CreateTodoDemo() {
  const [isOpen, setIsOpen] = useState(false);
  const [todos, setTodos] = useState([]);

  const handleCreateTodo = (todoData) => {
    setTodos(prev => [...prev, todoData]);
    console.log('Created todo:', todoData);
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Project Management Hub</h1>
     
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Create Task
      </Button>

      <CreateTodoDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onCreateTodo={handleCreateTodo}
      />

      {todos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Created Tasks:</h2>
          <div className="space-y-2">
            {todos.map((todo) => (
              <div key={todo.id} className="p-4 border rounded-lg bg-white shadow-sm">
                <h3 className="font-medium">{todo.title}</h3>
                {todo.description && <p className="text-gray-600 text-sm mt-1">{todo.description}</p>}
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Priority: {todo.priority}
                  </span>
                  {todo.due_date && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Due: {todo.due_date}
                    </span>
                  )}
                  {todo.subtasks && todo.subtasks.length > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      {todo.subtasks.length} subtasks
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
