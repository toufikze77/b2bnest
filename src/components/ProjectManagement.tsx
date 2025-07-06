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
  Zap
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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [showCreateTask, setShowCreateTask] = useState(false);

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

      {/* Main Content */}
      <div className="space-y-6">
        {activeView === 'kanban' && <KanbanBoard />}
        {activeView === 'list' && <ListView />}
      </div>

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
    </div>
  );
};

export default ProjectManagement;