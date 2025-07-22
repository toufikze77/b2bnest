import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, Plus, Filter, MapPin, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TodoCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Mock calendar data
  const calendarTasks = [
    {
      id: '1',
      title: 'Design Review Meeting',
      date: '2024-01-15',
      time: '10:00',
      duration: 60,
      type: 'meeting',
      priority: 'high',
      attendees: ['John Doe', 'Jane Smith'],
      location: 'Conference Room A'
    },
    {
      id: '2',
      title: 'Complete Figma Mockups',
      date: '2024-01-15',
      time: '14:00',
      duration: 120,
      type: 'task',
      priority: 'high',
      source: 'figma'
    },
    {
      id: '3',
      title: 'Code Review',
      date: '2024-01-16',
      time: '09:00',
      duration: 45,
      type: 'task',
      priority: 'medium',
      source: 'github'
    },
    {
      id: '4',
      title: 'Team Standup',
      date: '2024-01-16',
      time: '15:30',
      duration: 30,
      type: 'meeting',
      priority: 'medium',
      attendees: ['Team'],
      recurring: true
    },
    {
      id: '5',
      title: 'Update Documentation',
      date: '2024-01-17',
      time: '11:00',
      duration: 90,
      type: 'task',
      priority: 'low',
      source: 'onedrive'
    }
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return calendarTasks.filter(task => task.date === dateString);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <Users className="h-4 w-4" />;
      case 'task': return <CalendarIcon className="h-4 w-4" />;
      default: return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const monthDays = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-48 text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Select value={view} onValueChange={(value: any) => setView(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
            </SelectContent>
          </Select>
          
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              {view === 'month' && (
                <div className="grid grid-cols-7 gap-1">
                  {/* Week day headers */}
                  {weekDays.map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar days */}
                  {monthDays.map((day, index) => {
                    if (!day) {
                      return <div key={index} className="p-2 h-24" />;
                    }
                    
                    const dayTasks = getTasksForDate(day);
                    const isToday = day.toDateString() === today.toDateString();
                    const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
                    
                    return (
                      <div
                        key={index}
                        className={`p-2 h-24 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
                          isToday ? 'bg-blue-50 border-blue-200' : ''
                        } ${isSelected ? 'bg-blue-100 border-blue-300' : ''}`}
                        onClick={() => setSelectedDate(day)}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          isToday ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 2).map(task => (
                            <div
                              key={task.id}
                              className={`text-xs p-1 rounded border-l-2 truncate ${getPriorityColor(task.priority)}`}
                            >
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{dayTasks.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === 'week' && (
                <div className="space-y-4">
                  <div className="text-center text-lg font-semibold text-gray-900">
                    Week View - Coming Soon
                  </div>
                  <p className="text-center text-gray-600">
                    Week view with time slots and drag-and-drop scheduling
                  </p>
                </div>
              )}

              {view === 'day' && (
                <div className="space-y-4">
                  <div className="text-center text-lg font-semibold text-gray-900">
                    Day View - Coming Soon
                  </div>
                  <p className="text-center text-gray-600">
                    Detailed day view with hourly time blocks
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Today's Schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getTasksForDate(today).length > 0 ? (
                  getTasksForDate(today)
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map(task => (
                      <div key={task.id} className={`p-3 rounded-lg border-l-4 ${getPriorityColor(task.priority)}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            {getTypeIcon(task.type)}
                            <span className="font-medium text-sm">{task.title}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600 flex items-center space-x-2">
                          <span>{formatTime(task.time)}</span>
                          <span>•</span>
                          <span>{task.duration}min</span>
                        </div>
                        {task.location && (
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            {task.location}
                          </div>
                        )}
                        {task.attendees && (
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <Users className="h-3 w-3 mr-1" />
                            {task.attendees.join(', ')}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No tasks scheduled for today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {formatDate(selectedDate)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getTasksForDate(selectedDate).length > 0 ? (
                    getTasksForDate(selectedDate)
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map(task => (
                        <div key={task.id} className={`p-3 rounded-lg border-l-4 ${getPriorityColor(task.priority)}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              {getTypeIcon(task.type)}
                              <span className="font-medium text-sm">{task.title}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatTime(task.time)} • {task.duration}min
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">No tasks scheduled</p>
                      <Button size="sm" className="mt-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Task
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Tasks</span>
                  <span className="font-semibold">{calendarTasks.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Meetings</span>
                  <span className="font-semibold">
                    {calendarTasks.filter(t => t.type === 'meeting').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">High Priority</span>
                  <span className="font-semibold text-orange-600">
                    {calendarTasks.filter(t => t.priority === 'high').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Time</span>
                  <span className="font-semibold">
                    {Math.round(calendarTasks.reduce((sum, task) => sum + task.duration, 0) / 60)}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};