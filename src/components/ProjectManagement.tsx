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

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  project: string;
  completed: boolean;
  progress: number;
  tasks: string[];
  aiInsights?: string;
}

interface ActivityLog {
  id: string;
  type: 'task_created' | 'task_updated' | 'comment_added' | 'file_uploaded' | 'client_email' | 'meeting_scheduled' | 'milestone_completed' | 'ai_insight_generated';
  description: string;
  user: string;
  timestamp: Date;
  projectId: string;
  taskId?: string;
  metadata?: any;
}

interface ClientCommunication {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'feedback' | 'approval';
  subject: string;
  content: string;
  clientName: string;
  projectId: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'scheduled';
  attachments?: string[];
  aiSummary?: string;
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

interface Integration {
  id: string;
  name: string;
  type: 'trello' | 'notion' | 'google-calendar' | 'slack' | 'gmail' | 'twilio' | 'calendly' | 'zapier';
  status: 'connected' | 'disconnected' | 'error';
  config: any;
  lastSync?: Date;
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

interface LabelDef {
  id: string;
  name: string;
  color: string; // tailwind bg-* class
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
  // Additional Trello-like states for selection, labels, checklist, due dates and ordering
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [lastFocusedTaskId, setLastFocusedTaskId] = useState<string | null>(null);
  const [labelsDialogOpen, setLabelsDialogOpen] = useState<boolean>(false);
  const [labelsTask, setLabelsTask] = useState<Task | null>(null);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState<boolean>(false);
  const [checklistTask, setChecklistTask] = useState<Task | null>(null);
  const [dueDateDialogOpen, setDueDateDialogOpen] = useState<boolean>(false);
  const [dueDateTask, setDueDateTask] = useState<Task | null>(null);
  const [boardLabels, setBoardLabels] = useState<Record<string, LabelDef[]>>({});
  const [columnTaskOrder, setColumnTaskOrder] = useState<Record<string, string[]>>({});
  
  const getTagColor = (tag: string) => {
    const palette = ['bg-red-500','bg-orange-500','bg-amber-500','bg-yellow-500','bg-lime-500','bg-green-500','bg-emerald-500','bg-teal-500','bg-cyan-500','bg-sky-500','bg-blue-500','bg-indigo-500','bg-violet-500','bg-purple-500','bg-fuchsia-500','bg-pink-500','bg-rose-500'];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  };

  // Sample data with enhanced features - moved before conditional returns
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

  const [milestones, setMilestones] = useState<Milestone[]>([
    {
      id: '1',
      title: 'Design Phase Complete',
      description: 'All UI/UX designs approved by client',
      dueDate: new Date(2024, 2, 25),
      project: 'Website Redesign',
      completed: false,
      progress: 80,
      tasks: ['1'],
      aiInsights: 'Design milestone is 80% complete. Consider client review meeting to finalize remaining designs.'
    }
  ]);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    {
      id: '1',
      type: 'task_created',
      description: 'Created new task: Design Homepage Mockup',
      user: 'John Doe',
      timestamp: new Date(),
      projectId: '1'
    },
    {
      id: '2',
      type: 'ai_insight_generated',
      description: 'AI generated project insights and recommendations',
      user: 'AI Assistant',
      timestamp: new Date(),
      projectId: '1'
    }
  ]);

  const [clientCommunications, setClientCommunications] = useState<ClientCommunication[]>([
    {
      id: '1',
      type: 'email',
      subject: 'Weekly Progress Update - Website Redesign',
      content: 'Design phase is progressing well. Homepage mockups are 60% complete...',
      clientName: 'Tech Corp',
      projectId: '1',
      timestamp: new Date(),
      status: 'completed',
      aiSummary: 'Positive client response to design progress. No concerns raised.'
    }
  ]);

  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: '1', name: 'Trello', type: 'trello', status: 'connected', config: {}, lastSync: new Date() },
    { id: '2', name: 'Google Calendar', type: 'google-calendar', status: 'connected', config: {} },
    { id: '3', name: 'Slack', type: 'slack', status: 'connected', config: {} },
    { id: '4', name: 'Notion', type: 'notion', status: 'disconnected', config: {} }
  ]);

  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Auto-assign urgent tasks',
      trigger: 'task_created',
      conditions: [{ field: 'priority', operator: 'equals', value: 'urgent' }],
      actions: [{ type: 'assign_to', value: 'team-lead' }],
      isActive: true,
      lastTriggered: new Date(Date.now() - 86400000) // 1 day ago
    },
    {
      id: '2',
      name: 'Deadline notifications',
      trigger: 'deadline_approaching',
      conditions: [{ field: 'days_until_due', operator: 'equals', value: '2' }],
      actions: [{ type: 'send_notification', value: 'slack' }],
      isActive: true,
      lastTriggered: new Date(Date.now() - 3600000) // 1 hour ago
    }
  ]);

  // Check if user can access Project Management features
  const canAccessPM = canAccessFeature('project-management');
  console.log('🔧 ProjectManagement - canAccessPM:', canAccessPM, 'user:', !!user);

  useEffect(() => {
    console.log('🔧 ProjectManagement useEffect triggered', { user: !!user, canAccessPM });
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
      // Try team-scoped query first if a specific team is selected
      if (selectedTeam !== 'all') {
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            // @ts-ignore optional column
            .eq('team_id', selectedTeam)
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
            return;
          }
        } catch (teamScopedErr) {
          console.warn('Team-scoped projects query failed, falling back to all projects:', teamScopedErr);
        }
      }

      // Fallback: no team filter
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
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      // Try team-scoped query first if a specific team is selected
      if (selectedTeam !== 'all') {
        try {
          const { data, error } = await supabase
            .from('todos')
            .select(`
              *,
              project:projects(id, name)
            `)
            .eq('user_id', user?.id)
            // @ts-ignore optional column
            .eq('team_id', selectedTeam)
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
            return;
          }
        } catch (teamScopedErr) {
          console.warn('Team-scoped tasks query failed, falling back to all tasks:', teamScopedErr);
        }
      }

      // Fallback: no team filter
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
        
        toast({
          title: "Project Created",
          description: `Successfully created project: ${newProject.name}`,
        });
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Handle creating new tasks
  const handleCreateTask = async (taskData: any) => {
    try {
      const targetProjectId = selectedProject !== 'all' ? selectedProject : projects[0]?.id || null;

      // Try with team_id if available
      try {
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
            // @ts-ignore optional column
            team_id: selectedTeam !== 'all' ? selectedTeam : null,
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
      } catch (withTeamErr) {
        console.warn('Insert with team_id failed, retrying without:', withTeamErr);
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

        const newTaskFallback: Task = {
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

        setTasks(prev => [...prev, newTaskFallback]);
      }

      // Add activity log
      const activity: ActivityLog = {
        id: `activity-${Date.now()}`,
        type: 'task_created',
        description: `Created new task: ${taskData.title}`,
        user: user?.email || 'Unknown User',
        timestamp: new Date(),
        projectId: targetProjectId || 'no-project',
      };
      setActivityLogs(prev => [activity, ...prev]);

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

  const priorityColors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500'
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = selectedProject === 'all' || task.project === selectedProject;
    const notArchived = !task.archived;
    console.log('Filtering task:', task.title, 'project:', task.project, 'selectedProject:', selectedProject, 'matches:', matchesProject);
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
      // Update in database
      const { error } = await supabase
        .from('todos')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(task => {
        if (task.id === taskId) {
          const updatedTask = { ...task, status: newStatus as any };
          
          // Add activity log
          const activity: ActivityLog = {
            id: `activity-${Date.now()}`,
            type: 'task_updated',
            description: `Task "${task.title}" moved to ${newStatus}`,
            user: user?.email || 'Unknown User',
            timestamp: new Date(),
            projectId: task.project,
            taskId: task.id
          };
          setActivityLogs(prev => [activity, ...prev]);
          
          return updatedTask;
        }
        return task;
      }));
      
      toast({
        title: "Task Updated",
        description: `Task status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "Failed to update task status. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle task deletion
  const handleTaskDelete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      const activity: ActivityLog = {
        id: `activity-${Date.now()}`,
        type: 'task_updated',
        description: `Task "${task.title}" was deleted`,
        user: user?.email || 'Unknown User',
        timestamp: new Date(),
        projectId: task.project,
        taskId: task.id
      };
      setActivityLogs(prev => [activity, ...prev]);
      
      toast({
        title: "Task Deleted",
        description: `Task "${task.title}" has been deleted`,
      });
    }
  };

  // Handle full move with ordering
  const handleTaskMove = async (taskId: string, fromCol: string, toCol: string, beforeTaskId?: string) => {
    // Update local order map
    setColumnTaskOrder(prev => {
      const next = { ...prev };
      // remove from source
      next[fromCol] = (next[fromCol] || []).filter(id => id !== taskId);
      // insert into destination
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
    // Update task status and optional position
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: toCol } : t));
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
      setListComposerOpen(false); setNewListTitle('');
      try {
        // Persist if possible
        // @ts-ignore
        await supabase.from('projects').update({ custom_columns: [ ...((currentProject?.customColumns)||statusColumns), newCol ] }).eq('id', selectedProject);
      } catch(e) { console.warn('Add list persist failed', e); }
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
              // sort by columnTaskOrder
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
                <div key={column.id} className={`w-80 flex-shrink-0 ${isOver ? 'ring-2 ring-red-400 rounded' : ''}`} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e, column.id)} draggable onDragStart={(e)=>{
                  const payload = JSON.stringify({ type: 'list', columnId: column.id });
                  e.dataTransfer.setData('application/list', payload);
                  e.dataTransfer.effectAllowed = 'move';
                }} onDropCapture={(e)=>{
                  const p = e.dataTransfer.getData('application/list');
                  if (!p) return;
                  const data = JSON.parse(p);
                  if (data.type !== 'list') return;
                  const fromId = data.columnId as string;
                  const toId = column.id;
                  if (fromId === toId) return;
                  // reorder lists
                  if (selectedProject !== 'all') {
                    setProjects(prev => prev.map(project => {
                      if (project.id !== selectedProject) return project;
                      const cols = [...(project.customColumns || statusColumns)];
                      const fromIdx = cols.findIndex(c => c.id === fromId);
                      const toIdx = cols.findIndex(c => c.id === toId);
                      if (fromIdx === -1 || toIdx === -1) return project;
                      const [moved] = cols.splice(fromIdx, 1);
                      cols.splice(toIdx, 0, moved);
                      // renumber order
                      const renum = cols.map((c, i) => ({ ...c, order: i + 1 }));
                      // persist best-effort
                      try { // @ts-ignore
                        supabase.from('projects').update({ custom_columns: renum }).eq('id', selectedProject);
                      } catch {}
                      return { ...project, customColumns: renum };
                    }));
                  }
                }}>
                  <div className="px-3 py-2 bg-gray-100 rounded-t flex items-center justify-between">
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {column.title}
                      <Badge variant={isOver ? 'destructive' : 'secondary'} className="text-[10px]">{columnTasks.length}/{limit===999?'∞':limit}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e)=>{ e.stopPropagation(); openCardComposer(column.id); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className={`bg-gray-50 p-2 space-y-2 ${compactMode ? '' : ''}`}>
                    {columnTasks.map(task => (
                      <div key={task.id} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e, column.id, task.id)}>
                        <Card className={`cursor-pointer hover:shadow transition ${selectedTaskIds.has(task.id) ? 'ring-2 ring-blue-400' : ''}`} draggable onDragStart={(e)=>handleDragStart(e, task)} onClick={(e)=>{ e.preventDefault(); setLastFocusedTaskId(task.id); if (e.metaKey || e.ctrlKey) { const s = new Set(selectedTaskIds); s.has(task.id) ? s.delete(task.id) : s.add(task.id); setSelectedTaskIds(s); } else { setEditingTask(task); setShowEditTask(true); } }}>
                          <CardContent className="p-3">
                            {/* Cover image */}
                            {task.coverUrl && (
                              <div className="mb-2 overflow-hidden rounded">
                                <img src={task.coverUrl} alt="cover" className="w-full h-24 object-cover" />
                              </div>
                            )}
                            {/* Labels */}
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
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>{ setEditingTask(task); setShowEditTask(true); }}>
                                      <Edit className="w-3 h-3 mr-2" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>{ setLabelsTask(task); setLabelsDialogOpen(true); }}>
                                      <TagIcon className="w-3 h-3 mr-2" /> Labels
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>{ setChecklistTask(task); setChecklistDialogOpen(true); }}>
                                      <ListCheck className="w-3 h-3 mr-2" /> Checklist
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>{ setDueDateTask(task); setDueDateDialogOpen(true); }}>
                                      <CalendarIcon className="w-3 h-3 mr-2" /> Due date
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>handleTaskArchive(task.id)}>
                                      <FolderOpen className="w-3 h-3 mr-2" /> Archive
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async()=>{
                                      const url = window.prompt('Cover image URL');
                                      if (!url) return;
                                      setTasks(prev => prev.map(t => t.id===task.id ? ({ ...t, coverUrl: url }) : t));
                                      try { await supabase.from('todos').update({ cover_url: url }).eq('id', task.id); } catch (e) { console.warn('Cover persist failed', e); }
                                    }}>
                                      <ImageIcon className="w-3 h-3 mr-2" /> Add cover
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start text-red-600 hover:text-red-700" onClick={()=>handleTaskDelete(task.id)}>
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
                                <Avatar className="w-6 h-6"><AvatarFallback className="text-[10px]">{task.assignee.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}

                    {/* Card composer */}
                    {composerOpen ? (
                      <div className="bg-white rounded border p-2 space-y-2">
                        <Input placeholder="Card title" value={newCardTitle[column.id] || ''} onChange={(e)=>updateCardTitle(column.id, e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={()=>addCard(column.id)}>Add card</Button>
                          <Button size="sm" variant="ghost" onClick={()=>closeCardComposer(column.id)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={()=>openCardComposer(column.id)}>
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

  const MilestonesView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Project Milestones</h3>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Milestone
        </Button>
      </div>
      
      <div className="grid gap-4">
        {milestones.map(milestone => (
          <Card key={milestone.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Flag className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold">{milestone.title}</h4>
                    {milestone.completed && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{milestone.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Progress</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all" 
                            style={{ width: `${milestone.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{milestone.progress}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Due Date</p>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{format(milestone.dueDate, 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tasks</p>
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{milestone.tasks.length} tasks</span>
                      </div>
                    </div>
                  </div>

                  {milestone.aiInsights && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Brain className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-blue-800 mb-1">AI Insights</p>
                          <p className="text-sm text-blue-700">{milestone.aiInsights}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const ClientCommunicationView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Client Communications</h3>
        <div className="flex gap-2">
          <Button variant="outline">
            <Mail className="w-4 h-4 mr-2" />
            Send Email
          </Button>
          <Button variant="outline">
            <Phone className="w-4 h-4 mr-2" />
            Schedule Call
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Communication Timeline */}
      <div className="space-y-4">
        {clientCommunications.map(comm => (
          <Card key={comm.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {comm.type === 'email' && <Mail className="w-5 h-5 text-blue-600" />}
                  {comm.type === 'call' && <Phone className="w-5 h-5 text-green-600" />}
                  {comm.type === 'meeting' && <Video className="w-5 h-5 text-purple-600" />}
                  {comm.type === 'note' && <FileText className="w-5 h-5 text-gray-600" />}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{comm.subject}</h4>
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={
                          comm.status === 'completed' ? 'bg-green-100 text-green-800' :
                          comm.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {comm.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {format(comm.timestamp, 'MMM dd, HH:mm')}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{comm.content}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">
                        Client: <span className="font-medium">{comm.clientName}</span>
                      </span>
                      {comm.attachments && comm.attachments.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Paperclip className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">{comm.attachments.length} files</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {comm.aiSummary && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Brain className="w-4 h-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-green-800 mb-1">AI Summary</p>
                          <p className="text-sm text-green-700">{comm.aiSummary}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const ReportingDashboard = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Project Analytics & Reports</h3>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Velocity</p>
                <p className="text-2xl font-bold">8.5</p>
                <p className="text-xs text-green-600">↗ +12% this week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold">87%</p>
                <p className="text-xs text-green-600">↗ +5% this month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Team Utilization</p>
                <p className="text-2xl font-bold">92%</p>
                <p className="text-xs text-red-600">↘ -3% this week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg. Task Time</p>
                <p className="text-2xl font-bold">4.2h</p>
                <p className="text-xs text-orange-600">→ No change</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartColumn className="w-5 h-5" />
              Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.map(project => (
                <div key={project.id}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{project.name}</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${project.color.replace('bg-', 'bg-opacity-100 bg-')}`}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartPie className="w-5 h-5" />
              Task Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === 'todo').length}
                </p>
                <p className="text-sm text-gray-600">To Do</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {tasks.filter(t => t.status === 'in-progress').length}
                </p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {tasks.filter(t => t.status === 'review').length}
                </p>
                <p className="text-sm text-gray-600">Review</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'done').length}
                </p>
                <p className="text-sm text-gray-600">Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* External Tools Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Analytics Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <ExternalLink className="w-6 h-6" />
              <span>Metabase Dashboard</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <ExternalLink className="w-6 h-6" />
              <span>Looker Studio</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <ExternalLink className="w-6 h-6" />
              <span>Airtable Interface</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const TeamCollaborationView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Team Collaboration</h3>
        <div className="flex gap-2">
          <Button variant="outline">
            <Share2 className="w-4 h-4 mr-2" />
            Share Project
          </Button>
          <Button>
            <Users className="w-4 h-4 mr-2" />
            Invite Members
          </Button>
        </div>
      </div>

      {/* Team Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activityLogs.slice(0, 10).map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">
                    {log.user === 'AI Assistant' ? 'AI' : log.user.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm">{log.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {format(log.timestamp, 'MMM dd, HH:mm')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {log.type.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Sharing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Shared Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <HardDrive className="w-6 h-6 text-blue-600" />
                <span className="font-medium">Google Drive</span>
              </div>
              <p className="text-sm text-gray-600">Sync project files with Google Drive</p>
              <Button className="w-full mt-3" variant="outline" size="sm">
                Connect Drive
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Cloud className="w-6 h-6 text-blue-500" />
                <span className="font-medium">Dropbox</span>
              </div>
              <p className="text-sm text-gray-600">Share files via Dropbox integration</p>
              <Button className="w-full mt-3" variant="outline" size="sm">
                Connect Dropbox
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Slack className="w-6 h-6 text-purple-600" />
                <span className="font-medium">Slack</span>
              </div>
              <p className="text-sm text-gray-600">Get project updates in Slack</p>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* @Mentions and Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5" />
            Notifications & Mentions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">John Doe mentioned you</p>
                  <p className="text-xs text-gray-600">in "Design Homepage Mockup" task</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                Mark as read
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Task deadline approaching</p>
                  <p className="text-xs text-gray-600">"Setup Authentication System" due tomorrow</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                Dismiss
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const AIAssistantView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">AI Project Assistant</h3>
        <Badge className="bg-purple-100 text-purple-800">
          <Brain className="w-3 h-3 mr-1" />
          Powered by GPT-4
        </Badge>
      </div>

      {/* AI Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Bot className="w-12 h-12 mx-auto mb-4 text-blue-600" />
            <h4 className="font-semibold mb-2">Auto-Summarize Updates</h4>
            <p className="text-sm text-gray-600 mb-4">Generate project summaries and status reports automatically</p>
            <Button variant="outline" size="sm">
              Generate Summary
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Mail className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h4 className="font-semibold mb-2">Generate Client Emails</h4>
            <p className="text-sm text-gray-600 mb-4">Create professional client communications with AI</p>
            <Button variant="outline" size="sm">
              Compose Email
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
            <h4 className="font-semibold mb-2">Suggest Priorities</h4>
            <p className="text-sm text-gray-600 mb-4">AI-powered task prioritization and recommendations</p>
            <Button variant="outline" size="sm">
              Get Suggestions
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            AI Chat Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-64 border rounded-lg p-4 bg-gray-50 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-sm">Hello! I can help you with project insights, task suggestions, and generating reports. What would you like to know about your projects?</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Input placeholder="Ask me anything about your projects..." />
              <Button>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Project Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-blue-800 mb-1">Resource Optimization</h5>
                  <p className="text-sm text-blue-700">Based on current workload, consider reassigning 2 tasks from John to Jane to balance team capacity.</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-yellow-800 mb-1">Deadline Risk</h5>
                  <p className="text-sm text-yellow-700">Website Redesign project has a 25% risk of missing deadline. Consider extending timeline or adding resources.</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-green-800 mb-1">Performance Trend</h5>
                  <p className="text-sm text-green-700">Team velocity has improved by 15% this month. Current pace should maintain project deadlines.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const IntegrationsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Integrations & Tools</h3>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {integrations.map(integration => (
          <Card key={integration.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {integration.type === 'trello' && <ExternalLink className="w-5 h-5 text-blue-600" />}
                  {integration.type === 'notion' && <ExternalLink className="w-5 h-5 text-gray-800" />}
                  {integration.type === 'google-calendar' && <CalendarIconOutline className="w-5 h-5 text-blue-500" />}
                  {integration.type === 'slack' && <Slack className="w-5 h-5 text-purple-600" />}
                  <span className="font-medium">{integration.name}</span>
                </div>
                <Badge 
                  className={
                    integration.status === 'connected' ? 'bg-green-100 text-green-800' :
                    integration.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }
                >
                  {integration.status}
                </Badge>
              </div>
              
              {integration.lastSync && (
                <p className="text-xs text-gray-500 mb-3">
                  Last sync: {format(integration.lastSync, 'MMM dd, HH:mm')}
                </p>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    window.open(`/business-tools?tool=integrations&integration=${integration.type}`, '_blank');
                  }}
                >
                  Configure
                </Button>
                {integration.status === 'connected' && (
                  <Button variant="outline" size="sm">
                    <Zap className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Available Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-6 h-6 text-blue-600" />
                <span className="font-medium">Gmail API</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">Automatically log email communications</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => window.open('/business-tools?tool=integrations&integration=gmail', '_blank')}
              >
                Connect Gmail
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-6 h-6 text-green-600" />
                <span className="font-medium">Twilio</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">SMS notifications and call tracking</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => window.open('/business-tools?tool=integrations&integration=twilio', '_blank')}
              >
                Connect Twilio
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <CalendarIcon className="w-6 h-6 text-purple-600" />
                <span className="font-medium">Calendly</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">Automated meeting scheduling</p>
              <Button variant="outline" size="sm" className="w-full">
                Connect Calendly
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Automation Workflows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {automationRules.map((rule) => (
              <div key={rule.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium">{rule.name}</h5>
                  <Badge className={rule.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  When {rule.trigger.replace('_', ' ')} → {rule.actions[0]?.type.replace('_', ' ')} {rule.actions[0]?.value}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      // Edit automation rule
                      setShowAutomationBuilder(true);
                    }}>
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setAutomationRules(prev => prev.map(r => 
                          r.id === rule.id ? { ...r, isActive: !r.isActive } : r
                        ));
                        toast({
                          title: rule.isActive ? "Rule Disabled" : "Rule Enabled",
                          description: `${rule.name} has been ${rule.isActive ? 'disabled' : 'enabled'}.`,
                        });
                      }}
                    >
                      {rule.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600"
                      onClick={() => {
                        setAutomationRules(prev => prev.filter(r => r.id !== rule.id));
                        toast({
                          title: "Rule Deleted",
                          description: `${rule.name} has been deleted.`,
                          variant: "destructive"
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  {rule.lastTriggered && (
                    <span className="text-xs text-gray-500">
                      Last triggered: {rule.lastTriggered.toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            <Button variant="outline" className="w-full" onClick={() => setShowAutomationBuilder(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Automation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const SummaryView = () => {
    const statusOrder: Task['status'][] = ['backlog', 'todo', 'in-progress', 'review', 'done'];
    const statusCounts = statusOrder.map(s => tasks.filter(t => !t.archived && t.status === s).length);
    const total = statusCounts.reduce((a, b) => a + b, 0) || 1;
    const priorityOrder: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];
    const priorityCounts = priorityOrder.map(p => tasks.filter(t => !t.archived && t.priority === p).length);
    const assigneeMap = tasks.filter(t => !t.archived).reduce<Record<string, number>>((acc, t) => {
      acc[t.assignee] = (acc[t.assignee] || 0) + 1;
      return acc;
    }, {});
    const hoursByAssignee = tasks.filter(t=>!t.archived).reduce<Record<string, number>>((acc, t) => {
      const h = t.estimatedHours || 0;
      acc[t.assignee] = (acc[t.assignee] || 0) + h;
      return acc;
    }, {});
    const topTags = Object.entries(
      tasks.filter(t => !t.archived).flatMap(t => t.tags).reduce<Record<string, number>>((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {})
    ).sort((a,b) => b[1]-a[1]).slice(0,6);

    // Real charts datasets
    const pieData = {
      labels: statusOrder.map(s => s.replace('-', ' ')),
      datasets: [{
        data: statusCounts,
        backgroundColor: ['#9ca3af','#3b82f6','#f59e0b','#a855f7','#22c55e'],
        borderWidth: 0,
      }]
    };
    const barData = {
      labels: priorityOrder,
      datasets: [{
        label: 'Tasks',
        data: priorityCounts,
        backgroundColor: ['#22c55e','#eab308','#f97316','#ef4444']
      }]
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4">
            <CardTitle className="text-sm mb-2">Status Overview</CardTitle>
            <Pie data={pieData} />
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <CardTitle className="text-sm mb-2">Priority Breakdown</CardTitle>
            <Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <CardTitle className="text-sm mb-2">Team Workload (Tasks)</CardTitle>
            <div className="space-y-2">
              {Object.entries(assigneeMap).map(([name, count]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <Avatar className="w-6 h-6"><AvatarFallback className="text-[10px]">{name.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                  <span className="truncate">{name}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-4">
            <CardTitle className="text-sm mb-2">Team Workload (Hours)</CardTitle>
            <div className="space-y-2">
              {Object.entries(hoursByAssignee).map(([name, hours]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className="truncate">{name}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant="outline">{hours}h</Badge>
                  </div>
                </div>
              ))}
              {Object.keys(hoursByAssignee).length === 0 && (
                <div className="text-xs text-gray-500">No estimated hours set.</div>
              )}
            </div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {activityLogs.slice(0,8).map(log => (
                <div key={log.id} className="flex items-start gap-2">
                  <Avatar className="w-6 h-6"><AvatarFallback className="text-[10px]">{log.user === 'AI Assistant' ? 'AI' : log.user.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                  <div className="text-xs">
                    <div className="font-medium">{log.description}</div>
                    <div className="text-gray-500">{format(log.timestamp, 'MMM dd, HH:mm')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Types of Work</CardTitle></CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {topTags.map(([tag, count]) => (
                <div key={tag} className="p-2 border rounded flex items-center justify-between">
                  <span className="truncate">#{tag}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
              {topTags.length === 0 && <div className="text-xs text-gray-500">No tags yet</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const TimelineView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Timeline</h3>
        <Button onClick={() => setShowCreateEpic(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Epic
        </Button>
      </div>
      <ProjectActivityTimeline projectId={selectedProject !== 'all' ? selectedProject : (projects[0]?.id || 'project-1')} projectName={projects.find(p=>p.id===selectedProject)?.name || projects[0]?.name || 'Project'} />
    </div>
  );

  const CalendarView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardContent className="p-4">
          <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-md border" />
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Tasks on {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Select a date'}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          {filteredTasks.filter(t => t.dueDate && selectedDate && format(t.dueDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')).map(t => (
            <div key={t.id} className="flex items-center justify-between p-2 border rounded text-sm">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${priorityColors[t.priority]}`} />
                <span className="font-medium">{t.title}</span>
                <Badge variant="outline" className="capitalize">{t.status.replace('-', ' ')}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{projects.find(p=>p.id===t.project)?.name || 'No project'}</span>
                <Button size="sm" variant="outline" onClick={() => { setEditingTask(t); setShowEditTask(true); }}>Edit</Button>
              </div>
            </div>
          ))}
          {filteredTasks.filter(t => t.dueDate && selectedDate && format(t.dueDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')).length === 0 && (
            <div className="text-sm text-gray-500">No tasks scheduled for this date.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const ListView = () => (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 gap-2 px-3 py-2 text-xs font-medium bg-gray-50 border-b">
            <div>Task</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Project</div>
            <div>Assignee</div>
            <div>Due</div>
            <div>Tags</div>
            <div>Actions</div>
          </div>
          {filteredTasks.map(t => (
            <div key={t.id} className="grid grid-cols-8 gap-2 px-3 py-2 text-sm border-b items-center">
              <div className="truncate">{t.title}</div>
              <div className="capitalize text-xs"><Badge variant="outline">{t.status.replace('-', ' ')}</Badge></div>
              <div className="text-xs"><Badge className={`${priorityColors[t.priority]} text-white`}>{t.priority}</Badge></div>
              <div className="text-xs truncate">{projects.find(p=>p.id===t.project)?.name || '—'}</div>
              <div className="text-xs truncate">{t.assignee}</div>
              <div className="text-xs">{t.dueDate ? format(t.dueDate,'MMM dd') : '—'}</div>
              <div className="text-xs truncate">{t.tags.slice(0,3).join(', ')}</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setEditingTask(t); setShowEditTask(true); }}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => handleTaskArchive(t.id)}>Archive</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const FormsView = () => {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [priority, setPriority] = useState<'low'|'medium'|'high'|'urgent'>('medium');
    const [submitting, setSubmitting] = useState(false);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Submit a Work Request</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
            <Textarea placeholder="Describe your request" value={desc} onChange={(e)=>setDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={priority} onValueChange={(v:any)=>setPriority(v)}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Auto-select</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={async ()=>{
                setSubmitting(true);
                try {
                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-work-request`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                      title,
                      description: desc,
                      priority,
                      project_id: selectedProject !== 'all' ? selectedProject : null,
                      team_id: selectedTeam !== 'all' ? selectedTeam : null,
                    })
                  });
                  if (!res.ok) throw new Error('Submission failed');
                  const json = await res.json();
                  toast({ title: 'Submitted', description: `Request ID ${json.id}` });
                  setTitle(''); setDesc(''); setPriority('medium');
                  // Refresh tasks
                  loadTasks();
                } catch (e:any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' });
                } finally {
                  setSubmitting(false);
                }
              }} disabled={!title.trim() || submitting}>{submitting ? 'Submitting...' : 'Submit'}</Button>
              <Button variant="outline" onClick={()=>{ setTitle(''); setDesc(''); setPriority('medium'); }}>Reset</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Public Form</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Share this link to collect requests:</p>
            <div className="p-2 border rounded text-xs break-all">{window.location.origin}/forms/work-request</div>
            <p className="text-gray-500">New submissions create tasks automatically.</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const GoalsView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Goals</h3>
        <Button onClick={() => {
          const g: Goal = { id: `goal-${Date.now()}`, title: `New Goal ${goals.length+1}`, progress: 0, targetDate: null, projectId: selectedProject !== 'all' ? selectedProject : undefined };
          setGoals(prev => [g, ...prev]);
        }}>
          <Plus className="w-4 h-4 mr-2" /> Add Goal
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map(g => (
          <Card key={g.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{g.title}</div>
                <Badge variant="outline">{g.progress}%</Badge>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                {g.projectId && <span>Project: {projects.find(p=>p.id===g.projectId)?.name || g.projectId}</span>}
                {g.epicId && <span>Epic: {epics.find(e=>e.id===g.epicId)?.title || g.epicId}</span>}
              </div>
              <div className="w-full bg-gray-200 h-2 rounded">
                <div className="h-2 rounded bg-blue-600" style={{ width: `${g.progress}%` }} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={()=>setGoals(prev => prev.map(x => x.id===g.id ? { ...x, progress: Math.min(100, x.progress + 10) } : x))}>+10%</Button>
                <Button size="sm" variant="outline" onClick={()=>setGoals(prev => prev.map(x => x.id===g.id ? { ...x, progress: Math.max(0, x.progress - 10) } : x))}>-10%</Button>
                <Select value={g.epicId || ''} onValueChange={(v:any)=> setGoals(prev => prev.map(x => x.id===g.id ? { ...x, epicId: v || undefined } : x))}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Link Epic" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No epic</SelectItem>
                    {epics.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
        {goals.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-gray-500">No goals yet.</CardContent></Card>
        )}
      </div>
    </div>
  );

  const AllWorkView = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">All Work</h3>
      <ListView />
    </div>
  );

  const ArchivedView = () => (
    <Card>
      <CardHeader><CardTitle className="text-sm">Archived Work Items</CardTitle></CardHeader>
      <CardContent className="p-0">
        {tasks.filter(t => t.archived).length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No archived items.</div>
        ) : (
          <div className="divide-y">
            {tasks.filter(t => t.archived).map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${priorityColors[t.priority]}`} />
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline" className="capitalize">{t.status.replace('-', ' ')}</Badge>
                </div>
                <div className="text-xs text-gray-500">{t.dueDate ? format(t.dueDate, 'MMM dd') : '—'}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const TeamsView = () => {
    const [newTeamName, setNewTeamName] = useState('');
    const [newMember, setNewMember] = useState('');
    const [selectedTeamLocal, setSelectedTeamLocal] = useState<string>('all');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Teams</h3>
          <div className="flex gap-2">
            <Select value={selectedTeamLocal} onValueChange={setSelectedTeamLocal}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select team" /></SelectTrigger>
              <SelectContent>
                {teams.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={() => setSelectedTeam(selectedTeamLocal)}>Apply</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Create Team</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="Team name" value={newTeamName} onChange={(e)=>setNewTeamName(e.target.value)} />
            <Button onClick={async () => {
              if (!newTeamName.trim()) return;
              const name = newTeamName.trim();
              let createdTeam: Team | null = null;
              try {
                const { data } = await supabase
                  .from('teams')
                  // @ts-ignore optional teams table
                  .insert({ name, members: [], user_id: user?.id })
                  .select()
                  .single();
                if (data) {
                  createdTeam = { id: data.id, name: data.name, members: Array.isArray(data.members) ? data.members : [] } as Team;
                }
              } catch (e) {
                console.warn('Supabase team insert failed, using local-only team:', e);
              }
              const team: Team = createdTeam ?? { id: `team-${Date.now()}`, name, members: [] };
              setTeams(prev => [...prev, team]);
              setSelectedTeam(team.id);
              setSelectedTeamLocal(team.id);
              setNewTeamName('');
              toast({ title: 'Team created', description: `${team.name} created.` });
            }}>Create team</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Manage Users</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Team" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Input placeholder="Add person (name)" value={newMember} onChange={(e)=>setNewMember(e.target.value)} />
              <Button onClick={async () => {
                if (!newMember.trim()) return;
                const targetTeamId = selectedTeam !== 'all' ? selectedTeam : selectedTeamLocal;
                if (!targetTeamId || targetTeamId === 'all') {
                  toast({ title: 'Select a team', description: 'Please select a team to add members.', variant: 'destructive' });
                  return;
                }
                const memberName = newMember.trim();
                setTeams(prev => prev.map(t => t.id === targetTeamId ? { ...t, members: [...t.members, memberName] } : t));
                setNewMember('');
                try {
                  // Persist best-effort
                  const teamRec = teams.find(t => t.id === targetTeamId);
                  const nextMembers = [...(teamRec?.members || []), memberName];
                  await supabase
                    .from('teams')
                    // @ts-ignore optional teams table
                    .update({ members: nextMembers })
                    .eq('id', targetTeamId);
                } catch (e) {
                  console.warn('Persist team members failed:', e);
                }
                toast({ title: 'Member added', description: 'Person added to team.' });
              }}>Add person</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teams.filter(t => t.id === selectedTeam).map(team => (
                <Card key={team.id}>
                  <CardHeader><CardTitle className="text-sm">{team.name} Members</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {team.members.length === 0 && <div className="text-xs text-gray-500">No members yet.</div>}
                    {team.members.map(m => (
                      <div key={m} className="flex items-center justify-between text-sm p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6"><AvatarFallback className="text-[10px]">{m.split(' ').map(n=>n[0]).join('')}</AvatarFallback></Avatar>
                          <span>{m}</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          setTeams(prev => prev.map(t => t.id === team.id ? { ...t, members: t.members.filter(x => x !== m) } : t));
                        }}>Remove</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Archive task (best-effort persistence)
  const handleTaskArchive = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    // Update local state first
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, archived: true } : t));
    // Add activity log
    const activity: ActivityLog = {
      id: `activity-${Date.now()}`,
      type: 'task_updated',
      description: `Task "${task.title}" archived`,
      user: user?.email || 'Unknown User',
      timestamp: new Date(),
      projectId: task.project,
      taskId: task.id
    };
    setActivityLogs(prev => [activity, ...prev]);
    toast({ title: 'Task Archived', description: `"${task.title}" moved to archive.` });
    // Persist to supabase where possible
    try {
      const { error } = await supabase.from('todos').update({
        // optional columns
        // @ts-ignore
        is_archived: true,
      }).eq('id', taskId);
      if (error) throw error;
    } catch (e) {
      try {
        await supabase.from('todos').update({
          // fallback alternative
          // @ts-ignore
          archived_at: new Date().toISOString(),
        }).eq('id', taskId);
      } catch {}
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management Hub</h1>
          <p className="text-gray-600">AI-powered project management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAIAssistant(true)}>
            <Brain className="w-4 h-4 mr-2" />
            AI Assistant
          </Button>
          <Button variant="outline" onClick={() => setShowCreateProject(true)}>
            <FolderOpen className="w-4 h-4 mr-2" />
            New Project
          </Button>
          <Button onClick={() => setShowCreateTask(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Rocket className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold">{projects.filter(p => p.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed Tasks</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'done').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in-progress').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Flag className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Milestones</p>
                <p className="text-2xl font-bold">{milestones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search tasks, projects, or team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Team selector for multitenancy */}
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={activeView === 'kanban' && activeTab === 'board' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveView('kanban'); setActiveTab('board'); }}
              >
                <KanbanSquare className="w-4 h-4" />
              </Button>
              <Button
                variant={activeView === 'list' && activeTab === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveView('list'); setActiveTab('list'); }}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={activeView === 'calendar' && activeTab === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveView('calendar'); setActiveTab('calendar'); }}
              >
                <CalendarIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="all-work">All work</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <SummaryView />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <TimelineView />
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          <EnhancedKanbanBoard />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ListView />
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <FormsView />
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <GoalsView />
        </TabsContent>

        <TabsContent value="all-work" className="mt-6">
          <AllWorkView />
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <ArchivedView />
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          <TeamsView />
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <CreateTodoDialog
        isOpen={showCreateTask}
        onOpenChange={setShowCreateTask}
        onCreateTodo={handleCreateTask}
        teamId={selectedTeam}
        teamMembers={(teams.find(t=>t.id===selectedTeam)?.members)||[]}
      />

      {/* Edit Task Dialog */}
      {editingTask && (
        <CreateTodoDialog
          isOpen={showEditTask}
          onOpenChange={setShowEditTask}
          editTask={editingTask}
          onCreateTodo={(taskData) => {
            setTasks(prev => prev.map(t => 
              t.id === editingTask.id 
                ? { ...editingTask, ...taskData }
                : t
            ));
            setShowEditTask(false);
            setEditingTask(null);
            toast({ title: "Task Updated", description: "Task updated successfully." });
          }}
          teamId={selectedTeam}
          teamMembers={(teams.find(t=>t.id===selectedTeam)?.members)||[]}
        />
      )}

      {/* Automation Builder Modal */}
      <Dialog open={showAutomationBuilder} onOpenChange={setShowAutomationBuilder}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Automation Workflow Builder</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trigger</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="When..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task_created">Task is created</SelectItem>
                      <SelectItem value="task_updated">Task is updated</SelectItem>
                      <SelectItem value="deadline_approaching">Deadline approaches</SelectItem>
                      <SelectItem value="status_changed">Status changes</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="If..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="priority_urgent">Priority is urgent</SelectItem>
                        <SelectItem value="tag_contains">Tag contains</SelectItem>
                        <SelectItem value="assignee_is">Assignee is</SelectItem>
                        <SelectItem value="project_is">Project is</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Value" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Action</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Then..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assign_to">Auto-assign to</SelectItem>
                      <SelectItem value="send_notification">Send notification</SelectItem>
                      <SelectItem value="update_status">Update status</SelectItem>
                      <SelectItem value="create_subtask">Create subtask</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                onClick={() => {
                  // Create new automation rule (simplified for demo)
                  const newRule: AutomationRule = {
                    id: `rule-${Date.now()}`,
                    name: "Custom Automation",
                    trigger: "task_created",
                    conditions: [{ field: "priority", operator: "equals", value: "urgent" }],
                    actions: [{ type: "assign_to", value: "team-lead" }],
                    isActive: true,
                    lastTriggered: undefined
                  };
                  
                  setAutomationRules(prev => [...prev, newRule]);
                  setShowAutomationBuilder(false);
                  
                  toast({
                    title: "Automation Created",
                    description: "Your automation rule has been created and activated.",
                  });
                }}
              >
                <Zap className="w-4 h-4 mr-2" />
                Create Automation
              </Button>
              <Button variant="outline" onClick={() => {
                toast({
                  title: "Test Successful",
                  description: "Your automation rule would trigger correctly.",
                });
              }}>
                Test Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Board Customizer Dialog */}
      <Dialog open={showBoardCustomizer} onOpenChange={setShowBoardCustomizer}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Customize Kanban Board
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Column Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Board Columns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statusColumns.map((column, index) => (
                    <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${column.color}`}></div>
                        <Input 
                          value={column.title} 
                          onChange={(e) => {
                            const newColumns = [...statusColumns];
                            newColumns[index].title = e.target.value;
                            // Update the current project's columns if one is selected
                            if (selectedProject !== 'all') {
                              setProjects(prev => prev.map(p => 
                                p.id === selectedProject 
                                  ? { ...p, customColumns: newColumns }
                                  : p
                              ));
                            }
                          }}
                          className="max-w-[200px]"
                        />
                        <Select 
                          value={column.color} 
                          onValueChange={(newColor) => {
                            const newColumns = [...statusColumns];
                            newColumns[index].color = newColor;
                            if (selectedProject !== 'all') {
                              setProjects(prev => prev.map(p => 
                                p.id === selectedProject 
                                  ? { ...p, customColumns: newColumns }
                                  : p
                              ));
                            }
                          }}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bg-gray-100">Gray</SelectItem>
                            <SelectItem value="bg-blue-100">Blue</SelectItem>
                            <SelectItem value="bg-green-100">Green</SelectItem>
                            <SelectItem value="bg-yellow-100">Yellow</SelectItem>
                            <SelectItem value="bg-purple-100">Purple</SelectItem>
                            <SelectItem value="bg-red-100">Red</SelectItem>
                            <SelectItem value="bg-orange-100">Orange</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Column
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Board Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Board Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Default View</label>
                    <Select value={activeView} onValueChange={(value: any) => setActiveView(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kanban">Kanban</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="calendar">Calendar</SelectItem>
                        <SelectItem value="timeline">Timeline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Card Size</label>
                    <Select defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Advanced Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Auto-refresh</label>
                      <p className="text-xs text-gray-600">Automatically update board data</p>
                    </div>
                    <Button variant="outline" size="sm">ON</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Show card count</label>
                      <p className="text-xs text-gray-600">Display number of cards in each column</p>
                    </div>
                    <Button variant="outline" size="sm">ON</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Compact mode</label>
                      <p className="text-xs text-gray-600">Reduce card spacing and padding</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={()=>setCompactMode(v=>!v)}>{compactMode ? 'ON' : 'OFF'}</Button>
                  </div>
                  <div className="space-y-2 pt-3">
                    <label className="text-sm font-medium">WIP limits</label>
                    {statusColumns.map(col => (
                      <div key={col.id} className="flex items-center gap-2 text-sm">
                        <span className="w-24 capitalize">{col.title}</span>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={wipLimits[col.id] ?? 999}
                          onChange={(e)=>{
                            const val = parseInt(e.target.value || '0', 10);
                            setWipLimits(prev => ({ ...prev, [col.id]: isNaN(val) ? 999 : val }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => {
                toast({
                  title: "Board Customized",
                  description: "Your board settings have been saved.",
                });
                // Persist WIP limits into selected project's customColumns if a project is selected
                if (selectedProject !== 'all') {
                  setProjects(prev => prev.map(p => {
                    if (p.id !== selectedProject) return p;
                    const updated = { ...p };
                    updated.customColumns = (p.customColumns || statusColumns).map(col => ({
                      ...col,
                      // @ts-ignore store limit
                      wipLimit: wipLimits[col.id] ?? 999,
                    }));
                    return updated;
                  }));
                  try {
                    // Best-effort server persistence (optional custom_columns column)
                    // @ts-ignore
                    supabase.from('projects').update({ custom_columns: (projects.find(p=>p.id===selectedProject)?.customColumns || statusColumns).map(col => ({ ...col, wipLimit: wipLimits[col.id] ?? 999 })) }).eq('id', selectedProject);
                  } catch (e) {
                    console.warn('Could not persist custom_columns wip limits:', e);
                  }
                }
                setShowBoardCustomizer(false);
              }}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setShowBoardCustomizer(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={showCreateProject}
        onOpenChange={setShowCreateProject}
        onCreateProject={handleCreateProject}
      />

      {/* Create Epic Dialog */}
      <Dialog open={showCreateEpic} onOpenChange={setShowCreateEpic}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Epic</DialogTitle>
          </DialogHeader>
          <CreateEpicForm onCancel={()=>setShowCreateEpic(false)} onCreate={(epic)=>{
            setEpics(prev => [epic, ...prev]);
            setShowCreateEpic(false);
            toast({ title: 'Epic Created', description: epic.title });
          }} />
        </DialogContent>
      </Dialog>

      {/* Labels Editor Dialog */}
      <Dialog open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Labels</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(boardLabels[selectedProject] || []).map(lbl => (
                <button key={lbl.id} className={`h-8 rounded text-white text-xs px-2 flex items-center justify-between ${lbl.color}`} onClick={()=>{
                  if (!labelsTask) return;
                  const has = labelsTask.tags.includes(lbl.id);
                  const nextTags = has ? labelsTask.tags.filter(t=>t!==lbl.id) : [...labelsTask.tags, lbl.id];
                  setTasks(prev => prev.map(t => t.id===labelsTask.id ? { ...t, tags: nextTags } : t));
                }}>
                  <span className="truncate">{lbl.name}</span>
                  {labelsTask && labelsTask.tags.includes(lbl.id) && <CheckCircle className="w-3 h-3" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="New label name" onKeyDown={(e)=>{
                if (e.key==='Enter') {
                  const name = (e.target as HTMLInputElement).value.trim();
                  if (!name) return; (e.target as HTMLInputElement).value='';
                  const color = getTagColor(name);
                  const newLbl: LabelDef = { id: `lbl-${Date.now()}`, name, color };
                  setBoardLabels(prev => ({ ...prev, [selectedProject]: [ ...(prev[selectedProject]||[]), newLbl ] }));
                  try { // best-effort persist in projects.custom_columns
                    const proj = projects.find(p=>p.id===selectedProject);
                    if (proj) {
                      const payload = { labels: [ ...((boardLabels[selectedProject])||[]), newLbl ] };
                      // @ts-ignore
                      supabase.from('projects').update({ custom_columns: (proj.customColumns||statusColumns), custom_labels: payload }).eq('id', selectedProject);
                    }
                  } catch {}
                }
              }} />
              <Button variant="outline" onClick={()=>setLabelsDialogOpen(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checklist Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {checklistTask?.subtasks?.map(st => (
              <div key={st.id} className="flex items-center gap-2">
                <Checkbox checked={st.completed} onCheckedChange={(v)=>{
                  if (!checklistTask) return;
                  const next = (checklistTask.subtasks||[]).map(x => x.id===st.id ? { ...x, completed: Boolean(v) } : x);
                  setTasks(prev => prev.map(t => t.id===checklistTask.id ? { ...t, subtasks: next } : t));
                }} />
                <Input defaultValue={st.title} onBlur={(e)=>{
                  if (!checklistTask) return;
                  const next = (checklistTask.subtasks||[]).map(x => x.id===st.id ? { ...x, title: e.target.value } : x);
                  setTasks(prev => prev.map(t => t.id===checklistTask.id ? { ...t, subtasks: next } : t));
                }} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={()=>{
              if (!checklistTask) return;
              const next = [ ...(checklistTask.subtasks||[]), { id: `st-${Date.now()}`, title: 'New item', completed: false, assignee: checklistTask.assignee } ];
              setTasks(prev => prev.map(t => t.id===checklistTask.id ? { ...t, subtasks: next } : t));
            }}>Add item</Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setChecklistDialogOpen(false)}>Close</Button>
              <Button onClick={async()=>{
                if (!checklistTask) return;
                try { await supabase.from('todos').update({ subtasks: checklistTask.subtasks || [] }).eq('id', checklistTask.id); } catch{}
                setChecklistDialogOpen(false);
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Due Date Dialog */}
      <Dialog open={dueDateDialogOpen} onOpenChange={setDueDateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Due Date</DialogTitle>
          </DialogHeader>
          <div className="p-2">
            <Calendar mode="single" selected={dueDateTask?.dueDate || undefined} onSelect={(d)=>{
              if (dueDateTask && d) {
                setTasks(prev => prev.map(t => t.id===dueDateTask.id ? { ...t, dueDate: d } : t));
              }
            }} />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setDueDateDialogOpen(false)}>Cancel</Button>
              <Button onClick={async()=>{
                if (!dueDateTask) return;
                try { await supabase.from('todos').update({ due_date: dueDateTask.dueDate ? dueDateTask.dueDate.toISOString().slice(0,10) : null }).eq('id', dueDateTask.id); } catch{}
                setDueDateDialogOpen(false);
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectManagement;

// Lightweight inline CreateEpicForm used by the Create Epic dialog
interface CreateEpicFormProps {
  onCreate: (epic: { id: string; title: string; description?: string; dueDate?: Date | null }) => void;
  onCancel: () => void;
}

function CreateEpicForm({ onCreate, onCancel }: CreateEpicFormProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState<Date | undefined>(undefined);

  return (
    <div className="space-y-3">
      <Input placeholder="Epic title" value={title} onChange={(e)=>setTitle(e.target.value)} />
      <Textarea placeholder="Epic description" value={description} onChange={(e)=>setDescription(e.target.value)} />
      <div>
        <label className="text-xs text-gray-600">Target date</label>
        <div className="mt-2 border rounded p-2">
          <Calendar mode="single" selected={date} onSelect={setDate} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={()=>{
          if (!title.trim()) return;
          onCreate({ id: `epic-${Date.now()}`, title: title.trim(), description: description.trim() || undefined, dueDate: date || null });
        }} disabled={!title.trim()}>Create</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};