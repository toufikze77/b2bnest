import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Flag, Users, Brain, X, Check } from 'lucide-react';

interface CreateTodoDialogProps {
  onCreateTodo: (todoData: any) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// SubtaskManager Component
const SubtaskManager = ({ subtasks, onSubtasksChange }: any) => {
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (newSubtask.trim()) {
      const subtask = {
        id: Date.now().toString(),
        title: newSubtask.trim(),
        completed: false,
        estimated_hours: 1
      };
      onSubtasksChange([...subtasks, subtask]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (id: string) => {
    onSubtasksChange(subtasks.filter((st: any) => st.id !== id));
  };

  const updateSubtask = (id: string, field: string, value: any) => {
    onSubtasksChange(subtasks.map((st: any) => 
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
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
        />
        <Button onClick={addSubtask} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {subtasks.map((subtask: any) => (
        <div key={subtask.id} className="flex items-center gap-2 p-2 border rounded">
          <Input
            value={subtask.title}
            onChange={(e) => updateSubtask(subtask.id, 'title', e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            value={subtask.estimated_hours}
            onChange={(e) => updateSubtask(subtask.id, 'estimated_hours', parseInt(e.target.value) || 0)}
            className="w-20"
            min="0"
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

// AITaskSuggestions Component
const AITaskSuggestions = ({ taskTitle, onApplySuggestion }: any) => {
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestions = () => {
    setLoading(true);
    // Simulate AI suggestions based on task title
    setTimeout(() => {
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
      setLoading(false);
    }, 1000);
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
                {suggestions.subtasks.map((st: any, idx: number) => (
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

// Main Component
export const CreateTodoDialog: React.FC<CreateTodoDialogProps> = ({ onCreateTodo, isOpen, onOpenChange }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    start_date: '',
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
      id: Date.now().toString(),
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      due_date: formData.due_date || undefined,
      start_date: formData.start_date || undefined,
      estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : undefined,
      labels: formData.labels.split(',').map(label => label.trim()).filter(Boolean),
      assigned_to: formData.assigned_to || undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      completed: false,
      created_at: new Date().toISOString()
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
      assigned_to: ''
    });
    setSubtasks([]);
    setShowAISuggestions(false);
    
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAISuggestionApply = (suggestion: any) => {
    if (suggestion.subtasks) {
      setSubtasks(suggestion.subtasks.map((st: any, idx: number) => ({
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
            </div>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange('due_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleChange('assigned_to', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Unassigned
                    </div>
                  </SelectItem>
                  {mockUsers.map((user) => (
                    <SelectItem key={user.id} value={user.email}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {user.name} ({user.email})
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
                placeholder="bug, feature, urgent..."
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
              <Button type="submit" className="flex-1" disabled={!formData.title.trim()}>
                Create Task
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </form>

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