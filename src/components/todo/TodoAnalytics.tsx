import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, Calendar, Clock, Users, 
  Target, BarChart3, PieChart, Activity, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export const TodoAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');

  // Mock data - in real app, this would come from API
  const analyticsData = {
    overview: {
      totalTasks: 156,
      completedTasks: 134,
      completionRate: 85.9,
      averageCompletionTime: 2.3, // hours
      overdueTasks: 8,
      trendsUp: true
    },
    productivity: {
      tasksCompletedToday: 12,
      weeklyGoal: 50,
      weeklyProgress: 38,
      streak: 5, // days
      bestDay: 'Tuesday',
      mostProductiveHour: '10 AM'
    },
    integrations: {
      slack: { tasks: 45, completion: 92 },
      figma: { tasks: 23, completion: 87 },
      github: { tasks: 31, completion: 79 },
      onedrive: { tasks: 18, completion: 94 },
      manual: { tasks: 39, completion: 82 }
    },
    priorities: {
      urgent: { total: 12, completed: 8 },
      high: { total: 34, completed: 29 },
      medium: { total: 67, completed: 58 },
      low: { total: 43, completed: 39 }
    },
    teamPerformance: [
      { name: 'John Doe', completed: 23, assigned: 28, rate: 82 },
      { name: 'Jane Smith', completed: 19, assigned: 22, rate: 86 },
      { name: 'Mike Johnson', completed: 15, assigned: 20, rate: 75 },
      { name: 'Sarah Wilson', completed: 21, assigned: 24, rate: 88 }
    ],
    timeTracking: {
      totalTimeSpent: 127, // hours
      averageTaskTime: 48, // minutes
      longestTask: 240, // minutes
      shortestTask: 5, // minutes
    },
    weeklyData: [
      { day: 'Mon', completed: 8, created: 12 },
      { day: 'Tue', completed: 15, created: 10 },
      { day: 'Wed', completed: 12, created: 8 },
      { day: 'Thu', completed: 10, created: 14 },
      { day: 'Fri', completed: 13, created: 9 },
      { day: 'Sat', completed: 6, created: 4 },
      { day: 'Sun', completed: 4, created: 6 }
    ]
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Track your productivity and team performance</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.totalTasks}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center">
              {analyticsData.overview.trendsUp ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm ${analyticsData.overview.trendsUp ? 'text-green-600' : 'text-red-600'}`}>
                12% from last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.completionRate}%</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <Progress value={analyticsData.overview.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Completion Time</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.averageCompletionTime}h</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              2.1h faster than last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.overview.overdueTasks}</p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <Calendar className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-2 text-sm text-red-600">
              Needs attention
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="productivity" className="space-y-6">
        <TabsList>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Productivity Tab */}
        <TabsContent value="productivity" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daily Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Daily Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Today's Tasks</span>
                      <span className="text-sm text-gray-600">
                        {analyticsData.productivity.tasksCompletedToday}/15
                      </span>
                    </div>
                    <Progress value={(analyticsData.productivity.tasksCompletedToday / 15) * 100} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Weekly Goal</span>
                      <span className="text-sm text-gray-600">
                        {analyticsData.productivity.weeklyProgress}/{analyticsData.productivity.weeklyGoal}
                      </span>
                    </div>
                    <Progress value={(analyticsData.productivity.weeklyProgress / analyticsData.productivity.weeklyGoal) * 100} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{analyticsData.productivity.streak}</p>
                      <p className="text-sm text-gray-600">Day Streak</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{analyticsData.productivity.bestDay}</p>
                      <p className="text-sm text-gray-600">Best Day</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Priority Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5" />
                  <span>Priority Breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analyticsData.priorities).map(([priority, data]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`} />
                        <span className="capitalize font-medium">{priority}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {data.completed}/{data.total}
                        </span>
                        <div className="w-16">
                          <Progress value={(data.completed / data.total) * 100} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between space-x-2">
                {analyticsData.weeklyData.map((day, index) => (
                  <div key={day.day} className="flex-1 flex flex-col items-center space-y-2">
                    <div className="flex flex-col items-center space-y-1 w-full">
                      <div 
                        className="bg-blue-500 rounded-t w-full"
                        style={{ height: `${(day.completed / 20) * 200}px` }}
                      />
                      <div 
                        className="bg-gray-300 rounded-b w-full"
                        style={{ height: `${(day.created / 20) * 200}px` }}
                      />
                    </div>
                    <div className="text-xs text-center">
                      <p className="font-medium">{day.day}</p>
                      <p className="text-gray-500">{day.completed}/{day.created}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center space-x-6 mt-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span className="text-sm">Completed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-300 rounded" />
                  <span className="text-sm">Created</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Integration Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analyticsData.integrations).map(([integration, data]) => (
                    <div key={integration} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="capitalize font-medium">{integration}</span>
                        <Badge variant="secondary">{data.tasks} tasks</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{data.completion}%</span>
                        <div className="w-16">
                          <Progress value={data.completion} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Time Spent</span>
                    <span className="text-lg font-bold">{analyticsData.timeTracking.totalTimeSpent}h</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average Task Time</span>
                    <span className="text-lg font-bold">{formatTime(analyticsData.timeTracking.averageTaskTime)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Longest Task</span>
                    <span className="text-sm text-gray-600">{formatTime(analyticsData.timeTracking.longestTask)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Shortest Task</span>
                    <span className="text-sm text-gray-600">{formatTime(analyticsData.timeTracking.shortestTask)}</span>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-600">Most productive time:</p>
                    <p className="text-lg font-semibold text-blue-600">{analyticsData.productivity.mostProductiveHour}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Performance Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Team Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.teamPerformance.map((member, index) => (
                  <div key={member.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-gray-600">
                          {member.completed}/{member.assigned} tasks completed
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-24">
                        <Progress value={member.rate} />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{member.rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>📈 Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">🎯 High Performance</p>
                    <p className="text-sm text-green-700 mt-1">
                      Your completion rate is 15% higher than average this week!
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">⚡ Integration Success</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Slack integration is creating the most actionable tasks.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">⏰ Time Optimization</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Consider breaking down large tasks - they take 3x longer on average.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🎯 Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium">1. Schedule focused time blocks</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Your most productive time is 10 AM - consider blocking this time for high-priority tasks.
                    </p>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium">2. Enable more integrations</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Connect GitHub and Calendar to automatically track more tasks.
                    </p>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium">3. Review overdue tasks</p>
                    <p className="text-sm text-gray-600 mt-1">
                      You have 8 overdue tasks that might need deadline adjustments.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};