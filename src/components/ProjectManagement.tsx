import React, { useState } from 'react';
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
  Award
} from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'completed';
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
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignee: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  project: string;
  completed: boolean;
  progress: number;
}

interface ActivityLog {
  id: string;
  type: 'task_created' | 'task_updated' | 'comment_added' | 'file_uploaded' | 'client_email' | 'meeting_scheduled';
  description: string;
  user: string;
  timestamp: Date;
  projectId: string;
  taskId?: string;
}

interface ClientCommunication {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note';
  subject: string;
  content: string;
  clientName: string;
  projectId: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'scheduled';
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  progress: number;
  members: string[];
  deadline: Date | null;
}

const ProjectManagement = () => {
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Design user interface mockups',
      description: 'Create wireframes and high-fidelity mockups for the new dashboard',
      status: 'in-progress',
      priority: 'high',
      assignee: 'John Doe',
      dueDate: new Date(2024, 1, 15),
      project: 'Website Redesign',
      tags: ['design', 'ui/ux']
    },
    {
      id: '2',
      title: 'Implement authentication system',
      description: 'Set up user login and registration functionality',
      status: 'todo',
      priority: 'urgent',
      assignee: 'Jane Smith',
      dueDate: new Date(2024, 1, 20),
      project: 'Backend Development',
      tags: ['development', 'security']
    },
    {
      id: '3',
      title: 'Write project documentation',
      description: 'Create comprehensive documentation for the API',
      status: 'review',
      priority: 'medium',
      assignee: 'Mike Johnson',
      dueDate: new Date(2024, 1, 25),
      project: 'Documentation',
      tags: ['documentation', 'api']
    }
  ]);

  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign',
      description: 'Complete overhaul of company website',
      color: 'bg-blue-500',
      progress: 65,
      members: ['JD', 'JS', 'MJ'],
      deadline: new Date(2024, 2, 30)
    },
    {
      id: '2',
      name: 'Backend Development',
      description: 'API and database implementation',
      color: 'bg-green-500',
      progress: 40,
      members: ['JS', 'AB'],
      deadline: new Date(2024, 3, 15)
    }
  ]);

  const [milestones, setMilestones] = useState<Milestone[]>([
    {
      id: '1',
      title: 'MVP Release',
      description: 'Launch minimum viable product',
      dueDate: new Date(2024, 2, 15),
      project: 'Website Redesign',
      completed: false,
      progress: 75
    },
    {
      id: '2',
      title: 'API Documentation Complete',
      description: 'Finish all API documentation',
      dueDate: new Date(2024, 3, 1),
      project: 'Backend Development',
      completed: false,
      progress: 60
    }
  ]);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    {
      id: '1',
      type: 'task_created',
      description: 'Created new task: Design user interface mockups',
      user: 'John Doe',
      timestamp: new Date(2024, 1, 10),
      projectId: '1'
    },
    {
      id: '2',
      type: 'client_email',
      description: 'Sent project update email to client',
      user: 'Jane Smith',
      timestamp: new Date(2024, 1, 11),
      projectId: '1'
    }
  ]);

  const [clientCommunications, setClientCommunications] = useState<ClientCommunication[]>([
    {
      id: '1',
      type: 'email',
      subject: 'Project Update - Website Redesign',
      content: 'Weekly progress update on the website redesign project...',
      clientName: 'Tech Corp',
      projectId: '1',
      timestamp: new Date(2024, 1, 11),
      status: 'completed'
    },
    {
      id: '2',
      type: 'meeting',
      subject: 'Requirements Review Meeting',
      content: 'Scheduled to review backend API requirements',
      clientName: 'Startup Inc',
      projectId: '2',
      timestamp: new Date(2024, 1, 15),
      status: 'scheduled'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  const statusColumns = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'review', title: 'Review', color: 'bg-yellow-100' },
    { id: 'completed', title: 'Completed', color: 'bg-green-100' }
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

  const KanbanBoard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statusColumns.map(column => (
        <div key={column.id} className={`${column.color} rounded-lg p-4 min-h-[600px]`}>
          <h3 className="font-semibold mb-4 flex items-center justify-between">
            {column.title}
            <Badge variant="secondary">
              {filteredTasks.filter(task => task.status === column.id).length}
            </Badge>
          </h3>
          <div className="space-y-3">
            {filteredTasks
              .filter(task => task.status === column.id)
              .map(task => (
                <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`}></div>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">{task.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {task.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {task.assignee.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    {task.dueDate && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                        <CalendarIcon className="w-3 h-3" />
                        {format(task.dueDate, 'MMM dd')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );

  const ListView = () => (
    <div className="space-y-2">
      {filteredTasks.map(task => (
        <Card key={task.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-3 h-3 rounded-full ${priorityColors[task.priority]}`}></div>
                <div className="flex-1">
                  <h4 className="font-medium">{task.title}</h4>
                  <p className="text-sm text-gray-600">{task.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline">{task.status.replace('-', ' ')}</Badge>
                <Badge variant="secondary">{task.project}</Badge>
                <Avatar className="w-8 h-8">
                  <AvatarFallback>
                    {task.assignee.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                {task.dueDate && (
                  <span className="text-sm text-gray-500">
                    {format(task.dueDate, 'MMM dd')}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management</h1>
          <p className="text-gray-600">Organize and track your projects efficiently</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Task title" />
                <Textarea placeholder="Task description" />
                <div className="grid grid-cols-2 gap-4">
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
                <Button className="w-full">Create Task</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
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
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'in-progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search tasks..."
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="client">Client Comm</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="ai">AI Tools</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <div className="space-y-6">
            {activeView === 'kanban' && <KanbanBoard />}
            {activeView === 'list' && <ListView />}
          </div>
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Project Milestones</h3>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Milestone
            </Button>
          </div>
          <div className="grid gap-4">
            {milestones.map(milestone => (
              <Card key={milestone.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Flag className="w-5 h-5 text-orange-500" />
                      <div>
                        <h4 className="font-semibold">{milestone.title}</h4>
                        <p className="text-sm text-gray-600">{milestone.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={milestone.completed ? "default" : "secondary"}>
                        {milestone.completed ? "Completed" : "In Progress"}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        Due: {format(milestone.dueDate, 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{milestone.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${milestone.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Client Communication Tab */}
        <TabsContent value="client" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Client Communications</h3>
            <div className="flex gap-2">
              <Button variant="outline">
                <Phone className="w-4 h-4 mr-2" />
                Schedule Call
              </Button>
              <Button>
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </div>
          </div>
          <div className="grid gap-4">
            {clientCommunications.map(comm => (
              <Card key={comm.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {comm.type === 'email' && <Mail className="w-5 h-5 text-blue-500" />}
                      {comm.type === 'call' && <Phone className="w-5 h-5 text-green-500" />}
                      {comm.type === 'meeting' && <Video className="w-5 h-5 text-purple-500" />}
                      {comm.type === 'note' && <FileText className="w-5 h-5 text-gray-500" />}
                      <div>
                        <h4 className="font-semibold">{comm.subject}</h4>
                        <p className="text-sm text-gray-600">{comm.clientName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={comm.status === 'completed' ? "default" : comm.status === 'scheduled' ? "secondary" : "outline"}>
                        {comm.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(comm.timestamp, 'MMM dd, hh:mm a')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{comm.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Workflow Automation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Auto-assign tasks by tag</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <p className="text-sm text-gray-600">Automatically assign tasks based on project tags</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Deadline reminders</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <p className="text-sm text-gray-600">Send notifications 24h before due date</p>
                </div>
                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workflow
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="w-5 h-5" />
                  External Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      <span>Zapier</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      <span>Google Calendar</span>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Setup Required</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      <span>Slack</span>
                    </div>
                    <Badge className="bg-gray-100 text-gray-800">Available</Badge>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Integrations
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Activity Timeline</h3>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
          <div className="space-y-4">
            {activityLogs.map(log => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {log.type === 'task_created' && <Plus className="w-4 h-4 text-blue-500" />}
                      {log.type === 'task_updated' && <Settings className="w-4 h-4 text-orange-500" />}
                      {log.type === 'comment_added' && <MessageCircle className="w-4 h-4 text-green-500" />}
                      {log.type === 'file_uploaded' && <Paperclip className="w-4 h-4 text-purple-500" />}
                      {log.type === 'client_email' && <Mail className="w-4 h-4 text-blue-500" />}
                      {log.type === 'meeting_scheduled' && <CalendarIcon className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{log.user}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {format(log.timestamp, 'MMM dd, hh:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Project Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Tasks Completed</span>
                    <span className="font-semibold">67%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-time Delivery</span>
                    <span className="font-semibold">92%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Team Utilization</span>
                    <span className="font-semibold">85%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Time Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Hours This Week</span>
                    <span className="font-semibold">142h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. per Task</span>
                    <span className="font-semibold">8.5h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime</span>
                    <span className="font-semibold text-orange-600">12h</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Client Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Avg. Rating</span>
                    <span className="font-semibold">4.8/5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Response Time</span>
                    <span className="font-semibold">2.3h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Repeat Clients</span>
                    <span className="font-semibold">78%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>External Reporting Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4" />
                    <span className="font-medium">Google Looker Studio</span>
                  </div>
                  <p className="text-sm text-gray-600">Advanced dashboards & analytics</p>
                  <Badge className="mt-2 bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4" />
                    <span className="font-medium">Metabase</span>
                  </div>
                  <p className="text-sm text-gray-600">Self-service BI platform</p>
                  <Badge className="mt-2 bg-yellow-100 text-yellow-800">Setup Required</Badge>
                </div>
                <div className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4" />
                    <span className="font-medium">BigQuery</span>
                  </div>
                  <p className="text-sm text-gray-600">Data warehouse & analytics</p>
                  <Badge className="mt-2 bg-gray-100 text-gray-800">Available</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Tools Tab */}
        <TabsContent value="ai" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Assistant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea placeholder="Ask AI to help with project planning, task prioritization, or generate updates..." />
                <Button className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Ask AI
                </Button>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Quick Actions:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="cursor-pointer">Summarize project</Badge>
                    <Badge variant="outline" className="cursor-pointer">Suggest priorities</Badge>
                    <Badge variant="outline" className="cursor-pointer">Generate client email</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Smart Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Auto Task Prioritization</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Smart Time Estimates</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Risk Prediction</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Beta</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Auto Status Updates</span>
                    <Badge className="bg-gray-100 text-gray-800">Coming Soon</Badge>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure AI Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Productivity Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Notion</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>ClickUp</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
                </div>
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Trello</span>
                  </div>
                  <Badge className="bg-gray-100 text-gray-800">Available</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Communication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Slack</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Microsoft Teams</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">Available</Badge>
                </div>
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Discord</span>
                  </div>
                  <Badge className="bg-gray-100 text-gray-800">Available</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Third-party Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Calendly</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Stripe</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">Setup Required</Badge>
                </div>
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    <span>Plaid</span>
                  </div>
                  <Badge className="bg-gray-100 text-gray-800">Available</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Projects Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map(project => (
                <Card key={project.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${project.color}`}></div>
                        <h3 className="font-semibold">{project.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {project.members.map(member => (
                          <Avatar key={member} className="w-6 h-6">
                            <AvatarFallback className="text-xs">{member}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{project.description}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${project.color}`}
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                    </div>
                    {project.deadline && (
                      <div className="flex items-center gap-1 mt-3 text-xs text-gray-500">
                        <CalendarIcon className="w-3 h-3" />
                        Due {format(project.deadline, 'MMM dd, yyyy')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};

export default ProjectManagement;