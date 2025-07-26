import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Flag, User, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  labels: string[];
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

interface TodoDetailsProps {
  todo: Todo;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
}

export const TodoDetails: React.FC<TodoDetailsProps> = ({ todo, onUpdate }) => {
  const [formData, setFormData] = useState({
    title: todo.title,
    description: todo.description || '',
    status: todo.status,
    priority: todo.priority,
    due_date: todo.due_date || '',
    start_date: todo.start_date || '',
    estimated_hours: todo.estimated_hours?.toString() || '',
    actual_hours: todo.actual_hours?.toString() || '',
    labels: todo.labels.join(', ')
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates = {
      ...formData,
      estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : undefined,
      actual_hours: formData.actual_hours ? parseInt(formData.actual_hours) : undefined,
      labels: formData.labels.split(',').map(label => label.trim()).filter(Boolean),
      due_date: formData.due_date || undefined,
      start_date: formData.start_date || undefined
    };

    onUpdate(todo.id, updates);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
          <Label htmlFor="labels">Labels (comma-separated)</Label>
          <Input
            id="labels"
            value={formData.labels}
            onChange={(e) => handleChange('labels', e.target.value)}
            placeholder="bug, feature, enhancement"
          />
        </div>

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
          <Label htmlFor="actual_hours">Actual Hours</Label>
          <Input
            id="actual_hours"
            type="number"
            min="0"
            value={formData.actual_hours}
            onChange={(e) => handleChange('actual_hours', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe the task in detail..."
          rows={4}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </form>
  );
};