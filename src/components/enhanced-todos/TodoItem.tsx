import React, { useState } from 'react';
import { Calendar, MessageCircle, History, MoreHorizontal, User, Flag, Clock, Edit3, Trash2, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TodoComments } from './TodoComments';
import { TodoHistory } from './TodoHistory';
import { TodoDetails } from './TodoDetails';

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
  const [showDetails, setShowDetails] = useState(false);

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
    <Card className="mb-3 hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStatusToggle}
                className="h-6 w-6 p-0"
              >
                <CheckCircle 
                  className={`h-4 w-4 ${todo.status === 'done' ? 'text-green-600 fill-green-100' : 'text-gray-400'}`} 
                />
              </Button>
              <h3 className={`font-medium ${todo.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {todo.title}
              </h3>
            </div>

            {todo.description && (
              <p className="text-sm text-gray-600 mb-2 ml-8">{todo.description}</p>
            )}

            <div className="flex items-center gap-2 mb-2 ml-8">
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

            <div className="flex items-center gap-4 text-xs text-gray-500 ml-8">
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

          <div className="flex items-center gap-1">
            <Dialog open={showComments} onOpenChange={setShowComments}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Comments - {todo.title}</DialogTitle>
                </DialogHeader>
                <TodoComments todoId={todo.id} />
              </DialogContent>
            </Dialog>

            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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

            <Dialog open={showDetails} onOpenChange={setShowDetails}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <User className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Details - {todo.title}</DialogTitle>
                </DialogHeader>
                <TodoDetails todo={todo} onUpdate={onUpdate} />
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
    </Card>
  );
};

export default TodoItem;