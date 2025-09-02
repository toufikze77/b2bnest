import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, TrendingUp, Filter, Search, Grid3X3, List, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from "sonner";
import { format } from 'date-fns';
import CreateTodoDialog from '@/components/enhanced-todos/CreateTodoDialog';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  labels?: string[];
  assigned_to?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  project_id?: string;
  organization_id: string;
  user_id: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

const ProjectManagement = () => {
  const { user } = useAuth();
  const { currentOrganization, members } = useOrganization();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [view, setView] = useState('kanban');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const KANBAN_COLUMNS: KanbanColumn[] = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'review', title: 'Review', color: 'bg-yellow-100' },
    { id: 'done', title: 'Done', color: 'bg-green-100' }
  ];

  const fetchProjects = async () => {
    if (!user || !currentOrganization) return;

    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    }
  };

  const fetchTasks = async () => {
    if (!user || !currentOrganization) return;

    try {
      const { data: tasksData, error } = await supabase
        .from('todos')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    }
  };

  useEffect(() => {
    if (user && currentOrganization) {
      fetchProjects();
      fetchTasks();
      setLoading(false);
    }
  }, [user, currentOrganization]);

  useEffect(() => {
    if (!Array.isArray(tasks)) {
      setFilteredTasks([]);
      return;
    }

    let filtered = tasks;
    
    if (searchTerm) {
      filtered = filtered.filter(task => 
        task?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task?.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task?.status === statusFilter);
    }
    
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task?.priority === priorityFilter);
    }
    
    setFilteredTasks(filtered);
  }, [tasks, searchTerm, statusFilter, priorityFilter]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => Array.isArray(prev) ? prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ) : []);

      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const taskId = active.id as string;
    const newStatus = over.id as string;
    
    // Check if dropping over a valid column
    if (KANBAN_COLUMNS.some(col => col.id === newStatus)) {
      updateTaskStatus(taskId, newStatus);
    }
    
    setActiveTaskId(null);
  };

  const DroppableColumn = ({ column, children }: { column: KanbanColumn; children: React.ReactNode }) => {
    const { isOver, setNodeRef } = useDroppable({
      id: column.id,
    });

    return (
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[600px] p-4 rounded-lg ${column.color} ${
          isOver ? 'ring-2 ring-primary' : ''
        }`}
      >
        <h3 className="font-semibold text-gray-900 mb-4">{column.title}</h3>
        <div className="space-y-3">
          {children}
        </div>
      </div>
    );
  };

  const SortableTaskCard = ({ task }: { task: Task }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: task.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const safeLabels = Array.isArray(task?.labels) ? task.labels : [];
    const assignedMember = Array.isArray(members) ? members.find(m => m.user_id === task?.assigned_to) : null;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab"
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-gray-900 text-sm">{task?.title || 'Untitled'}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {task?.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={
              task?.priority === 'urgent' ? 'destructive' :
              task?.priority === 'high' ? 'default' :
              task?.priority === 'low' ? 'secondary' : 'outline'
            }>
              {task?.priority || 'medium'}
            </Badge>
            
            {safeLabels.length > 0 && (
              <div className="flex gap-1">
                {safeLabels.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {safeLabels.length > 2 && (
                  <span className="text-xs text-gray-500">+{safeLabels.length - 2}</span>
                )}
              </div>
            )}
          </div>
          
          {assignedMember && (
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-xs">
                {assignedMember.profile?.display_name?.charAt(0) || assignedMember.profile?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        
        {task?.due_date && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            {format(new Date(task.due_date), 'MMM d')}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>0 subtasks</span>
          <span>0 files</span>
          <span>0 comments</span>
        </div>
      </div>
    );
  };

  const handleCreateTask = (taskData: any) => {
    fetchTasks(); // Refresh tasks after creation
    setShowCreateTask(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading project management...</p>
        </div>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please select an organization to manage projects.</p>
      </div>
    );
  }

  const safeTasks = Array.isArray(filteredTasks) ? filteredTasks : [];
  const stats = {
    totalTasks: safeTasks.length,
    completedTasks: safeTasks.filter(task => task?.status === 'done').length,
    inProgressTasks: safeTasks.filter(task => task?.status === 'in_progress').length,
    urgentTasks: safeTasks.filter(task => task?.priority === 'urgent').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Project Management</h2>
          <p className="text-gray-600">Organize tasks, track progress, and collaborate with your team</p>
        </div>
        <Button onClick={() => setShowCreateTask(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgentTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('kanban')}
          >
            <Grid3X3 className="w-4 h-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('list')}
          >
            <List className="w-4 h-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={view} onValueChange={setView}>
        <TabsContent value="kanban">
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 overflow-x-auto">
              {KANBAN_COLUMNS.map(column => (
                <DroppableColumn key={column.id} column={column}>
                  <SortableContext items={safeTasks.filter(task => task?.status === column.id).map(task => task.id)}>
                    {safeTasks
                      .filter(task => task?.status === column.id)
                      .map(task => (
                        <SortableTaskCard key={task.id} task={task} />
                      ))}
                  </SortableContext>
                </DroppableColumn>
              ))}
            </div>
            <DragOverlay>
              {activeTaskId ? (
                <SortableTaskCard task={safeTasks.find(task => task.id === activeTaskId)!} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {safeTasks.map(task => (
                  <Card key={task.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{task?.title || 'Untitled'}</h4>
                        {task?.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {task?.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                          </div>
                          <Badge variant="outline">{task?.status?.replace('_', ' ') || 'todo'}</Badge>
                          <Badge variant={
                            task?.priority === 'urgent' ? 'destructive' :
                            task?.priority === 'high' ? 'default' :
                            task?.priority === 'low' ? 'secondary' : 'outline'
                          }>
                            {task?.priority || 'medium'}
                          </Badge>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <CreateTodoDialog
        isOpen={showCreateTask}
        onOpenChange={setShowCreateTask}
        onCreateTodo={handleCreateTask}
        organizationMembers={Array.isArray(members) ? members : []}
      />
    </div>
  );
};

export default ProjectManagement;