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
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

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
  trigger: string;
  action: string;
  conditions: any[];
  enabled: boolean;
}

interface Integration {
  id: string;
  name: string;
  type: 'trello' | 'notion' | 'google-calendar' | 'slack' | 'gmail' | 'twilio' | 'calendly' | 'zapier';
  status: 'connected' | 'disconnected' | 'error';
  config: any;
  lastSync?: Date;
}

const ProjectManagement = () => {
  console.log('🔧 ProjectManagement component loading...');
  const { user } = useAuth();
  const { canAccessFeature } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar' | 'timeline'>('kanban');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);

  // Check if user can access Project Management features
  const canAccessPM = canAccessFeature('project-management');
  console.log('🔧 ProjectManagement - canAccessPM:', canAccessPM, 'user:', !!user);

  useEffect(() => {
    console.log('🔧 ProjectManagement useEffect triggered', { user: !!user, canAccessPM });
    if (user && canAccessPM) {
      // Future: Load project data from database
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user, canAccessPM]);

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
    return matchesSearch && matchesProject;
  });

  const EnhancedKanbanBoard = () => (
    <div className="space-y-6">
      {/* Custom Board Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Customize Board
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAutomationBuilder(true)}>
                <Zap className="w-4 h-4 mr-2" />
                Automation Rules
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800">Auto-Assignment: ON</Badge>
              <Badge className="bg-green-100 text-green-800">Notifications: ON</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statusColumns.map(column => (
          <div key={column.id} className={`${column.color} rounded-lg p-4 min-h-[700px] animate-fade-in`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{column.title}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {filteredTasks.filter(task => task.status === column.id).length}
                </Badge>
                <Button variant="ghost" size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredTasks
                .filter(task => task.status === column.id)
                .map(task => (
                  <Card key={task.id} className="cursor-pointer hover:shadow-lg transition-all hover-scale">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`}></div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                      
                      {/* Progress Bar */}
                      {task.progress && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all" 
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Subtasks */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <ListCheck className="w-3 h-3" />
                            <span>
                              {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} subtasks
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {task.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                            {tag}
                          </Badge>
                        ))}
                        {task.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
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
                          {task.comments && task.comments.length > 0 && (
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{task.comments.length}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <CalendarIcon className="w-3 h-3" />
                              {format(task.dueDate, 'MMM dd')}
                            </div>
                          )}
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">
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
                <Button variant="outline" size="sm" className="flex-1">
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
              <Button variant="outline" size="sm" className="w-full">
                Connect Gmail
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-6 h-6 text-green-600" />
                <span className="font-medium">Twilio</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">SMS notifications and call tracking</p>
              <Button variant="outline" size="sm" className="w-full">
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
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium">Auto-assign tasks by tags</h5>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                When a task with "urgent" tag is created → Auto-assign to available team lead
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Edit</Button>
                <Button variant="outline" size="sm">Disable</Button>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium">Deadline notifications</h5>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                When task due date is 2 days away → Send Slack notification to assignee
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Edit</Button>
                <Button variant="outline" size="sm">Disable</Button>
              </div>
            </div>
            
            <Button variant="outline" className="w-full" onClick={() => setShowAutomationBuilder(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Automation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management Hub</h1>
          <p className="text-gray-600">AI-powered project management inspired by Salesforce & HubSpot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAIAssistant(true)}>
            <Brain className="w-4 h-4 mr-2" />
            AI Assistant
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
                  <SelectItem key={project.id} value={project.name}>
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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="communication">Client Comm</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {activeView === 'kanban' && <EnhancedKanbanBoard />}
          {activeView === 'list' && <div>List view implementation</div>}
          {activeView === 'calendar' && <div>Calendar view implementation</div>}
        </TabsContent>

        <TabsContent value="milestones" className="mt-6">
          <MilestonesView />
        </TabsContent>

        <TabsContent value="communication" className="mt-6">
          <ClientCommunicationView />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ReportingDashboard />
        </TabsContent>

        <TabsContent value="collaboration" className="mt-6">
          <TeamCollaborationView />
        </TabsContent>

        <TabsContent value="ai-assistant" className="mt-6">
          <AIAssistantView />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsView />
        </TabsContent>
      </Tabs>

      {/* Enhanced Create Task Modal */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <Input placeholder="Task title" />
              <Textarea placeholder="Detailed description" />
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.name}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="john">John Doe</SelectItem>
                    <SelectItem value="jane">Jane Smith</SelectItem>
                    <SelectItem value="mike">Mike Johnson</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-4">
              <Input placeholder="Estimated hours" type="number" />
              <Input placeholder="Tags (comma separated)" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Pick due date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" />
                </PopoverContent>
              </Popover>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Add Subtasks</p>
                <div className="space-y-2">
                  <Input placeholder="Subtask 1" />
                  <Input placeholder="Subtask 2" />
                  <Button variant="outline" size="sm">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Subtask
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
            <Button variant="outline">
              <Brain className="w-4 h-4 mr-2" />
              AI Suggestions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Button className="flex-1">
                <Zap className="w-4 h-4 mr-2" />
                Create Automation
              </Button>
              <Button variant="outline">Test Rule</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectManagement;