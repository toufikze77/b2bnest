import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Flag, CalendarIcon, Users, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import SubtaskManager from './SubtaskManager';
import AITaskSuggestions from './AITaskSuggestions';

interface CreateTodoDialogProps {
  onCreateTodo: (todoData: any) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateTodoDialog: React.FC<CreateTodoDialogProps> = ({ 
  onCreateTodo, 
  isOpen, 
  onOpenChange 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: null as Date | null,
    start_date: null as Date | null,
    estimated_hours: '',
    labels: '',
    assigned_to: ''
  });
  
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;

    const todoData = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : undefined,
      start_date: formData.start_date ? formData.start_date.toISOString().split('T')[0] : undefined,
      estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : undefined,
      labels: formData.labels.split(',').map(label => label.trim()).filter(Boolean),
      assigned_to: formData.assigned_to || undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined
    };

    onCreateTodo(todoData);
    
    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: null,
      start_date: null,
      estimated_hours: '',
      labels: '',
      assigned_to: ''
    });
    setSubtasks([]);
    setShowAISuggestions(false);
    
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string | Date | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAISuggestionApply = (suggestion: any) => {
    if (suggestion.subtasks) {
      setSubtasks(suggestion.subtasks.map((st: any, idx: number) => ({
        id: `ai-subtask-${idx}`,
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

  // Mock user list for assignment
  const mockUsers = [
    { id: 'user1', name: 'John Doe', email: 'john@example.com' },
    { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'user3', name: 'Mike Johnson', email: 'mike@example.com' },
    { id: 'user4', name: 'Sarah Wilson', email: 'sarah@example.com' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Create New Task
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAISuggestions(!showAISuggestions)}
            >
              <Brain className="h-4 w-4 mr-2" />
              {showAISuggestions ? 'Hide' : 'Show'} AI Suggestions
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? format(formData.start_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => handleChange('start_date', date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => handleChange('due_date', date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleChange('assigned_to', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee">
                    {formData.assigned_to ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {mockUsers.find(u => u.id === formData.assigned_to)?.name}
                      </div>
                    ) : (
                      <span>Select assignee</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mockUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labels">Labels (comma-separated)</Label>
              <Input
                id="labels"
                value={formData.labels}
                onChange={(e) => handleChange('labels', e.target.value)}
                placeholder="bug, feature, enhancement"
              />
            </div>
          </div>

          {/* Subtasks Manager */}
          <SubtaskManager 
            subtasks={subtasks}
            onSubtasksChange={setSubtasks}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.title.trim()}>
              Create Task
            </Button>
          </div>
        </form>

        {/* AI Suggestions Panel */}
        {showAISuggestions && (
          <div className="space-y-4">
            <AITaskSuggestions
              taskTitle={formData.title}
              taskDescription={formData.description}
              onSuggestionApply={handleAISuggestionApply}
            />
          </div>
        )}
      </div>
      </DialogContent>
    </Dialog>
  );
};