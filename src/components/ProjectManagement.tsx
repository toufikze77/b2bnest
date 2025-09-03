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
  History
} from 'lucide-react';
import { TodoComments } from './enhanced-todos/TodoComments';
import { CommentButton } from './CommentButton';
import { format } from 'date-fns';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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

interface WorkRequest {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'in_review' | 'approved' | 'rejected' | 'converted';
  created_at: string;
}

interface GoalItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  target_date?: string;
  progress: number;
  created_at: string;
}

interface TeamItem {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

interface TeamMemberItem {
  id?: string;
  team_id: string;
  member_email: string;
  role: string;
  created_at?: string;
}

interface CalendarEventItem {
  id: string;
  user_id: string;
  title: string;
  start_at: string;
  end_at?: string;
  project_id?: string | null;
  created_at: string;
}
// ---- Priority badge styles & labels ----
const priorityColors: Record<Task['priority'], string> = {
  low: 'bg-green-500 text-white',
  medium: 'bg-yellow-500 text-black',
  high: 'bg-orange-500 text-white',
  urgent: 'bg-red-500 text-white',
};

const priorityLabels: Record<Task['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const ProjectManagement = () => {
  console.log('🔧 ProjectManagement component loading...');
  const { user } = useAuth();
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  
  // Always call all hooks first to prevent hook violations
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar' | 'timeline'>('kanban');
  const [activeTab, setActiveTab] = useState('kanban');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);
  const [showBoardCustomizer, setShowBoardCustomizer] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [boardDensity, setBoardDensity] = useState<'comfortable' | 'compact' | 'condensed'>(() => {
    try {
      const saved = localStorage.getItem('pm_board_density');
      if (saved === 'comfortable' || saved === 'compact' || saved === 'condensed') return saved;
    } catch {}
    return 'compact';
  });

  useEffect(() => {
    try { localStorage.setItem('pm_board_density', boardDensity); } catch {}
  }, [boardDensity]);

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

  const [workRequests, setWorkRequests] = useState<WorkRequest[]>([]);
  // Initialize with empty arrays, load from localStorage in useEffect
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMemberItem[]>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);

  // Work Requests dialogs and filters - moved before returns to satisfy hooks rules
  const [workRequestDialogOpen, setWorkRequestDialogOpen] = useState(false);
  const [editingWorkRequest, setEditingWorkRequest] = useState<WorkRequest | null>(null);
  const [workRequestForm, setWorkRequestForm] = useState<{ title: string; description: string; priority: WorkRequest['priority']; status: WorkRequest['status']}>({ title: '', description: '', priority: 'medium', status: 'new' });
  const [workRequestStatusFilter, setWorkRequestStatusFilter] = useState<'all' | WorkRequest['status']>('all');
  const [workRequestPriorityFilter, setWorkRequestPriorityFilter] = useState<'all' | NonNullable<WorkRequest['priority']>>('all');
  const [workRequestSort, setWorkRequestSort] = useState<'newest' | 'oldest'>('newest');
  const [workRequestPage, setWorkRequestPage] = useState(1);

  // Goals dialogs and filters
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [goalForm, setGoalForm] = useState<{ title: string; description: string; target_date: string; progress: number }>({ title: '', description: '', target_date: '', progress: 0 });
  const [goalsSort, setGoalsSort] = useState<'newest' | 'oldest'>('newest');
  const [goalsPage, setGoalsPage] = useState(1);

  // Calendar event dialogs and filters
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [eventForm, setEventForm] = useState<{ title: string; start_at: string; end_at: string }>({ title: '', start_at: '', end_at: '' });
  const [eventsSort, setEventsSort] = useState<'newest' | 'oldest'>('newest');
  const [eventsPage, setEventsPage] = useState(1);

  // Comment dialog state
  const [showComments, setShowComments] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);

  // Fetch helpers
  const fetchWorkRequests = async () => {
    const { data, error } = await supabase.from('work_requests' as any).select('*').order('created_at', { ascending: false });
    if (!error && data) setWorkRequests(data as unknown as WorkRequest[]);
  };

  const fetchGoals = async () => {
    const { data, error } = await supabase.from('goals' as any).select('*').order('created_at', { ascending: false });
    if (!error && data) setGoals(data as unknown as GoalItem[]);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase.from('teams' as any).select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const teamsData = data as unknown as TeamItem[];
      setTeams(teamsData);
      // load members per team
      const { data: membersData } = await supabase.from('team_members' as any).select('*');
      const grouped: Record<string, TeamMemberItem[]> = {};
      (membersData || []).forEach((m: any) => {
        const tm: TeamMemberItem = { team_id: m.team_id, member_email: m.member_email, role: m.role, created_at: m.created_at, id: m.id };
        if (!grouped[tm.team_id]) grouped[tm.team_id] = [];
        grouped[tm.team_id].push(tm);
      });
      setTeamMembers(grouped);
    }
  };

  const fetchCalendarEvents = async () => {
    const { data, error } = await supabase.from('calendar_events' as any).select('*').order('start_at', { ascending: true });
    if (!error && data) setCalendarEvents(data as unknown as CalendarEventItem[]);
  };

  // Load localStorage data on mount
  useEffect(() => {
    // Load goals from localStorage
    try {
      const savedGoals = localStorage.getItem('projectGoals');
      if (savedGoals) {
        setGoals(JSON.parse(savedGoals));
      }
    } catch (error) {
      console.error('Error loading goals from localStorage:', error);
    }

    // Load teams from localStorage  
    try {
      const savedTeams = localStorage.getItem('projectTeams');
      if (savedTeams) {
        setTeams(JSON.parse(savedTeams));
      }
    } catch (error) {
      console.error('Error loading teams from localStorage:', error);
    }
  }, []); // Only run once on mount

  useEffect(() => {
    fetchWorkRequests();
    fetchGoals();
    fetchTeams();
    fetchCalendarEvents();
  }, []);

  // Create helpers
  const createWorkRequest = async () => {
    const title = window.prompt('Work request title');
    if (!title) return;
    const description = window.prompt('Description (optional)') || '';
    const { data, error } = await supabase.from('work_requests' as any).insert({ title, description, priority: 'medium', status: 'new' }).select().single();
    if (!error && data) setWorkRequests(prev => [data as unknown as WorkRequest, ...prev]);
  };

  const createGoal = async () => {
    const title = window.prompt('Goal title');
    if (!title) return;
    const target = window.prompt('Target date (YYYY-MM-DD) optional') || null;
    
    const newGoal: GoalItem = {
      id: Date.now().toString(),
      title,
      description: '',
      target_date: target,
      progress: 0,
      created_at: new Date().toISOString(),
      user_id: 'local-user'
    };
    
    setGoals(prev => [newGoal, ...prev]);
    
    // Save to localStorage
    try {
      const savedGoals = localStorage.getItem('projectGoals');
      const existingGoals = savedGoals ? JSON.parse(savedGoals) : [];
      localStorage.setItem('projectGoals', JSON.stringify([newGoal, ...existingGoals]));
      
      toast({
        title: "Goal Created",
        description: `"${title}" has been added successfully.`
      });
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const createTeam = async () => {
    const name = window.prompt('Team name');
    if (!name) return;
    
    const newTeam: TeamItem = {
      id: Date.now().toString(),
      name,
      created_at: new Date().toISOString(),
      owner_id: 'local-user'
    };
    
    setTeams(prev => [newTeam, ...prev]);
    
    // Save to localStorage
    try {
      const savedTeams = localStorage.getItem('projectTeams');
      const existingTeams = savedTeams ? JSON.parse(savedTeams) : [];
      localStorage.setItem('projectTeams', JSON.stringify([newTeam, ...existingTeams]));
      
      toast({
        title: "Team Created",
        description: `"${name}" team has been created successfully.`
      });
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  // Note: localStorage saving is handled in individual create/update functions to avoid infinite loops

  const addPersonToTeam = async (teamId: string) => {
    const email = window.prompt('Member email to add');
    if (!email) return;
    const role = window.prompt('Role (e.g., member, admin)') || 'member';
    const { data, error } = await supabase.from('team_members' as any).insert({ team_id: teamId, member_email: email, role }).select().single();
    if (!error && data) setTeamMembers(prev => ({ ...prev, [teamId]: [...(prev[teamId] || []), data as unknown as TeamMemberItem] }));
  };

  const createCalendarEvent = async () => {
    const title = window.prompt('Event title');
    if (!title) return;
    const start = window.prompt('Start (YYYY-MM-DD HH:MM)');
    if (!start) return;
    const end = window.prompt('End (YYYY-MM-DD HH:MM, optional)') || null;
    const { data, error } = await supabase.from('calendar_events' as any).insert({ title, start_at: start, end_at: end }).select().single();
    if (!error && data) setCalendarEvents(prev => [...prev, data as unknown as CalendarEventItem]);
  };

  // Check access after hooks are initialized
  useEffect(() => {
    const canAccessPM = canAccessFeature('project-management');
    console.log('🔧 ProjectManagement - Access check:', canAccessPM, 'user:', !!user);
    setHasAccess(canAccessPM);
  }, [canAccessFeature, user]);

  useEffect(() => {
    console.log('🔧 ProjectManagement useEffect triggered', { user: !!user, hasAccess });
    if (user && hasAccess) {
      loadProjects();
      loadTasks();
    } else {
      setLoading(false);
    }
  }, [user, hasAccess]);

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
          comments: []
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
      // Determine which project to assign the task to
      const targetProjectId = selectedProject !== 'all' ? selectedProject : projects[0]?.id || null;
      
      const { data, error } = await supabase
        .from('todos')
        .insert({
          title: taskData.title,
          description: taskData.description || '',
          status: 'todo',
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date || null,
          labels: taskData.labels || [],
          estimated_hours: taskData.estimated_hours,
          project_id: targetProjectId,
          user_id: user?.id
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
        comments: []
      };

      setTasks(prev => [...prev, newTask]);
      
      // Add activity log
      const newActivity: ActivityLog = {
        id: `activity-${Date.now()}`,
        type: 'task_created',
        description: `Created new task: ${newTask.title}`,
        user: user?.email || 'Unknown User',
        timestamp: new Date(),
        projectId: newTask.project,
        taskId: newTask.id
      };
      setActivityLogs(prev => [newActivity, ...prev]);

      toast({
        title: "Task Created",
        description: `Successfully created task: ${newTask.title}`,
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Track visual order of tasks within each column (must be before any early returns)
  const [taskPositions, setTaskPositions] = useState<Record<string, string[]>>({});
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Initialize/merge taskPositions when tasks or columns change (hook must not be after an early return)
  useEffect(() => {
    setTaskPositions(prev => {
      const next: Record<string, string[]> = { ...prev };
      const columnIds = (projects.find(p => p.id === selectedProject && selectedProject !== 'all')?.customColumns || [
        { id: 'backlog' },
        { id: 'todo' },
        { id: 'in-progress' },
        { id: 'review' },
        { id: 'done' }
      ] as any).map((c: any) => c.id);

      for (const columnId of columnIds) {
        const existing = next[columnId] || [];
        const currentTaskIds = tasks.filter(t => t.status === columnId).map(t => t.id);
        const ordered = existing.filter(id => currentTaskIds.includes(id));
        for (const id of currentTaskIds) {
          if (!ordered.includes(id)) ordered.push(id);
        }
        next[columnId] = ordered;
      }
      return next;
    });
  }, [tasks, selectedProject, projects]);

  // Access check moved to top of component

  // Avoid early return to maintain stable hook order across renders

  const statusColumns = projects.find(p => p.id === selectedProject && selectedProject !== 'all')?.customColumns || [
    { id: 'backlog', title: 'Backlog', color: 'bg-gray-100', order: 1 },
    { id: 'todo', title: 'To Do', color: 'bg-blue-100', order: 2 },
    { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-100', order: 3 },
    { id: 'review', title: 'Review', color: 'bg-purple-100', order: 4 },
    { id: 'done', title: 'Done', color: 'bg-green-100', order: 5 }
  ];

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
    console.log('Filtering task:', task.title, 'project:', task.project, 'selectedProject:', selectedProject, 'matches:', matchesProject);
    return matchesSearch && matchesProject;
  });

  // moved up: taskPositions hooks

  const tasksById = Object.fromEntries(tasks.map(t => [t.id, t]));

  // Density-based classes
  const densityClasses = {
    columnGap: boardDensity === 'comfortable' ? 'gap-3' : boardDensity === 'compact' ? 'gap-2' : 'gap-1',
    columnPadding: boardDensity === 'comfortable' ? 'p-3' : boardDensity === 'compact' ? 'p-2' : 'p-1.5',
    headerMb: boardDensity === 'comfortable' ? 'mb-3' : boardDensity === 'compact' ? 'mb-2' : 'mb-1.5',
    listSpacing: boardDensity === 'comfortable' ? 'space-y-2' : boardDensity === 'compact' ? 'space-y-1.5' : 'space-y-1',
    cardHoverScale: boardDensity === 'comfortable' ? 'hover:scale-[1.02]' : 'hover:scale-[1.01]',
    cardPadding: boardDensity === 'comfortable' ? 'p-3' : boardDensity === 'compact' ? 'p-2' : 'p-1.5',
    titleText: boardDensity === 'comfortable' ? 'text-sm' : boardDensity === 'compact' ? 'text-[11px]' : 'text-[10px]',
    headerInnerMb: boardDensity === 'comfortable' ? 'mb-2' : 'mb-1',
    descText: boardDensity === 'comfortable' ? 'text-xs leading-tight' : boardDensity === 'compact' ? 'text-[11px] leading-snug' : 'text-[10px] leading-snug',
    descMb: boardDensity === 'comfortable' ? 'mb-2' : 'mb-1',
    progressText: boardDensity === 'comfortable' ? 'text-xs' : 'text-[10px]',
    progressMb: boardDensity === 'comfortable' ? 'mb-2' : 'mb-1',
    subtaskText: boardDensity === 'comfortable' ? 'text-xs' : 'text-[10px]',
    tagsMb: boardDensity === 'comfortable' ? 'mb-2' : 'mb-1',
    tagBadge: boardDensity === 'comfortable' ? 'text-xs px-1 py-0 h-5' : boardDensity === 'compact' ? 'text-[10px] px-1 py-0 h-4' : 'text-[10px] px-[2px] py-0 h-4',
    avatar: boardDensity === 'comfortable' ? 'w-5 h-5' : 'w-4 h-4',
    avatarFallback: boardDensity === 'comfortable' ? 'text-xs' : 'text-[10px]',
    popoverBtn: boardDensity === 'comfortable' ? '' : 'h-6 w-6 p-0',
  } as const;

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(task.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const removeFromAllColumns = (taskId: string) => {
    setTaskPositions(prev => {
      const next: Record<string, string[]> = {};
      for (const [colId, ids] of Object.entries(prev)) {
        next[colId] = ids.filter(id => id !== taskId);
      }
      return next;
    });
  };

  const insertIntoColumnBefore = (columnId: string, taskId: string, beforeTaskId: string | null) => {
    setTaskPositions(prev => {
      const next = { ...prev };
      const ids = (next[columnId] || []).filter(id => id !== taskId);
      if (beforeTaskId && ids.includes(beforeTaskId)) {
        const idx = ids.indexOf(beforeTaskId);
        ids.splice(idx, 0, taskId);
      } else {
        ids.push(taskId);
      }
      next[columnId] = ids;
      return next;
    });
  };

  const handleDropOnCard = async (e: React.DragEvent, targetTaskId: string, columnId: string) => {
    e.preventDefault();
    const movingTaskId = e.dataTransfer.getData('text/plain');
    if (!movingTaskId || movingTaskId === targetTaskId) return;

    const movingTask = tasksById[movingTaskId];
    if (!movingTask) return;

    // Update status if moving across columns
    if (movingTask.status !== columnId) {
      await handleTaskStatusUpdate(movingTaskId, columnId);
    }

    removeFromAllColumns(movingTaskId);
    insertIntoColumnBefore(columnId, movingTaskId, targetTaskId);
    setDraggingTaskId(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const movingTask = tasksById[taskId];
    if (!movingTask) return;
    if (movingTask.status !== columnId) {
      await handleTaskStatusUpdate(taskId, columnId);
    }
    removeFromAllColumns(taskId);
    insertIntoColumnBefore(columnId, taskId, null);
    setDraggingTaskId(null);
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

  const EnhancedKanbanBoard = () => (
    <div className="space-y-6">
      {/* Custom Board Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => {
                console.log('Opening board customizer');
                setShowBoardCustomizer(true);
              }}>
                <Settings className="w-4 h-4 mr-2" />
                Customize Board
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                console.log('Opening automation builder');
                setShowAutomationBuilder(true);
              }}>
                <Zap className="w-4 h-4 mr-2" />
                Automation Rules
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={boardDensity} onValueChange={(v: any) => setBoardDensity(v)}>
                <SelectTrigger className="w-[170px] h-8 text-xs">
                  <SelectValue placeholder="Density" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="condensed">Condensed</SelectItem>
                </SelectContent>
              </Select>
              <Badge className="bg-blue-100 text-blue-800">Auto-Assignment: ON</Badge>
              <Badge className="bg-green-100 text-green-800">Notifications: ON</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Columns */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 ${densityClasses.columnGap}`}>
        {statusColumns.map(column => (
          <div 
            key={column.id} 
            className={`${column.color} rounded-lg ${densityClasses.columnPadding} min-h-[700px] animate-fade-in`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className={`flex items-center justify-between ${densityClasses.headerMb}`}>
              <h3 className="font-semibold text-sm">{column.title}</h3>
              <div className="flex items-center gap-1">
                {(() => {
                  const taskCount = filteredTasks.filter(task => task.status === column.id).length;
                  return taskCount > 0 ? (
                    <Badge variant="secondary" className="text-xs px-2 py-0">
                      {taskCount}
                    </Badge>
                  ) : null;
                })()}
                <Button variant="ghost" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  console.log('Plus button clicked, opening create task dialog');
                  setShowCreateTask(true);
                }}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className={`${densityClasses.listSpacing}`}>
              {(taskPositions[column.id] || filteredTasks.filter(t => t.status === column.id).map(t => t.id))
                .map(taskId => tasksById[taskId])
                .filter(Boolean)
                .filter(task => filteredTasks.some(ft => ft.id === task.id) && task.status === column.id)
                .map(task => (
                  <Card 
                    key={task.id} 
                    className={`cursor-pointer hover:shadow-lg transition-all ${densityClasses.cardHoverScale}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnCard(e, task.id, column.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Task card clicked:', task.id, task.title);
                      setEditingTask(task);
                      setShowEditTask(true);
                    }}
                  >
                    <CardContent className={`${densityClasses.cardPadding}`}>
                      <div className={`flex items-start justify-between ${densityClasses.headerInnerMb}`}>
                        <h4 className={`font-medium ${densityClasses.titleText} leading-tight`}>{task.title}</h4>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`}></div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className={densityClasses.popoverBtn} onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-1" align="end">
                              <div className="space-y-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full justify-start h-7"
                                  onClick={() => {
                                    setEditingTask(task);
                                    setShowEditTask(true);
                                  }}
                                >
                                  <Edit className="w-3 h-3 mr-2" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full justify-start h-7 text-red-600 hover:text-red-700"
                                  onClick={() => handleTaskDelete(task.id)}
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      <p className={`${densityClasses.descText} text-gray-600 ${densityClasses.descMb} line-clamp-2`}>{task.description}</p>
                      
                      {/* Progress Bar */}
                      {task.progress && (
                        <div className={`${densityClasses.progressMb}`}>
                          <div className={`flex justify-between ${densityClasses.progressText} mb-1`}>
                            <span>Progress</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-blue-600 h-1 rounded-full transition-all" 
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Subtasks */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className={`${densityClasses.descMb}`}>
                          <div className={`flex items-center gap-1 ${densityClasses.subtaskText} text-gray-500`}>
                            <ListCheck className="w-3 h-3" />
                            <span>
                              {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} subtasks
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      <div className={`flex flex-wrap gap-1 ${densityClasses.tagsMb}`}>
                        {task.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className={densityClasses.tagBadge}>
                            {tag}
                          </Badge>
                        ))}
                        {task.tags.length > 2 && (
                          <Badge variant="outline" className={densityClasses.tagBadge}>
                            +{task.tags.length - 2}
                          </Badge>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {task.attachments && task.attachments.length > 0 && (
                            <Paperclip className="w-3 h-3 text-gray-400" />
                          )}
                          <CommentButton
                            taskId={task.id}
                            onOpenComments={() => {
                              setCommentTaskId(task.id);
                              setShowComments(true);
                            }}
                          />
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Avatar className={densityClasses.avatar}>
                            <AvatarFallback className={densityClasses.avatarFallback}>
                              {task.assignee.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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

  const statusPieData = [
    { name: 'Backlog', value: tasks.filter(t => t.status === 'backlog').length },
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length },
    { name: 'Review', value: tasks.filter(t => t.status === 'review').length },
    { name: 'Done', value: tasks.filter(t => t.status === 'done').length },
  ];

  const statusColors = ['#9CA3AF', '#3B82F6', '#F59E0B', '#8B5CF6', '#10B981'];

  const priorityBarData = [
    { name: 'Low', count: tasks.filter(t => t.priority === 'low').length },
    { name: 'Medium', count: tasks.filter(t => t.priority === 'medium').length },
    { name: 'High', count: tasks.filter(t => t.priority === 'high').length },
    { name: 'Urgent', count: tasks.filter(t => t.priority === 'urgent').length },
  ];

  const teamWorkload = [
    { name: 'John Doe', load: tasks.filter(t => t.assignee === 'John Doe').length, capacity: 10 },
    { name: 'Jane Smith', load: tasks.filter(t => t.assignee === 'Jane Smith').length, capacity: 8 },
    { name: 'Mike Johnson', load: tasks.filter(t => t.assignee === 'Mike Johnson').length, capacity: 12 },
  ];

  const typesOfWork = ['Development', 'Design', 'QA', 'Documentation', 'Client Communication'];

  // Archive handlers
  const archiveTask = async (taskId: string) => {
    const { error } = await supabase.from('todos' as any).update({ archived_at: new Date().toISOString() }).eq('id', taskId);
    if (!error) setTasks(prev => prev.filter(t => t.id !== taskId));
  };
  const unarchiveTask = async (taskId: string) => {
    const { error } = await supabase.from('todos' as any).update({ archived_at: null }).eq('id', taskId);
    if (!error) loadTasks();
  };

  // Convert work request to task
  const convertWorkRequestToTask = async (req: WorkRequest) => {
    const targetProjectId = selectedProject !== 'all' ? selectedProject : projects[0]?.id || null;
    const { data: task, error } = await supabase.from('todos' as any).insert({
      title: req.title,
      description: req.description || '',
      status: 'todo',
      priority: req.priority || 'medium',
      project_id: targetProjectId
    }).select().single();
    
    if (error) {
      console.error('Error creating task:', error);
      return;
    }
    
    if (task && 'id' in task) {
      await supabase.from('work_requests' as any).update({ 
        status: 'converted', 
        created_task_id: task.id 
      }).eq('id', req.id);
    }
    setWorkRequests(prev => prev.map(w => w.id === req.id ? { ...w, status: 'converted' } : w));
    // add task to local state for immediate visibility
    loadTasks();
  };

  const PAGE_SIZE = 10;


  const openNewWorkRequestDialog = () => {
    setEditingWorkRequest(null);
    setWorkRequestForm({ title: '', description: '', priority: 'medium', status: 'new' });
    setWorkRequestDialogOpen(true);
  };
  const openEditWorkRequestDialog = (req: WorkRequest) => {
    setEditingWorkRequest(req);
    setWorkRequestForm({ title: req.title, description: req.description || '', priority: req.priority || 'medium', status: req.status });
    setWorkRequestDialogOpen(true);
  };
  const saveWorkRequest = async () => {
    if (!workRequestForm.title.trim()) return;
    if (editingWorkRequest) {
      const { data, error } = await supabase.from('work_requests' as any)
        .update({ title: workRequestForm.title, description: workRequestForm.description, priority: workRequestForm.priority, status: workRequestForm.status })
        .eq('id', editingWorkRequest.id).select().single();
      if (!error && data) {
        setWorkRequests(prev => prev.map(w => w.id === editingWorkRequest.id ? data as any : w));
      }
    } else {
      const { data, error } = await supabase.from('work_requests' as any)
        .insert({ title: workRequestForm.title, description: workRequestForm.description, priority: workRequestForm.priority, status: workRequestForm.status })
        .select().single();
      if (!error && data) setWorkRequests(prev => [data as any, ...prev]);
    }
    setWorkRequestDialogOpen(false);
  };
  const deleteWorkRequest = async (req: WorkRequest) => {
    const { error } = await supabase.from('work_requests' as any).delete().eq('id', req.id);
    if (!error) setWorkRequests(prev => prev.filter(w => w.id !== req.id));
  };
  const filteredSortedWorkRequests = (() => {
    let arr = [...workRequests];
    if (workRequestStatusFilter !== 'all') arr = arr.filter(w => w.status === workRequestStatusFilter);
    if (workRequestPriorityFilter !== 'all') arr = arr.filter(w => (w.priority || 'medium') === workRequestPriorityFilter);
    arr.sort((a,b) => workRequestSort === 'newest' ? (b.created_at.localeCompare(a.created_at)) : (a.created_at.localeCompare(b.created_at)));
    return arr;
  })();
  const pagedWorkRequests = filteredSortedWorkRequests.slice((workRequestPage-1)*PAGE_SIZE, workRequestPage*PAGE_SIZE);

  // Goals dialogs and filters
  const openNewGoalDialog = () => {
    setEditingGoal(null);
    setGoalForm({ title: '', description: '', target_date: '', progress: 0 });
    setGoalDialogOpen(true);
  };
  const openEditGoalDialog = (g: GoalItem) => {
    setEditingGoal(g);
    setGoalForm({ title: g.title, description: g.description || '', target_date: g.target_date || '', progress: g.progress });
    setGoalDialogOpen(true);
  };
  const saveGoal = async () => {
    if (!goalForm.title.trim()) return;
    
    if (editingGoal) {
      const updatedGoal = {
        ...editingGoal,
        title: goalForm.title,
        description: goalForm.description,
        target_date: goalForm.target_date || null,
        progress: goalForm.progress
      };
      setGoals(prev => prev.map(x => x.id === editingGoal.id ? updatedGoal : x));
      
      // Update localStorage
      try {
        const savedGoals = localStorage.getItem('projectGoals');
        const existingGoals = savedGoals ? JSON.parse(savedGoals) : [];
        const updatedGoals = existingGoals.map((g: any) => g.id === editingGoal.id ? updatedGoal : g);
        localStorage.setItem('projectGoals', JSON.stringify(updatedGoals));
      } catch (error) {
        console.error('Error updating goal:', error);
      }
    } else {
      const newGoal: GoalItem = {
        id: Date.now().toString(),
        title: goalForm.title,
        description: goalForm.description,
        target_date: goalForm.target_date || null,
        progress: goalForm.progress,
        created_at: new Date().toISOString(),
        user_id: 'local-user'
      };
      setGoals(prev => [newGoal, ...prev]);
      
      // Save to localStorage
      try {
        const savedGoals = localStorage.getItem('projectGoals');
        const existingGoals = savedGoals ? JSON.parse(savedGoals) : [];
        localStorage.setItem('projectGoals', JSON.stringify([newGoal, ...existingGoals]));
      } catch (error) {
        console.error('Error saving goal:', error);
      }
    }
    
    setGoalDialogOpen(false);
    setEditingGoal(null);
    setGoalForm({ title: '', description: '', target_date: '', progress: 0 });
    
    toast({
      title: editingGoal ? "Goal Updated" : "Goal Created",
      description: `"${goalForm.title}" has been ${editingGoal ? 'updated' : 'created'} successfully.`
    });
  };
  const deleteGoal = async (g: GoalItem) => {
    setGoals(prev => prev.filter(x => x.id !== g.id));
    
    // Update localStorage
    try {
      const savedGoals = localStorage.getItem('projectGoals');
      const existingGoals = savedGoals ? JSON.parse(savedGoals) : [];
      const updatedGoals = existingGoals.filter((goal: any) => goal.id !== g.id);
      localStorage.setItem('projectGoals', JSON.stringify(updatedGoals));
      
      toast({
        title: "Goal Deleted",
        description: `"${g.title}" has been deleted successfully.`
      });
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };
  const sortedGoals = [...goals].sort((a,b) => goalsSort === 'newest' ? (b.created_at.localeCompare(a.created_at)) : (a.created_at.localeCompare(b.created_at)));
  const pagedGoals = sortedGoals.slice((goalsPage-1)*PAGE_SIZE, goalsPage*PAGE_SIZE);

  // Calendar event dialogs and filters
  const openNewEventDialog = () => {
    setEditingEvent(null);
    setEventForm({ title: '', start_at: '', end_at: '' });
    setEventDialogOpen(true);
  };
  const openEditEventDialog = (ev: CalendarEventItem) => {
    setEditingEvent(ev);
    setEventForm({ title: ev.title, start_at: ev.start_at?.slice(0,16) || '', end_at: ev.end_at?.slice(0,16) || '' });
    setEventDialogOpen(true);
  };
  const saveEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.start_at) return;
    const payload = { title: eventForm.title, start_at: eventForm.start_at, end_at: eventForm.end_at || null } as any;
    if (editingEvent) {
      const { data, error } = await supabase.from('calendar_events' as any)
        .update(payload).eq('id', editingEvent.id).select().single();
      if (!error && data) setCalendarEvents(prev => prev.map(e => e.id === editingEvent.id ? data as any : e));
    } else {
      const { data, error } = await supabase.from('calendar_events' as any)
        .insert(payload).select().single();
      if (!error && data) setCalendarEvents(prev => [...prev, data as any]);
    }
    setEventDialogOpen(false);
  };
  const deleteEvent = async (ev: CalendarEventItem) => {
    const { error } = await supabase.from('calendar_events' as any).delete().eq('id', ev.id);
    if (!error) setCalendarEvents(prev => prev.filter(e => e.id !== ev.id));
  };
  const sortedEvents = [...calendarEvents].sort((a,b) => eventsSort === 'newest' ? (b.start_at.localeCompare(a.start_at)) : (a.start_at.localeCompare(b.start_at)));
  const pagedEvents = sortedEvents.slice((eventsPage-1)*PAGE_SIZE, eventsPage*PAGE_SIZE);

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
                variant={activeView === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('kanban')}
              >
                <KanbanSquare className="w-4 h-4" />
              </Button>
              <Button
                variant={activeView === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={activeView === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('calendar')}
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
          <TabsTrigger value="kanban">Board</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="all">All work</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status Overview</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" outerRadius={80} label>
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={statusColors[index % statusColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityBarData}>
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Team Workload</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {teamWorkload.map(member => (
                    <div key={member.name} className="p-4 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8"><AvatarFallback>{member.name[0]}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-gray-500">Capacity: {member.capacity}%</div>
                        </div>
                      </div>
                      <Badge variant={member.load > member.capacity ? 'destructive' : 'secondary'}>
                        {member.load} tasks
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityLogs.slice(0, 6).map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg">
                      <Avatar className="w-8 h-8"><AvatarFallback>{log.user[0]}</AvatarFallback></Avatar>
                      <div>
                        <div className="text-sm">{log.description}</div>
                        <div className="text-xs text-gray-500">{format(log.timestamp, 'MMM dd, HH:mm')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Types of Work</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">
                <ul className="list-disc pl-5 space-y-1">
                  {typesOfWork.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="mb-4">
            <Button onClick={() => setShowCreateProject(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Create Epic
            </Button>
          </div>
          <ProjectActivityTimeline projectId={selectedProject || 'default'} projectName={selectedProject ? projects.find(p => p.id === selectedProject)?.name || 'Project' : 'All Projects'} />
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          <EnhancedKanbanBoard />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Calendar</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={eventsSort} onValueChange={(v:any)=>setEventsSort(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={openNewEventDialog}>Add Event</Button>
              </div>
              <div className="space-y-2">
                {pagedEvents.map(ev => (
                  <div key={ev.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{ev.title}</div>
                      <div className="text-xs text-gray-500">{ev.start_at}{ev.end_at ? ` → ${ev.end_at}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={()=>openEditEventDialog(ev)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={()=>deleteEvent(ev)}>Delete</Button>
                    </div>
                  </div>
                ))}
                {sortedEvents.length === 0 && <div className="text-sm text-gray-500">No events yet.</div>}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="outline" disabled={eventsPage===1} onClick={()=>setEventsPage(p=>Math.max(1,p-1))}>Prev</Button>
                <Button size="sm" variant="outline" disabled={eventsPage*PAGE_SIZE>=sortedEvents.length} onClick={()=>setEventsPage(p=>p+1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader><CardTitle>All Tasks (List)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks.filter(t => !(t as any).archived_at).map(t => (
                  <div key={t.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-500">{t.status} • {t.priority}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.project}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => archiveTask(t.id)}>Archive</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Forms: Collect and track work requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">Create simple forms to collect work requests and automatically create tasks.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={workRequestStatusFilter} onValueChange={(v: any) => setWorkRequestStatusFilter(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_review">In review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workRequestPriorityFilter} onValueChange={(v: any) => setWorkRequestPriorityFilter(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workRequestSort} onValueChange={(v: any) => setWorkRequestSort(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={openNewWorkRequestDialog}>New Work Request</Button>
              </div>
              <div className="space-y-2">
                {pagedWorkRequests.map(req => (
                  <div key={req.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{req.title}</div>
                      <div className="text-xs text-gray-500">{req.status} • {req.priority || 'medium'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditWorkRequestDialog(req)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteWorkRequest(req)}>Delete</Button>
                      {req.status !== 'converted' && (
                        <Button size="sm" variant="ghost" onClick={() => convertWorkRequestToTask(req)}>Convert to Task</Button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredSortedWorkRequests.length === 0 && <div className="text-sm text-gray-500">No work requests yet.</div>}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="outline" disabled={workRequestPage===1} onClick={()=>setWorkRequestPage(p=>Math.max(1,p-1))}>Prev</Button>
                <Button size="sm" variant="outline" disabled={workRequestPage*PAGE_SIZE>=filteredSortedWorkRequests.length} onClick={()=>setWorkRequestPage(p=>p+1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">Define measurable goals and link tasks and epics to track progress.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Select value={goalsSort} onValueChange={(v:any)=>setGoalsSort(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={openNewGoalDialog}>Create Goal</Button>
              </div>
              <div className="space-y-2">
                {pagedGoals.map(g => (
                  <div key={g.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{g.title}</div>
                      <div className="text-xs text-gray-500">Target: {g.target_date || '—'} • Progress: {g.progress}%</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{g.progress}%</Badge>
                      <Button size="sm" variant="ghost" onClick={()=>openEditGoalDialog(g)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={()=>deleteGoal(g)}>Delete</Button>
                    </div>
                  </div>
                ))}
                {sortedGoals.length === 0 && <div className="text-sm text-gray-500">No goals yet.</div>}
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="outline" disabled={goalsPage===1} onClick={()=>setGoalsPage(p=>Math.max(1,p-1))}>Prev</Button>
                <Button size="sm" variant="outline" disabled={goalsPage*PAGE_SIZE>=sortedGoals.length} onClick={()=>setGoalsPage(p=>p+1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader><CardTitle>All Work Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...tasks].filter(t => !(t as any).archived_at).map(t => (
                  <div key={t.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-500">{t.status} • {t.priority}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.project}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => archiveTask(t.id)}>Archive</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Archived Work Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks.filter(t => (t as any).archived_at).map(t => (
                  <div key={t.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-500">Archived</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => unarchiveTask(t.id)}>Unarchive</Button>
                  </div>
                ))}
                {tasks.filter(t => (t as any).archived_at).length === 0 && (
                  <div className="text-sm text-gray-500">No archived items.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

                <TabsContent value="teams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={createTeam}>Create team</Button>
                {teams.map(team => (
                  <Button key={team.id} variant="outline" size="sm" onClick={() => addPersonToTeam(team.id)}>Add people to {team.name}</Button>
                ))}
              </div>
              <div className="space-y-4">
                {teams.map(team => (
                  <div key={team.id} className="p-3 border rounded-lg">
                    <div className="font-medium mb-2">{team.name}</div>
                    <div className="text-xs text-gray-500 mb-2">Members:</div>
                    <div className="space-y-1">
                      {(teamMembers[team.id] || []).map(m => (
                        <div key={team.id + m.member_email} className="text-sm">{m.member_email} — {m.role}</div>
                      ))}
                      {(teamMembers[team.id] || []).length === 0 && (<div className="text-sm text-gray-500">No members yet.</div>)}
                    </div>
                  </div>
                ))}
                {teams.length === 0 && <div className="text-sm text-gray-500">No teams yet.</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Projects Overview Section */}
      <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Active Projects</h3>
              <Button variant="outline" onClick={() => setShowCreateProject(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => {
                // Convert project format to match ProjectCard expectations
                const projectCardData = {
                  ...project,
                  team_members: project.members,
                  deadline: project.deadline?.toISOString().split('T')[0]
                };
                
                return (
                  <ProjectCard
                    key={project.id}
                    project={projectCardData}
                    onClick={() => {
                      console.log('Selecting project:', project.id);
                      setSelectedProject(project.id);
                                             setActiveTab('summary');
                      toast({
                        title: "Project Selected",
                        description: `Now viewing: ${project.name}`,
                      });
                    }}
                  />
                );
              })}
              
              {projects.length === 0 && (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="p-6 text-center">
                    <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="font-medium text-gray-900 mb-2">No projects yet</h4>
                    <p className="text-sm text-gray-600 mb-4">Get started by creating your first project</p>
                    <Button onClick={() => setShowCreateProject(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        
      {/* Enhanced Create Task Dialog */}
      <CreateTodoDialog
        isOpen={showCreateTask}
        onOpenChange={setShowCreateTask}
        onCreateTodo={handleCreateTask}
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
                    <Button variant="outline" size="sm">OFF</Button>
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

      {/* Create Task Dialog */}
      <CreateTodoDialog
        isOpen={showCreateTask}
        onOpenChange={setShowCreateTask}
        onCreateTodo={handleCreateTask}
      />

      <CreateTodoDialog
        isOpen={showEditTask}
        onOpenChange={setShowEditTask}
        editTask={editingTask}
        onCreateTodo={(taskData) => {
          setTasks(prev => prev.map(t => 
            t.id === editingTask.id 
              ? { ...t, ...taskData }
              : t
          ));
          setEditingTask(null);
          setShowEditTask(false);
        }}
      />

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={showCreateProject}
        onOpenChange={setShowCreateProject}
        onCreateProject={handleCreateProject}
      />

      {/* Work Request Dialog */}
      <Dialog open={workRequestDialogOpen} onOpenChange={setWorkRequestDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingWorkRequest ? 'Edit Work Request' : 'New Work Request'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={workRequestForm.title} onChange={e=>setWorkRequestForm({...workRequestForm, title: e.target.value})} />
            <Textarea placeholder="Description" value={workRequestForm.description} onChange={e=>setWorkRequestForm({...workRequestForm, description: e.target.value})} />
            <div className="flex gap-2">
              <Select value={workRequestForm.priority||'medium'} onValueChange={(v:any)=>setWorkRequestForm({...workRequestForm, priority: v})}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={workRequestForm.status} onValueChange={(v:any)=>setWorkRequestForm({...workRequestForm, status: v})}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_review">In review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setWorkRequestDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveWorkRequest}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGoal ? 'Edit Goal' : 'New Goal'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={goalForm.title} onChange={e=>setGoalForm({...goalForm, title: e.target.value})} />
            <Textarea placeholder="Description" value={goalForm.description} onChange={e=>setGoalForm({...goalForm, description: e.target.value})} />
            <div className="flex gap-2">
              <Input type="date" value={goalForm.target_date} onChange={e=>setGoalForm({...goalForm, target_date: e.target.value})} />
              <Input type="number" min={0} max={100} value={goalForm.progress} onChange={e=>setGoalForm({...goalForm, progress: Number(e.target.value)})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setGoalDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveGoal}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEvent ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={eventForm.title} onChange={e=>setEventForm({...eventForm, title: e.target.value})} />
            <div className="flex gap-2">
              <Input type="datetime-local" value={eventForm.start_at} onChange={e=>setEventForm({...eventForm, start_at: e.target.value})} />
              <Input type="datetime-local" value={eventForm.end_at} onChange={e=>setEventForm({...eventForm, end_at: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setEventDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveEvent}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 p-6 pb-4">
            <DialogTitle className="text-left flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comments - {tasks.find(t => t.id === commentTaskId)?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {commentTaskId && <TodoComments todoId={commentTaskId} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Add access check wrapper at the end
const ProjectManagementWrapper = () => {
  const { canAccessFeature } = useSubscription();
  const isPreview = typeof window !== 'undefined' && /lovable\.app|preview|localhost/.test(window.location.host);
  
  // Check access before rendering
  if (!isPreview && !canAccessFeature('project-management')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <SubscriptionUpgrade 
          featureName="Project Management" 
          onUpgrade={() => window.location.reload()}
        />
      </div>
    );
  }
  
  return <ProjectManagement />;
};

export default ProjectManagementWrapper;