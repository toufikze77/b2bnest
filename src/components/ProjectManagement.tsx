
import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Target, Users, Calendar, AlertCircle, CheckCircle2, Clock, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  projectId: string;
  order: number;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  deadline: string;
  projectId: string;
  userId: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  progress: number;
}

const SortableTask = ({ task, onUpdate }: { task: Task; onUpdate: (task: Task) => void }) => {
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

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  const statusIcons = {
    'todo': <Clock className="h-4 w-4 text-gray-500" />,
    'in-progress': <AlertCircle className="h-4 w-4 text-blue-500" />,
    'completed': <CheckCircle2 className="h-4 w-4 text-green-500" />
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="mb-2 hover:shadow-md transition-shadow cursor-move">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div {...listeners} className="mt-1 cursor-grab hover:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {statusIcons[task.status]}
                <h4 className="font-medium text-sm truncate">{task.title}</h4>
              </div>
              {task.description && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
              )}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                  {task.priority}
                </Badge>
                {task.assignee && (
                  <span className="text-xs text-gray-500">{task.assignee}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ProjectManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    assignee: ''
  });
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetValue: 0,
    deadline: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('pmProjects');
    const savedTasks = localStorage.getItem('pmTasks');
    const savedGoals = localStorage.getItem('pmGoals');

    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    }
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    if (savedGoals) {
      setGoals(JSON.parse(savedGoals));
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('pmProjects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('pmTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('pmGoals', JSON.stringify(goals));
  }, [goals]);

  const addTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a task title.",
        variant: "destructive"
      });
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      status: 'todo',
      priority: newTask.priority,
      assignee: newTask.assignee.trim() || undefined,
      projectId: selectedProject === 'all' ? 'general' : selectedProject,
      order: tasks.length
    };

    setTasks(prev => [...prev, task]);
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      assignee: ''
    });
    setIsAddingTask(false);

    toast({
      title: "Task Added",
      description: `"${task.title}" has been added to your tasks.`
    });
  };

  const saveGoal = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create goals.",
        variant: "destructive"
      });
      return;
    }

    if (!newGoal.title.trim() || !newGoal.deadline) {
      toast({
        title: "Missing Information",
        description: "Please enter a goal title and deadline.",
        variant: "destructive"
      });
      return;
    }

    try {
      const goal: Goal = {
        id: Date.now().toString(),
        title: newGoal.title.trim(),
        description: newGoal.description.trim(),
        targetValue: newGoal.targetValue,
        currentValue: 0,
        deadline: newGoal.deadline,
        projectId: selectedProject === 'all' ? 'general' : selectedProject,
        userId: user.id
      };

      setGoals(prev => [...prev, goal]);
      setNewGoal({
        title: '',
        description: '',
        targetValue: 0,
        deadline: ''
      });
      setIsAddingGoal(false);

      toast({
        title: "Goal Created",
        description: `"${goal.title}" has been added to your goals.`
      });
    } catch (error: any) {
      console.error('Error saving goal:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save goal. Please try again.",
        variant: "destructive"
      });
    }
  };

  const updateTaskStatus = (taskId: string, newStatus: Task['status']) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId !== overId) {
      setTasks((tasks) => {
        const oldIndex = tasks.findIndex(task => task.id === activeId);
        const newIndex = tasks.findIndex(task => task.id === overId);

        const newTasks = arrayMove(tasks, oldIndex, newIndex);
        
        // Update order property
        return newTasks.map((task, index) => ({
          ...task,
          order: index
        }));
      });
    }
  };

  const filteredTasks = selectedProject === 'all' 
    ? tasks 
    : tasks.filter(task => task.projectId === selectedProject);

  const filteredGoals = selectedProject === 'all'
    ? goals
    : goals.filter(goal => goal.projectId === selectedProject);

  const tasksByStatus = {
    todo: filteredTasks.filter(task => task.status === 'todo').sort((a, b) => a.order - b.order),
    'in-progress': filteredTasks.filter(task => task.status === 'in-progress').sort((a, b) => a.order - b.order),
    completed: filteredTasks.filter(task => task.status === 'completed').sort((a, b) => a.order - b.order)
  };

  const statusColors = {
    todo: 'bg-gray-50',
    'in-progress': 'bg-blue-50', 
    completed: 'bg-green-50'
  };

  const statusTitles = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    completed: 'Completed'
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Project Management</h1>
        <p className="text-gray-600">Organize tasks and track project goals</p>
      </div>

      {/* Project Selector */}
      <div className="mb-6">
        <select
          className="p-2 border border-gray-300 rounded-md"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="all">All Projects</option>
          <option value="general">General</option>
        </select>
      </div>

      {/* Task Management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tasks
          </h2>
          <Button onClick={() => setIsAddingTask(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        {isAddingTask && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="space-y-4">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
                <Textarea
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    className="p-2 border border-gray-300 rounded-md"
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <Input
                    placeholder="Assignee (optional)"
                    value={newTask.assignee}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assignee: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addTask} className="flex-1">
                    Add Task
                  </Button>
                  <Button onClick={() => setIsAddingTask(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
              <div key={status} className={`${statusColors[status as keyof typeof statusColors]} rounded-lg p-4 min-h-[400px]`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{statusTitles[status as keyof typeof statusTitles]}</h3>
                  <Badge variant="outline">{statusTasks.length}</Badge>
                </div>
                
                <SortableContext items={statusTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                  {statusTasks.map((task) => (
                    <SortableTask 
                      key={task.id} 
                      task={task} 
                      onUpdate={(updatedTask) => {
                        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                      }}
                    />
                  ))}
                </SortableContext>
              </div>
            ))}
          </div>
        </DndContext>
      </div>

      {/* Goals Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goals
          </h2>
          <Button onClick={() => setIsAddingGoal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {isAddingGoal && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="space-y-4">
                <Input
                  placeholder="Goal title"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                />
                <Textarea
                  placeholder="Goal description"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    placeholder="Target value"
                    value={newGoal.targetValue || ''}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, targetValue: parseInt(e.target.value) || 0 }))}
                  />
                  <Input
                    type="date"
                    value={newGoal.deadline}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveGoal} className="flex-1">
                    Save Goal
                  </Button>
                  <Button onClick={() => setIsAddingGoal(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <Card key={goal.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{goal.title}</h4>
                    <Badge variant={daysLeft < 0 ? "destructive" : daysLeft <= 7 ? "secondary" : "outline"}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                    </Badge>
                  </div>
                  {goal.description && (
                    <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress: {goal.currentValue} / {goal.targetValue}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredGoals.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No goals yet. Set your first goal above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;
