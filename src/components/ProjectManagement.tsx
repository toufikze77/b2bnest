import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionUpgrade from './SubscriptionUpgrade';
import CreateTodoDialog from './enhanced-todos/CreateTodoDialog';
import CreateProjectDialog, { ProjectFormData } from './CreateProjectDialog';
import EditProjectDialog from './EditProjectDialog';
import ProjectTimeTracker from './ProjectTimeTracker';
import ProjectActivityTimeline from './ProjectActivityTimeline';
import StatsCard from './cards/StatsCard';
import ProjectCard from './cards/ProjectCard';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreHorizontal,
  Filter,
  Search,
  KanbanSquare,
  List,
  BarChart3,
  Settings,
  Users,
  Target,
  Zap,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Star,
  Bot,
  Workflow,
  Activity,
  Video,
  TrendingUp,
  Shield,
  Paperclip,
  Timer,
  Flag,
  Brain,
  ExternalLink,
  Send,
  MessageCircle,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  Award,
  Eye,
  Edit,
  Trash2,
  Share2,
  Download,
  Upload,
  Bell,
  Calendar as CalendarIconOutline,
  Slack,
  ChartColumn,
  ChartPie,
  MessageCircle as Comment,
  MessageSquare as CommentSquare,
  FolderOpen,
  ListCheck,
  BellRing,
  Lightbulb,
  Rocket,
  HardDrive,
  Cloud,
  Loader2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Tag as TagIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';

ChartJS.register(ArcElement, ChartTooltip, Legend, CategoryScale, LinearScale, BarElement);

// Enhanced interfaces
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  dueDate: Date | null;
  project: string;
  tags: string[];
  subtasks?: Subtask[];
  timeTracked?: number;
  clientFeedback?: string;
  attachments?: string[];
  estimatedHours?: number;
  actualHours?: number;
  comments?: Comment[];
  dependencies?: string[];
  progress?: number;
  archived?: boolean;
  position?: number;
  coverUrl?: string;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignee: string;
  dueDate?: Date;
}

interface Comment {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
  mentions?: string[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  progress: number;
  members: string[];
  deadline: Date | null;
  budget?: number;
  client?: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed';
  customColumns?: KanbanColumn[];
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
  automationRules?: AutomationRule[];
  wipLimit?: number;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  actions: Array<{
    type: string;
    value: string;
  }>;
  isActive: boolean;
  lastTriggered?: Date;
}

// New interfaces for multitenancy and planning
interface Team {
  id: string;
  name: string;
  members: string[];
}

interface Epic {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  dueDate?: Date | null;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: Date | null;
  progress: number;
  owner?: string;
  projectId?: string;
  epicId?: string;
}

const ProjectManagement = () => {
  console.log('🔧 ProjectManagement component loading...');
  const { user } = useAuth();
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar' | 'timeline'>('kanban');
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);
  const [showBoardCustomizer, setShowBoardCustomizer] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  
  // State for various dialogs and features
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [lastFocusedTaskId, setLastFocusedTaskId] = useState<string>('');
  const [columnTaskOrder, setColumnTaskOrder] = useState<Record<string, string[]>>({});
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [labelsTask, setLabelsTask] = useState<Task | null>(null);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [checklistTask, setChecklistTask] = useState<Task | null>(null);
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState(false);
  const [dueDateTask, setDueDateTask] = useState<Task | null>(null);
  
  // Compact mode and multitenancy state
  const [compactMode, setCompactMode] = useState<boolean>(true);
  const [teams, setTeams] = useState<Team[]>([
    { id: 'all', name: 'All Teams', members: [] },
    { id: 'team-1', name: 'Product', members: ['John Doe', 'Jane Smith'] },
    { id: 'team-2', name: 'Engineering', members: ['Mike Johnson', 'Alex Chen'] },
  ]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showCreateEpic, setShowCreateEpic] = useState<boolean>(false);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wipLimits, setWipLimits] = useState<Record<string, number>>({
    backlog: 999,
    todo: 8,
    'in-progress': 5,
    review: 4,
    done: 999,
  });
  
  // Trello-like UI state
  const [favoriteBoards, setFavoriteBoards] = useState<Record<string, boolean>>({});
  const [listComposerOpen, setListComposerOpen] = useState<boolean>(false);
  const [newListTitle, setNewListTitle] = useState<string>('');
  const [cardComposerOpen, setCardComposerOpen] = useState<Record<string, boolean>>({});
  const [newCardTitle, setNewCardTitle] = useState<Record<string, string>>({});
  
  const getTagColor = (tag: string) => {
    const palette = ['bg-red-500','bg-orange-500','bg-amber-500','bg-yellow-500','bg-lime-500','bg-green-500','bg-emerald-500','bg-teal-500','bg-cyan-500','bg-sky-500','bg-blue-500','bg-indigo-500','bg-violet-500','bg-purple-500','bg-fuchsia-500','bg-pink-500','bg-rose-500'];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  };

  // Sample data with enhanced features
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign',
      description: 'Complete overhaul of company website with modern UI/UX',
      color: 'bg-blue-500',
      progress: 75,
      members: ['John Doe', 'Jane Smith', 'Mike Johnson'],
      deadline: new Date(2024, 2, 30),
      budget: 50000,
      client: 'Tech Corp',
      status: 'active',
      customColumns: [
        { id: 'backlog', title: 'Backlog', color: 'bg-gray-100', order: 1 },
        { id: 'todo', title: 'To Do', color: 'bg-blue-100', order: 2 },
        { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-100', order: 3 },
        { id: 'review', title: 'Review', color: 'bg-purple-100', order: 4 },
        { id: 'done', title: 'Done', color: 'bg-green-100', order: 5 }
      ]
    },
    {
      id: '2',
      name: 'Mobile App Development',
      description: 'Cross-platform mobile application',
      color: 'bg-green-500',
      progress: 45,
      members: ['Sarah Wilson', 'Alex Chen'],
      deadline: new Date(2024, 4, 15),
      budget: 75000,
      client: 'Startup Inc',
      status: 'active'
    }
  ]);

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Design Homepage Mockup',
      description: 'Create responsive homepage design with modern aesthetics',
      status: 'in-progress',
      priority: 'high',
      assignee: 'John Doe',
      dueDate: new Date(2024, 2, 15),
      project: 'Website Redesign',
      tags: ['design', 'ui/ux', 'homepage'],
      estimatedHours: 20,
      actualHours: 12,
      progress: 60,
      subtasks: [
        { id: 's1', title: 'Research competitor designs', completed: true, assignee: 'John Doe' },
        { id: 's2', title: 'Create wireframes', completed: true, assignee: 'John Doe' },
        { id: 's3', title: 'Design high-fidelity mockup', completed: false, assignee: 'John Doe' }
      ],
      comments: [
        { id: 'c1', content: 'Great progress on the wireframes!', author: 'Jane Smith', timestamp: new Date() }
      ]
    },
    {
      id: '2',
      title: 'Setup Authentication System',
      description: 'Implement secure user authentication with JWT',
      status: 'todo',
      priority: 'urgent',
      assignee: 'Jane Smith',
      dueDate: new Date(2024, 2, 20),
      project: 'Website Redesign',
      tags: ['backend', 'security', 'auth'],
      estimatedHours: 15,
      dependencies: ['1']
    }
  ]);

  const handleTaskArchive = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archived: true } : t));
    // Note: archived field might not exist in database yet
    toast({ title: "Task Archived", description: "Task has been archived" });
  };

  // Check if user can access Project Management features
  const canAccessPM = useSubscription().canAccessFeature('project-management');

  useEffect(() => {
    if (user && canAccessPM) {
      loadProjects();
      loadTasks();
    } else {
      setLoading(false);
    }
  }, [user, canAccessPM, selectedTeam]);

  // Load projects from database
  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedProjects: Project[] = data.map(project => ({
          id: project.id,
          name: project.name,
          description: project.description || '',
          color: project.color,
          progress: project.progress,
          members: Array.isArray(project.members) ? project.members as string[] : [],
          deadline: project.deadline ? new Date(project.deadline) : null,
          budget: project.budget ? parseFloat(project.budget.toString()) : undefined,
          client: project.client,
          status: project.status as 'planning' | 'active' | 'on-hold' | 'completed',
          customColumns: Array.isArray(project.custom_columns) ? project.custom_columns as unknown as KanbanColumn[] : [
            { id: 'backlog', title: 'Backlog', color: 'bg-gray-100', order: 1 },
            { id: 'todo', title: 'To Do', color: 'bg-blue-100', order: 2 },
            { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-100', order: 3 },
            { id: 'review', title: 'Review', color: 'bg-purple-100', order: 4 },
            { id: 'done', title: 'Done', color: 'bg-green-100', order: 5 }
          ]
        }));
        setProjects(formattedProjects);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load projects.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedTasks: Task[] = data.map(todo => ({
          id: todo.id,
          title: todo.title,
          description: todo.description || '',
          status: todo.status as 'backlog' | 'todo' | 'in-progress' | 'review' | 'done',
          priority: todo.priority as 'low' | 'medium' | 'high' | 'urgent',
          assignee: todo.assigned_to || 'Unassigned',
          dueDate: todo.due_date ? new Date(todo.due_date) : null,
          project: todo.project?.id || 'no-project',
          tags: todo.labels || [],
          estimatedHours: todo.estimated_hours,
          subtasks: [],
          progress: 0,
          comments: [],
          archived: Boolean((todo as any).is_archived) || false,
          position: (todo as any).position ?? undefined,
          coverUrl: (todo as any).cover_url ?? undefined,
        }));
        setTasks(formattedTasks);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  // Handle creating new projects
  const handleCreateProject = async (projectData: ProjectFormData) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          color: projectData.color,
          status: projectData.status,
          deadline: projectData.deadline ? projectData.deadline.toISOString().split('T')[0] : null,
          budget: projectData.budget,
          client: projectData.client,
          members: projectData.members,
          user_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newProject: Project = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          color: data.color,
          progress: 0,
          members: Array.isArray(data.members) ? data.members as string[] : [],
          deadline: data.deadline ? new Date(data.deadline) : null,
          budget: data.budget ? parseFloat(data.budget.toString()) : undefined,
          client: data.client,
          status: data.status as 'planning' | 'active' | 'on-hold' | 'completed',
          customColumns: [
            { id: 'backlog', title: 'Backlog', color: 'bg-gray-100', order: 1 },
            { id: 'todo', title: 'To Do', color: 'bg-blue-100', order: 2 },
            { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-100', order: 3 },
            { id: 'review', title: 'Review', color: 'bg-purple-100', order: 4 },
            { id: 'done', title: 'Done', color: 'bg-green-100', order: 5 }
          ]
        };

        setProjects(prev => [newProject, ...prev]);
        toast({ title: "Project Created", description: `Successfully created project: ${newProject.name}` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
      throw new Error('create project failed');
    }
  };

  // Handle creating new tasks
  const handleCreateTask = async (taskData: any) => {
    try {
      const targetProjectId = selectedProject !== 'all' ? selectedProject : projects[0]?.id || null;

      const { data, error } = await supabase
        .from('todos')
        .insert({
          title: taskData.title,
          description: taskData.description || '',
          status: taskData.status || 'todo',
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date || null,
          labels: taskData.labels || [],
          estimated_hours: taskData.estimated_hours,
          project_id: targetProjectId,
          user_id: user?.id,
        })
        .select(`
          *,
          project:projects(id, name)
        `)
        .single();

      if (error) throw error;

      const newTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        status: data.status as 'backlog' | 'todo' | 'in-progress' | 'review' | 'done',
        priority: data.priority as 'low' | 'medium' | 'high' | 'urgent',
        assignee: data.assigned_to || 'Unassigned',
        dueDate: data.due_date ? new Date(data.due_date) : null,
        project: data.project?.id || 'no-project',
        tags: data.labels || [],
        estimatedHours: data.estimated_hours,
        subtasks: [],
        progress: 0,
        comments: [],
        archived: Boolean((data as any).is_archived) || false,
        position: (data as any).position ?? undefined,
        coverUrl: (data as any).cover_url ?? undefined,
      };

      setTasks(prev => [...prev, newTask]);
      toast({ title: 'Task Created', description: `Successfully created task: ${taskData.title}` });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ title: 'Error', description: 'Failed to create task. Please try again.', variant: 'destructive' });
    }
  };

  if (!canAccessPM) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <SubscriptionUpgrade 
          featureName="Project Management" 
          onUpgrade={() => window.location.reload()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const statusColumns = (projects.find(p => p.id === selectedProject && selectedProject !== 'all')?.customColumns || [
    { id: 'backlog', title: 'Backlog', color: 'bg-gray-100', order: 1 },
    { id: 'todo', title: 'To Do', color: 'bg-blue-100', order: 2 },
    { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-100', order: 3 },
    { id: 'review', title: 'Review', color: 'bg-purple-100', order: 4 },
    { id: 'done', title: 'Done', color: 'bg-green-100', order: 5 }
  ]).sort((a,b)=>a.order - b.order);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = selectedProject === 'all' || task.project === selectedProject;
    const notArchived = !task.archived;
    return matchesSearch && matchesProject && notArchived;
  });

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    const payload = JSON.stringify({ type: 'card', taskId: task.id, fromCol: task.status });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, columnId: string, beforeTaskId?: string) => {
    e.preventDefault();
    const j = e.dataTransfer.getData('application/json');
    if (!j) return;
    const data = JSON.parse(j);
    if (data.type !== 'card') return;
    const taskId = data.taskId as string;
    const fromCol = data.fromCol as string;
    handleTaskMove(taskId, fromCol, columnId, beforeTaskId);
  };

  // Handle task status updates  
  const handleTaskStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('todos').update({ status: newStatus }).eq('id', taskId);
      if (error) throw error;

      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status: newStatus as any } : task));
      toast({ title: "Task Updated", description: `Task status changed to ${newStatus}` });
    } catch {
      toast({ title: "Error", description: "Failed to update task status.", variant: "destructive" });
    }
  };

  // Handle task deletion
  const handleTaskDelete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast({ title: "Task Deleted", description: `Task "${task.title}" has been deleted` });
  };

  // Handle full move with ordering
  const handleTaskMove = async (taskId: string, fromCol: string, toCol: string, beforeTaskId?: string) => {
    setColumnTaskOrder(prev => {
      const next = { ...prev };
      next[fromCol] = (next[fromCol] || []).filter(id => id !== taskId);
      const dest = new Set(next[toCol] || []);
      if (!dest.has(taskId)) {
        const arr = next[toCol] ? [...next[toCol]] : [];
        if (beforeTaskId) {
          const idx = arr.indexOf(beforeTaskId);
          if (idx >= 0) arr.splice(idx, 0, taskId); else arr.push(taskId);
        } else {
          arr.push(taskId);
        }
        next[toCol] = arr;
      }
      return next;
    });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: toCol as any } : t));
    try {
      const pos = (columnTaskOrder[toCol] || []).indexOf(taskId);
      const updateData: any = { status: toCol };
      if (!isNaN(pos) && pos >= 0) updateData.position = pos;
      await supabase.from('todos').update(updateData).eq('id', taskId);
    } catch (e) {
      console.warn('Move persist failed', e);
    }
  };

  const EnhancedKanbanBoard = () => {
    const currentProject = projects.find(p => p.id === selectedProject);
    const isFav = favoriteBoards[selectedProject] || false;
    const toggleFav = () => setFavoriteBoards(prev => ({ ...prev, [selectedProject]: !prev[selectedProject] }));

    const handleAddList = async () => {
      const title = newListTitle.trim();
      if (!title || selectedProject === 'all') return;
      const nextOrder = (currentProject?.customColumns || statusColumns).length + 1;
      const newCol: KanbanColumn = { id: `list-${Date.now()}`, title, color: 'bg-gray-100', order: nextOrder };
      setProjects(prev => prev.map(p => p.id === selectedProject ? { ...p, customColumns: [ ...(p.customColumns || statusColumns), newCol ] } : p));
      setListComposerOpen(false); 
      setNewListTitle('');
      try {
        await supabase.from('projects').update({ custom_columns: [ ...((currentProject?.customColumns)||statusColumns), newCol ] as any }).eq('id', selectedProject);
      } catch(e) { 
        console.warn('Add list persist failed', e); 
      }
    };

    const openCardComposer = (colId: string) => setCardComposerOpen(prev => ({ ...prev, [colId]: true }));
    const closeCardComposer = (colId: string) => setCardComposerOpen(prev => ({ ...prev, [colId]: false }));
    const updateCardTitle = (colId: string, v: string) => setNewCardTitle(prev => ({ ...prev, [colId]: v }));
    const addCard = async (colId: string) => {
      const title = (newCardTitle[colId] || '').trim();
      if (!title) return;
      await handleCreateTask({ title, status: colId });
      updateCardTitle(colId, '');
      closeCardComposer(colId);
    };

    return (
      <div className="space-y-4">
        {/* Board Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={toggleFav}>
              <Star className={`w-4 h-4 ${isFav ? 'text-yellow-500 fill-yellow-500' : ''}`} />
            </Button>
            <h2 className="text-xl font-semibold">
              {currentProject ? currentProject.name : 'All Projects'}
            </h2>
            {selectedTaskIds.size > 0 && (
              <div className="ml-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs">
                <span>{selectedTaskIds.size} selected</span>
                <Select onValueChange={(newStatus:any)=>{
                  const ids = Array.from(selectedTaskIds);
                  ids.forEach(id => handleTaskStatusUpdate(id, newStatus));
                  setSelectedTaskIds(new Set());
                }}>
                  <SelectTrigger className="h-7 w-[130px]"><SelectValue placeholder="Move to..." /></SelectTrigger>
                  <SelectContent>
                    {statusColumns.map(col => <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={()=>{
                  const ids = Array.from(selectedTaskIds);
                  ids.forEach(id => handleTaskArchive(id));
                  setSelectedTaskIds(new Set());
                }}>Archive</Button>
                <Button size="sm" variant="outline" onClick={()=>setSelectedTaskIds(new Set())}>Clear</Button>
              </div>
            )}
            {currentProject && (
              <div className="flex -space-x-2 ml-2">
                {currentProject.members.slice(0,4).map(m => (
                  <Avatar key={m} className="w-6 h-6 border">
                    <AvatarFallback className="text-[10px]">{m.split(' ').map(n=>n[0]).join('')}</AvatarFallback>
                  </Avatar>
                ))}
                {currentProject.members.length > 4 && (
                  <Badge variant="secondary" className="ml-2">+{currentProject.members.length - 4}</Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={()=>setShowBoardCustomizer(true)}>
              <Settings className="w-4 h-4 mr-2" /> Customize
            </Button>
            <Button variant="outline" size="sm" onClick={()=>setShowAutomationBuilder(true)}>
              <Zap className="w-4 h-4 mr-2" /> Automations
            </Button>
          </div>
        </div>

        {/* Lists horizontally scrollable */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-4 min-h-[70vh]">
            {statusColumns.map(column => {
              const columnTasks = filteredTasks.filter(task => task.status === column.id);
              const order = columnTaskOrder[column.id] || [];
              columnTasks.sort((a,b) => {
                const ia = order.indexOf(a.id);
                const ib = order.indexOf(b.id);
                return (ia === -1 ? 1 : ia) - (ib === -1 ? 1 : ib);
              });
              const limit = wipLimits[column.id] ?? (column as any).wipLimit ?? 999;
              const isOver = columnTasks.length > limit;
              const composerOpen = cardComposerOpen[column.id];
              
              return (
                <div key={column.id} className={`w-80 flex-shrink-0 ${isOver ? 'ring-2 ring-red-400 rounded' : ''}`} 
                     onDragOver={handleDragOver} 
                     onDrop={(e)=>handleDrop(e, column.id)}>
                  <div className="px-3 py-2 bg-gray-100 rounded-t flex items-center justify-between">
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {column.title}
                      <Badge variant={isOver ? 'destructive' : 'secondary'} className="text-[10px]">
                        {columnTasks.length}/{limit===999?'∞':limit}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e)=>{ e.stopPropagation(); openCardComposer(column.id); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="bg-gray-50 p-2 space-y-2">
                    {columnTasks.map(task => (
                      <div key={task.id} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e, column.id, task.id)}>
                        <Card className={`cursor-pointer hover:shadow transition ${selectedTaskIds.has(task.id) ? 'ring-2 ring-blue-400' : ''}`} 
                              draggable 
                              onDragStart={(e)=>handleDragStart(e, task)} 
                              onClick={(e)=>{ 
                                e.preventDefault(); 
                                setLastFocusedTaskId(task.id); 
                                if (e.metaKey || e.ctrlKey) { 
                                  const s = new Set(selectedTaskIds); 
                                  s.has(task.id) ? s.delete(task.id) : s.add(task.id); 
                                  setSelectedTaskIds(s); 
                                } else { 
                                  setEditingTask(task); 
                                  setShowEditTask(true); 
                                } 
                              }}>
                          <CardContent className="p-3">
                            {task.coverUrl && (
                              <div className="mb-2 overflow-hidden rounded">
                                <img src={task.coverUrl} alt="cover" className="w-full h-24 object-cover" />
                              </div>
                            )}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex gap-1 mb-2">
                                {task.tags.slice(0,4).map(tag => (
                                  <span key={tag} className={`${getTagColor(tag)} h-1.5 w-8 rounded`}></span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-sm">{task.title}</h4>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={(e)=>e.stopPropagation()}>
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-40 p-1" align="end">
                                  <div className="space-y-1">
                                    <Button variant="ghost" size="sm" className="w-full justify-start" 
                                            onClick={()=>{ setEditingTask(task); setShowEditTask(true); }}>
                                      <Edit className="w-3 h-3 mr-2" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" 
                                            onClick={()=>{ setLabelsTask(task); setLabelsDialogOpen(true); }}>
                                      <TagIcon className="w-3 h-3 mr-2" /> Labels
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" 
                                            onClick={()=>handleTaskArchive(task.id)}>
                                      <FolderOpen className="w-3 h-3 mr-2" /> Archive
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:text-red-700" 
                                            onClick={()=>handleTaskDelete(task.id)}>
                                      <Trash2 className="w-3 h-3 mr-2" /> Delete
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            {task.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{task.description}</p>}
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-gray-500">
                                {task.attachments && task.attachments.length > 0 && <Paperclip className="w-3 h-3" />}
                                {task.comments && task.comments.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3" />
                                    <span className="text-[10px]">{task.comments.length}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {task.dueDate && (
                                  <div className="flex items-center gap-1 text-gray-500">
                                    <CalendarIcon className="w-3 h-3" />
                                    <span className="text-[10px]">{format(task.dueDate, 'MMM dd')}</span>
                                  </div>
                                )}
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="text-[10px]">
                                    {task.assignee.split(' ').map(n=>n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}

                    {/* Card composer */}
                    {composerOpen ? (
                      <div className="bg-white rounded border p-2 space-y-2">
                        <Input placeholder="Card title" 
                               value={newCardTitle[column.id] || ''} 
                               onChange={(e)=>updateCardTitle(column.id, e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={()=>addCard(column.id)}>Add card</Button>
                          <Button size="sm" variant="ghost" onClick={()=>closeCardComposer(column.id)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="w-full justify-start" 
                              onClick={()=>openCardComposer(column.id)}>
                        <Plus className="w-4 h-4 mr-1" /> Add a card
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add list composer */}
            {selectedProject !== 'all' && (
              <div className="w-80 flex-shrink-0">
                {listComposerOpen ? (
                  <div className="bg-gray-50 p-2 rounded border space-y-2">
                    <Input placeholder="List title" value={newListTitle} onChange={(e)=>setNewListTitle(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddList}>Add list</Button>
                      <Button size="sm" variant="ghost" onClick={()=>{ setListComposerOpen(false); setNewListTitle(''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full justify-start" onClick={()=>setListComposerOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Add another list
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management</h1>
          <p className="text-muted-foreground">Manage your projects and tasks efficiently</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateProject(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button variant="outline" onClick={() => setShowCreateTask(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold">{tasks.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Clock className="w-8 h-8 text-yellow-600" />
                  <div>
                    <p className="text-sm text-gray-600">In Progress</p>
                    <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in-progress').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'done').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {projects.map(project => (
              <Card key={project.id}>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <p className="text-sm text-gray-600 mt-2">{project.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm">{project.progress}% complete</span>
                    <Badge variant="secondary">{project.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="board">
          <EnhancedKanbanBoard />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <Card key={task.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant={task.priority === 'urgent' ? 'destructive' : 'secondary'}>
                      {task.priority}
                    </Badge>
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{task.status}</Badge>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {task.assignee.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateTodoDialog 
        isOpen={showCreateTask} 
        onOpenChange={setShowCreateTask} 
        onCreateTodo={handleCreateTask} 
      />
      
      {editingTask && (
        <CreateTodoDialog
          isOpen={showEditTask}
          onOpenChange={setShowEditTask}
          editTask={editingTask}
          onCreateTodo={(taskData) => {
            setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...editingTask, ...taskData } : t));
            setShowEditTask(false);
            setEditingTask(null);
            toast({ title: "Task Updated", description: "Task updated successfully." });
          }}
        />
      )}

      <CreateProjectDialog
        isOpen={showCreateProject}
        onOpenChange={setShowCreateProject}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
};

export default ProjectManagement;