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
  ArrowUp,
  ArrowDown,
  GripVertical,
  Trash2,
  Flag,
  Brain,
  Bot,
  Lightbulb,
  Video,
  Paperclip,
  Eye,
  Edit,
  ExternalLink,
  TrendingUp,
  Share2,
  Activity,
  FolderOpen,
  HardDrive,
  Cloud,
  Slack,
  BellRing,
  Bell,
  Workflow,
  Send,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Sortable Task Component
const SortableTask = ({ task, onUpdate }: { task: Task; onUpdate?: (task: Task) => void }) => {
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
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200',
    urgent: 'bg-purple-100 text-purple-800 border-purple-200'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-shadow"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-sm">{task.title}</h4>
        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
      </div>
      {task.description && (
        <p className="text-xs text-gray-600 mb-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <Badge className={`text-xs px-2 py-1 ${priorityColors[task.priority]}`}>
          {task.priority}
        </Badge>
        {task.assignee && (
          <span className="text-xs text-gray-500">{task.assignee}</span>
        )}
      </div>
    </div>
  );
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
      description: 'Create wireframes and mockups for the new homepage design',
      status: 'in-progress',
      priority: 'high',
      assignee: 'John Doe',
      dueDate: new Date(2024, 1, 15),
      project: '1',
      tags: ['design', 'frontend'],
      timeTracked: 8,
      estimatedHours: 20,
      actualHours: 8,
      progress: 40,
      comments: []
    }
  ]);

  const [newGoal, setNewGoal] = useState({ title: '', description: '', targetValue: 100, deadline: '' });
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[]>([
    {
      id: '1',
      title: 'Design Phase Complete',
      description: 'All design mockups and prototypes ready for development',
      dueDate: new Date(2024, 1, 28),
      project: '1',
      completed: false,
      progress: 80,
      tasks: ['1'],
      aiInsights: 'Current progress is on track. Recommend focusing on responsive design aspects.'
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
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMemberItem[]>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);

  // Work Requests dialogs and filters
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Goal saving function
  const saveGoal = async () => {
    const title = (newGoal.title || '').trim();
    if (!title) {
      toast({ title: 'Missing Information', description: 'Please enter a goal title.', variant: 'destructive' });
      return;
    }
    if (!user?.id) {
      toast({ title: 'Authentication Error', description: 'Please sign in to create goals.', variant: 'destructive' });
      return;
    }

    try {
      const goal: Goal = {
        id: Date.now().toString(),
        title,
        description: (newGoal.description || '').trim(),
        targetValue: newGoal.targetValue || 100,
        currentValue: 0,
        deadline: newGoal.deadline || '',
        projectId: typeof selectedProject === 'string' ? selectedProject : '',
        userId: user.id,
      };

      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem('projectGoals');
          const existing = raw ? JSON.parse(raw) : [];
          const updated = [goal, ...existing];
          window.localStorage.setItem('projectGoals', JSON.stringify(updated));
          
          // Update state
          setGoals(prev => [{ 
            id: goal.id, 
            user_id: goal.userId, 
            title: goal.title, 
            description: goal.description, 
            target_date: goal.deadline, 
            progress: 0, 
            created_at: new Date().toISOString() 
          }, ...prev]);
        } catch (error) {
          console.error('localStorage error:', error);
        }
      }

      setNewGoal({ title: '', description: '', targetValue: 100, deadline: '' });
      setIsAddingGoal(false);
      toast({ title: 'Goal Created', description: `"${goal.title}" has been added successfully.` });

    } catch (error) {
      console.error('Error creating goal:', error);
      toast({ title: 'Error', description: 'Failed to create goal. Please try again.', variant: 'destructive' });
    }
  };

  // Drag end handler
  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Filter tasks by status for kanban columns
  const getTasksByStatus = (status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  };

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
    
    try {
      const { data, error } = await supabase.from('goals' as any).insert({ 
        title, 
        target_date: target, 
        progress: 0,
        user_id: user?.id // Add user_id to ensure proper ownership
      }).select().single();
      
      if (error) {
        console.error('Error creating goal:', error);
        toast({
          title: "Error",
          description: "Failed to create goal. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      if (data) {
        setGoals(prev => [data as unknown as GoalItem, ...prev]);
        toast({
          title: "Success",
          description: "Goal created successfully!",
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const createTeam = async () => {
    const name = window.prompt('Team name');
    if (!name) return;
    const { data, error } = await supabase.from('teams' as any).insert({ name }).select().single();
    if (!error && data) setTeams(prev => [data as unknown as TeamItem, ...prev]);
  };

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

  // Access check moved to top of component

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

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

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      handleTaskStatusUpdate(taskId, columnId);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
            <p className="text-gray-600">Manage projects, tasks, and goals efficiently</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setShowCreateProject(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="space-y-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-5 gap-4">
                {['backlog', 'todo', 'in-progress', 'review', 'done'].map((status) => (
                  <Card key={status} className="min-h-[400px]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium capitalize">
                        {status.replace('-', ' ')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <SortableContext 
                        items={getTasksByStatus(status as Task['status']).map(task => task.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {getTasksByStatus(status as Task['status']).map((task) => (
                          <SortableTask
                            key={task.id}
                            task={task}
                          />
                        ))}
                      </SortableContext>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DndContext>
          </TabsContent>

          <TabsContent value="goals" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project Goals</CardTitle>
                  <Button onClick={() => setIsAddingGoal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Goal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isAddingGoal && (
                  <div className="border rounded-lg p-4 mb-4 space-y-4">
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
                    <Input
                      type="number"
                      placeholder="Target value"
                      value={newGoal.targetValue}
                      onChange={(e) => setNewGoal(prev => ({ ...prev, targetValue: parseInt(e.target.value) || 100 }))}
                    />
                    <Input
                      type="date"
                      value={newGoal.deadline}
                      onChange={(e) => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveGoal}>Save Goal</Button>
                      <Button variant="outline" onClick={() => setIsAddingGoal(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <div key={goal.id} className="border rounded-lg p-4">
                      <h3 className="font-medium">{goal.title}</h3>
                      {goal.description && (
                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                      )}
                      <div className="mt-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{goal.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Additional TabsContent for other tabs can be added here */}

        </Tabs>
      </div>
    </div>
  );
};

export default ProjectManagement;
