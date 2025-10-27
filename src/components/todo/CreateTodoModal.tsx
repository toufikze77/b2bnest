import React, { useState } from 'react';
import { 
  Calendar, User, Tag, Clock, AlertCircle, 
  Slack, Github, Figma, MessageSquare, Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface CreateTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTodo?: (todo: any) => void;
}

export const CreateTodoModal: React.FC<CreateTodoModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateTodo 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    assignedTo: '',
    project: '',
    tags: [] as string[],
    estimatedTime: '',
    source: 'manual',
    integrationData: {
      slackChannel: '',
      figmaFile: '',
      githubRepo: '',
      onedriveFile: ''
    },
    notifications: true,
    recurring: false,
    recurringType: 'none'
  });

  const [currentTag, setCurrentTag] = useState('');
  const { toast } = useToast();

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ];

  const sources = [
    { value: 'manual', label: 'Manual', icon: <Plus className="h-4 w-4" /> },
    { value: 'slack', label: 'Slack', icon: <Slack className="h-4 w-4 text-purple-600" /> },
    { value: 'figma', label: 'Figma', icon: <Figma className="h-4 w-4 text-purple-500" /> },
    { value: 'github', label: 'GitHub', icon: <Github className="h-4 w-4 text-gray-800" /> },
    { value: 'chatgpt', label: 'ChatGPT', icon: <MessageSquare className="h-4 w-4 text-green-600" /> },
    { value: 'onedrive', label: 'OneDrive', icon: <div className="h-4 w-4 bg-blue-600 rounded text-white text-xs flex items-center justify-center">O</div> }
  ];

  const projects = [
    'Website Redesign',
    'Mobile App',
    'Marketing Campaign',
    'Product Launch',
    'Team Training',
    'Documentation',
    'Research'
  ];

  const teamMembers = [
    { id: '1', name: 'John Doe', avatar: '' },
    { id: '2', name: 'Jane Smith', avatar: '' },
    { id: '3', name: 'Mike Johnson', avatar: '' },
    { id: '4', name: 'Sarah Wilson', avatar: '' }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIntegrationDataChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      integrationData: {
        ...prev.integrationData,
        [field]: value
      }
    }));
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a task title",
        variant: "destructive"
      });
      return;
    }

    const newTodo = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      completed: false,
      priority: formData.priority,
      dueDate: formData.dueDate || undefined,
      assignedTo: formData.assignedTo ? teamMembers.find(m => m.id === formData.assignedTo) : undefined,
      tags: formData.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: formData.source,
      integrationData: formData.source !== 'manual' ? formData.integrationData : undefined,
      project: formData.project || undefined,
      estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : undefined
    };

    if (onCreateTodo) {
      onCreateTodo(newTodo);
    }

    toast({
      title: "Task created!",
      description: `"${formData.title}" has been added to your tasks`,
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      assignedTo: '',
      project: '',
      tags: [],
      estimatedTime: '',
      source: 'manual',
      integrationData: {
        slackChannel: '',
        figmaFile: '',
        githubRepo: '',
        onedriveFile: ''
      },
      notifications: true,
      recurring: false,
      recurringType: 'none'
    });

    onClose();
  };

  const selectedSource = sources.find(s => s.value === formData.source);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Create New Task</span>
          </DialogTitle>
          <DialogDescription>
            Add a new task to your todo list with advanced features and integrations
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details about this task..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          {/* Priority and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${priority.color}`} />
                        <span>{priority.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Source</Label>
              <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(source => (
                    <SelectItem key={source.value} value={source.value}>
                      <div className="flex items-center space-x-2">
                        {source.icon}
                        <span>{source.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date and Estimated Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="estimatedTime">Estimated Time (minutes)</Label>
              <Input
                id="estimatedTime"
                type="number"
                placeholder="e.g. 60"
                value={formData.estimatedTime}
                onChange={(e) => handleInputChange('estimatedTime', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Assignment and Project */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assign To</Label>
              <Select value={formData.assignedTo} onValueChange={(value) => handleInputChange('assignedTo', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>{member.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Project</Label>
              <Select value={formData.project} onValueChange={(value) => handleInputChange('project', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="mt-1 space-y-2">
              <div className="flex space-x-2">
                <Input
                  placeholder="Add a tag..."
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1"
                />
                <Button type="button" onClick={addTag} variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Integration-specific fields */}
          {formData.source !== 'manual' && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center space-x-2">
                {selectedSource?.icon}
                <h4 className="font-medium">Integration Settings</h4>
              </div>

              {formData.source === 'slack' && (
                <div>
                  <Label htmlFor="slackChannel">Slack Channel</Label>
                  <Input
                    id="slackChannel"
                    placeholder="e.g. #development"
                    value={formData.integrationData.slackChannel}
                    onChange={(e) => handleIntegrationDataChange('slackChannel', e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {formData.source === 'figma' && (
                <div>
                  <Label htmlFor="figmaFile">Figma File</Label>
                  <Input
                    id="figmaFile"
                    placeholder="e.g. Landing Page V2"
                    value={formData.integrationData.figmaFile}
                    onChange={(e) => handleIntegrationDataChange('figmaFile', e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {formData.source === 'github' && (
                <div>
                  <Label htmlFor="githubRepo">GitHub Repository</Label>
                  <Input
                    id="githubRepo"
                    placeholder="e.g. username/repo-name"
                    value={formData.integrationData.githubRepo}
                    onChange={(e) => handleIntegrationDataChange('githubRepo', e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {formData.source === 'onedrive' && (
                <div>
                  <Label htmlFor="onedriveFile">OneDrive File</Label>
                  <Input
                    id="onedriveFile"
                    placeholder="e.g. Documents/Project Plan.docx"
                    value={formData.integrationData.onedriveFile}
                    onChange={(e) => handleIntegrationDataChange('onedriveFile', e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* Additional Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.notifications}
                  onCheckedChange={(checked) => handleInputChange('notifications', checked)}
                />
                <Label>Enable notifications</Label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.recurring}
                  onCheckedChange={(checked) => handleInputChange('recurring', checked)}
                />
                <Label>Recurring task</Label>
              </div>
            </div>

            {formData.recurring && (
              <div className="ml-6">
                <Select value={formData.recurringType} onValueChange={(value) => handleInputChange('recurringType', value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button type="submit" className="flex-1">
              Create Task
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};