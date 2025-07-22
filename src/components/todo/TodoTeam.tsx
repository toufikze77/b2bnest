import React, { useState } from 'react';
import { 
  Users, Plus, Search, Filter, MoreHorizontal, 
  User, Calendar, Clock, Target, TrendingUp,
  MessageSquare, Mail, Phone, MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TodoTeam: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Mock team data
  const teamMembers = [
    {
      id: '1',
      name: 'John Doe',
      role: 'Frontend Developer',
      department: 'Engineering',
      email: 'john.doe@company.com',
      phone: '+1 (555) 123-4567',
      avatar: '',
      status: 'online',
      timezone: 'PST',
      tasksAssigned: 15,
      tasksCompleted: 12,
      completionRate: 80,
      currentTasks: [
        { id: '1', title: 'Implement user dashboard', priority: 'high', dueDate: '2024-01-15' },
        { id: '2', title: 'Fix responsive layout issues', priority: 'medium', dueDate: '2024-01-16' },
        { id: '3', title: 'Update documentation', priority: 'low', dueDate: '2024-01-18' }
      ],
      recentActivity: [
        { action: 'Completed task', task: 'Login page redesign', time: '2 hours ago' },
        { action: 'Started task', task: 'User dashboard', time: '4 hours ago' },
        { action: 'Commented on', task: 'API integration', time: '1 day ago' }
      ],
      skills: ['React', 'TypeScript', 'CSS', 'JavaScript'],
      workload: 85 // percentage
    },
    {
      id: '2',
      name: 'Jane Smith',
      role: 'UX Designer',
      department: 'Design',
      email: 'jane.smith@company.com',
      phone: '+1 (555) 234-5678',
      avatar: '',
      status: 'away',
      timezone: 'EST',
      tasksAssigned: 12,
      tasksCompleted: 10,
      completionRate: 83,
      currentTasks: [
        { id: '4', title: 'Design mobile wireframes', priority: 'high', dueDate: '2024-01-14' },
        { id: '5', title: 'User research analysis', priority: 'medium', dueDate: '2024-01-17' }
      ],
      recentActivity: [
        { action: 'Completed task', task: 'Wireframe review', time: '1 hour ago' },
        { action: 'Updated task', task: 'Mobile wireframes', time: '3 hours ago' },
        { action: 'Created task', task: 'User testing plan', time: '1 day ago' }
      ],
      skills: ['Figma', 'Sketch', 'Prototyping', 'User Research'],
      workload: 70
    },
    {
      id: '3',
      name: 'Mike Johnson',
      role: 'Backend Developer',
      department: 'Engineering',
      email: 'mike.johnson@company.com',
      phone: '+1 (555) 345-6789',
      avatar: '',
      status: 'offline',
      timezone: 'CST',
      tasksAssigned: 18,
      tasksCompleted: 14,
      completionRate: 78,
      currentTasks: [
        { id: '6', title: 'Database optimization', priority: 'urgent', dueDate: '2024-01-13' },
        { id: '7', title: 'API endpoint development', priority: 'high', dueDate: '2024-01-15' },
        { id: '8', title: 'Security audit', priority: 'medium', dueDate: '2024-01-20' }
      ],
      recentActivity: [
        { action: 'Completed task', task: 'Server migration', time: '5 hours ago' },
        { action: 'Started task', task: 'Database optimization', time: '6 hours ago' },
        { action: 'Reviewed', task: 'Code review #123', time: '2 days ago' }
      ],
      skills: ['Node.js', 'Python', 'PostgreSQL', 'AWS'],
      workload: 95
    },
    {
      id: '4',
      name: 'Sarah Wilson',
      role: 'Product Manager',
      department: 'Product',
      email: 'sarah.wilson@company.com',
      phone: '+1 (555) 456-7890',
      avatar: '',
      status: 'online',
      timezone: 'PST',
      tasksAssigned: 10,
      tasksCompleted: 9,
      completionRate: 90,
      currentTasks: [
        { id: '9', title: 'Product roadmap review', priority: 'high', dueDate: '2024-01-16' },
        { id: '10', title: 'Stakeholder meeting prep', priority: 'medium', dueDate: '2024-01-17' }
      ],
      recentActivity: [
        { action: 'Completed task', task: 'Sprint planning', time: '30 minutes ago' },
        { action: 'Created task', task: 'Product roadmap review', time: '2 hours ago' },
        { action: 'Assigned task', task: 'User research', time: '4 hours ago' }
      ],
      skills: ['Product Strategy', 'Agile', 'Analytics', 'Leadership'],
      workload: 60
    }
  ];

  const departments = ['all', 'Engineering', 'Design', 'Product', 'Marketing'];

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || member.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload >= 90) return 'bg-red-500';
    if (workload >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const teamStats = {
    totalMembers: teamMembers.length,
    activeMembers: teamMembers.filter(m => m.status === 'online').length,
    totalTasks: teamMembers.reduce((sum, m) => sum + m.tasksAssigned, 0),
    completedTasks: teamMembers.reduce((sum, m) => sum + m.tasksCompleted, 0),
    averageCompletion: Math.round(teamMembers.reduce((sum, m) => sum + m.completionRate, 0) / teamMembers.length),
    overloadedMembers: teamMembers.filter(m => m.workload >= 90).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
          <p className="text-gray-600">Manage team members, assignments, and collaboration</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Team Members</p>
                <p className="text-2xl font-bold">{teamStats.totalMembers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Now</p>
                <p className="text-2xl font-bold text-green-600">{teamStats.activeMembers}</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold">{teamStats.totalTasks}</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold">{teamStats.averageCompletion}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overloaded</p>
                <p className="text-2xl font-bold text-red-600">{teamStats.overloadedMembers}</p>
              </div>
              <div className="w-3 h-3 bg-red-500 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>
                {dept === 'all' ? 'All Departments' : dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map(member => (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} alt={member.name} />
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600">{member.role}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {member.department}
                        </Badge>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send Message
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <User className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Performance Stats */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Task Completion</span>
                      <span className="text-sm font-medium">
                        {member.tasksCompleted}/{member.tasksAssigned}
                      </span>
                    </div>
                    <Progress value={member.completionRate} className="h-2" />
                    <div className="text-center text-sm text-gray-600">
                      {member.completionRate}% completion rate
                    </div>
                  </div>

                  {/* Current Tasks */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Current Tasks</h4>
                    {member.currentTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-center justify-between text-sm">
                        <span className="truncate flex-1 mr-2">{task.title}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(task.priority)}`}
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    ))}
                    {member.currentTasks.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{member.currentTasks.length - 3} more tasks
                      </p>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex items-center text-xs text-gray-600">
                      <Mail className="h-3 w-3 mr-2" />
                      {member.email}
                    </div>
                    <div className="flex items-center text-xs text-gray-600">
                      <Clock className="h-3 w-3 mr-2" />
                      {member.timezone}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Workload Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map(member => (
                  <div key={member.id} className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-gray-600">{member.role}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Workload</span>
                          <span className={member.workload >= 90 ? 'text-red-600 font-medium' : ''}>
                            {member.workload}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getWorkloadColor(member.workload)}`}
                            style={{ width: `${member.workload}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm font-medium">{member.tasksAssigned}</p>
                        <p className="text-xs text-gray-600">tasks</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {teamMembers.map(member => (
              <Card key={member.id}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{member.name}</CardTitle>
                      <p className="text-sm text-gray-600">Recent Activity</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {member.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{activity.action}</span>
                            {activity.task && (
                              <span className="text-gray-600"> "{activity.task}"</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};