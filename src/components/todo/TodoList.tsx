import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Check, X, Edit3, Calendar, User, Tag, 
  AlertCircle, Clock, Filter, SortAsc, MoreHorizontal,
  Slack, Github, Figma, MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: {
    id: string;
    name: string;
    avatar?: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source?: 'manual' | 'slack' | 'github' | 'figma' | 'chatgpt' | 'onedrive';
  integrationData?: {
    slackChannel?: string;
    githubIssue?: string;
    figmaFile?: string;
    onedriveFile?: string;
  };
  project?: string;
  estimatedTime?: number; // in minutes
}

interface TodoListProps {
  searchQuery?: string;
}

export const TodoList: React.FC<TodoListProps> = ({ searchQuery = '' }) => {
  const [todos, setTodos] = useState<TodoItem[]>([
    {
      id: '1',
      title: 'Review Figma design mockups',
      description: 'Check the new landing page designs and provide feedback',
      completed: false,
      priority: 'high',
      dueDate: '2024-01-15',
      assignedTo: { id: '1', name: 'John Doe', avatar: '' },
      tags: ['design', 'review'],
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
      source: 'figma',
      integrationData: { figmaFile: 'Landing Page V2' },
      project: 'Website Redesign',
      estimatedTime: 120
    },
    {
      id: '2',
      title: 'Sync with OneDrive documents',
      description: 'Update project documentation in shared folder',
      completed: false,
      priority: 'medium',
      dueDate: '2024-01-16',
      tags: ['documentation', 'sync'],
      createdAt: '2024-01-11T09:00:00Z',
      updatedAt: '2024-01-11T09:00:00Z',
      source: 'onedrive',
      integrationData: { onedriveFile: 'Project Docs/Requirements.docx' },
      project: 'Documentation',
      estimatedTime: 60
    },
    {
      id: '3',
      title: 'Respond to Slack team discussion',
      description: 'Address questions about the new feature implementation',
      completed: true,
      priority: 'medium',
      assignedTo: { id: '2', name: 'Jane Smith', avatar: '' },
      tags: ['communication', 'team'],
      createdAt: '2024-01-09T14:00:00Z',
      updatedAt: '2024-01-12T16:00:00Z',
      source: 'slack',
      integrationData: { slackChannel: '#development' },
      project: 'Team Communication',
      estimatedTime: 30
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created' | 'updated'>('dueDate');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const { toast } = useToast();

  // Filter and sort todos
  const filteredTodos = todos
    .filter(todo => {
      // Search filter
      if (searchQuery && !todo.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !todo.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !todo.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }

      // Status filter
      if (filter === 'completed' && !todo.completed) return false;
      if (filter === 'pending' && todo.completed) return false;
      if (filter === 'overdue' && (todo.completed || !todo.dueDate || new Date(todo.dueDate) > new Date())) return false;

      // Priority filter
      if (selectedPriority !== 'all' && todo.priority !== selectedPriority) return false;

      // Project filter
      if (selectedProject !== 'all' && todo.project !== selectedProject) return false;

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => {
      if (todo.id === id) {
        const updated = { ...todo, completed: !todo.completed, updatedAt: new Date().toISOString() };
        toast({
          title: updated.completed ? "Task completed!" : "Task reopened",
          description: updated.title,
        });
        return updated;
      }
      return todo;
    }));
  };

  const deleteTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
    setTodos(todos.filter(todo => todo.id !== id));
    toast({
      title: "Task deleted",
      description: todo?.title,
      variant: "destructive"
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'slack': return <Slack className="h-4 w-4 text-purple-600" />;
      case 'github': return <Github className="h-4 w-4 text-gray-800" />;
      case 'figma': return <Figma className="h-4 w-4 text-purple-500" />;
      case 'chatgpt': return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'onedrive': return <div className="h-4 w-4 bg-blue-600 rounded text-white text-xs flex items-center justify-center">O</div>;
      default: return null;
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && !todos.find(t => t.dueDate === dueDate)?.completed;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString();
  };

  const projects = [...new Set(todos.map(t => t.project).filter(Boolean))];
  const completedCount = filteredTodos.filter(todo => todo.completed).length;
  const totalCount = filteredTodos.length;

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-sm">
                {completedCount}/{totalCount} completed
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Status Filter */}
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Project Filter */}
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project} value={project}>{project}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTodos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-gray-500 text-lg mb-2">No tasks found</p>
              <p className="text-gray-400">Try adjusting your filters or create a new task</p>
            </CardContent>
          </Card>
        ) : (
          filteredTodos.map((todo) => (
            <Card key={todo.id} className={`transition-all hover:shadow-md ${todo.completed ? 'bg-gray-50' : 'bg-white'}`}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id)}
                    />
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      {/* Source Icon */}
                      {getSourceIcon(todo.source)}
                      
                      {/* Title */}
                      <h3 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {todo.title}
                      </h3>

                      {/* Priority Badge */}
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(todo.priority)}`}>
                        {todo.priority}
                      </Badge>

                      {/* Overdue indicator */}
                      {isOverdue(todo.dueDate) && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    {todo.description && (
                      <p className={`text-sm mb-3 ${todo.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                        {todo.description}
                      </p>
                    )}

                    {/* Meta Information */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      {/* Due Date */}
                      {todo.dueDate && (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span className={isOverdue(todo.dueDate) ? 'text-red-600' : ''}>
                            {formatDate(todo.dueDate)}
                          </span>
                        </div>
                      )}

                      {/* Assigned To */}
                      {todo.assignedTo && (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          <span>{todo.assignedTo.name}</span>
                        </div>
                      )}

                      {/* Project */}
                      {todo.project && (
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-1" />
                          <span>{todo.project}</span>
                        </div>
                      )}

                      {/* Estimated Time */}
                      {todo.estimatedTime && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{todo.estimatedTime}min</span>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {todo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {todo.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Integration Data */}
                    {todo.integrationData && (
                      <div className="mt-2 text-xs text-blue-600">
                        {todo.integrationData.slackChannel && `Slack: ${todo.integrationData.slackChannel}`}
                        {todo.integrationData.figmaFile && `Figma: ${todo.integrationData.figmaFile}`}
                        {todo.integrationData.onedriveFile && `OneDrive: ${todo.integrationData.onedriveFile}`}
                        {todo.integrationData.githubIssue && `GitHub: ${todo.integrationData.githubIssue}`}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <User className="h-4 w-4 mr-2" />
                        Assign
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Calendar className="h-4 w-4 mr-2" />
                        Set Due Date
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => deleteTodo(todo.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};