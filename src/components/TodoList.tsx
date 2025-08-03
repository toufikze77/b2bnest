import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TodoItem from './enhanced-todos/TodoItem';
import CreateTodoDialog from './enhanced-todos/CreateTodoDialog';
import { PlanUpgradeDialog } from './enhanced-todos/PlanUpgradeDialog';
import { toast } from '@/hooks/use-toast';

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
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

const TodoList = () => {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTodos();
    } else {
      // For non-authenticated users, show empty state
      setLoading(false);
    }
  }, [user]);

  const fetchTodos = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkFreePlanLimit = () => {
    if (!user) return false;
    
    // Check if user has reached the free plan limit of 10 todos
    if (todos.length >= 10) {
      setShowUpgradeDialog(true);
      return true;
    }
    return false;
  };

  const createTodo = async (todoData: any) => {
    if (!user) {
      toast({
        title: "Sign Up Required",
        description: "Please sign up to save your tasks permanently.",
        variant: "destructive"
      });
      return;
    }
    
    if (checkFreePlanLimit()) return;

    try {
      const { error } = await supabase
        .from('todos')
        .insert({
          ...todoData,
          user_id: user.id,
          status: 'todo',
          reporter_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task created successfully!"
      });

      fetchTodos();
    } catch (error) {
      console.error('Error creating todo:', error);
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive"
      });
    }
  };

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task updated successfully!"
      });

      fetchTodos();
    } catch (error) {
      console.error('Error updating todo:', error);
      toast({
        title: "Error",
        description: "Failed to update task.",
        variant: "destructive"
      });
    }
  };

  const deleteTodo = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task deleted successfully!"
      });

      fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateTodo(id, { 
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null
    });
  };

  const handleEdit = (todo: Todo) => {
    // Open the details dialog for editing
    updateTodo(todo.id, todo);
  };

  // Filter todos based on search and filters
  const filteredTodos = todos.filter(todo => {
    const matchesSearch = todo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (todo.description && todo.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || todo.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || todo.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const todoCount = todos.filter(t => t.status === 'todo').length;
  const inProgressCount = todos.filter(t => t.status === 'in-progress').length;
  const doneCount = todos.filter(t => t.status === 'done').length;
  const totalCount = todos.length;

  // Remove authentication requirement to allow free access

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Task Management</h1>
            <p className="text-gray-600">Organize tasks, track progress, and manage your workflow</p>
          </div>
          <div className="text-sm text-gray-500">
            {totalCount}/10 tasks used (Free Plan)
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">To Do</p>
                  <p className="text-2xl font-bold text-blue-600">{todoCount}</p>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl font-bold text-orange-600">{inProgressCount}</p>
                </div>
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  Working
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Done</p>
                  <p className="text-2xl font-bold text-green-600">{doneCount}</p>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  Complete
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                </div>
                <Badge variant="outline">
                  All Tasks
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
            
            <CreateTodoDialog 
              onCreateTodo={createTodo}
              isOpen={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading tasks...</p>
            </CardContent>
          </Card>
        ) : filteredTodos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-4">📝</div>
              {todos.length === 0 ? (
                <div>
                  <p className="text-gray-600 mb-4">No tasks yet. Create your first task to get started!</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Task
                  </Button>
                </div>
              ) : (
                <p className="text-gray-600">No tasks match your current filters.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onEdit={handleEdit}
              onDelete={deleteTodo}
              onStatusChange={handleStatusChange}
              onUpdate={updateTodo}
            />
          ))
        )}
      </div>

      {/* Plan Upgrade Dialog */}
      <PlanUpgradeDialog
        isOpen={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentCount={totalCount}
      />
    </div>
  );
};

export default TodoList;