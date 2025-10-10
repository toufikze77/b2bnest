import React, { useState } from 'react';
import { Calendar, MessageCircle, History, MoreHorizontal, User, Flag, Clock, Edit3, Trash2, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TodoComments } from './TodoComments';
import { TodoHistory } from './TodoHistory';
import { EnhancedTodoView } from './EnhancedTodoView';

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  labels: string[];
  due_date?: string;
  start_date?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  estimated_hours?: number;
  actual_hours?: number;
}

interface TodoItemProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onEdit, onDelete, onStatusChange, onUpdate }) => {
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showEnhancedView, setShowEnhancedView] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in-progress': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'done': return 'bg-green-100 text-green-800 border-green-200';
      case 'blocked': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleStatusToggle = () => {
    const newStatus = todo.status === 'done' ? 'todo' : 'done';
    onStatusChange(todo.id, newStatus);
  };

  return (
    <Card className="mb-3 hover:shadow-md transition-all relative">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStatusToggle}
                className="h-6 w-6 p-0 flex-shrink-0"
              >
                <CheckCircle 
                  className={`h-4 w-4 ${todo.status === 'done' ? 'text-green-600 fill-green-100' : 'text-gray-400'}`} 
                />
              </Button>
              <h3 className={`font-medium ${todo.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'} truncate`}>
                {todo.title}
              </h3>
            </div>

            {todo.description && (
              <p className="text-sm text-gray-600 mb-2 ml-8">
                {todo.description.length > 100 
                  ? `${todo.description.substring(0, 100)}...` 
                  : todo.description}
              </p>
            )}

            <div className="flex items-center gap-2 mb-2 ml-8 flex-wrap">
              <Badge variant="outline" className={getStatusColor(todo.status)}>
                {todo.status.replace('-', ' ')}
              </Badge>
              <Badge variant="outline" className={getPriorityColor(todo.priority)}>
                <Flag className="h-3 w-3 mr-1" />
                {todo.priority}
              </Badge>
              {todo.labels.map((label, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 ml-8 flex-wrap">
              {todo.due_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due: {new Date(todo.due_date).toLocaleDateString()}
                </div>
              )}
              {todo.estimated_hours && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {todo.estimated_hours}h est.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Dialog open={showComments} onOpenChange={setShowComments}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                  title="View Comments"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-left">Comments - {todo.title}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                  <TodoComments todoId={todo.id} />
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600"
                  title="View History"
                >
                  <History className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>History - {todo.title}</DialogTitle>
                </DialogHeader>
                <TodoHistory todoId={todo.id} />
              </DialogContent>
            </Dialog>

            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
              title="View Details"
              onClick={() => setShowEnhancedView(true)}
            >
              <User className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 hover:bg-gray-50"
                  title="More Options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(todo)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(todo.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
      
      {showEnhancedView && (
        <EnhancedTodoView
          todo={todo}
          onUpdate={onUpdate}
          onClose={() => setShowEnhancedView(false)}
        />
      )}
    </Card>
  );
};

export default TodoItem;