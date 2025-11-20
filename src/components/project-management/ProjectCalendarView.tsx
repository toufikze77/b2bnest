import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  MoreHorizontal
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

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
  subtasks?: any[];
  timeTracked?: number;
  clientFeedback?: string;
  attachments?: string[];
  estimatedHours?: number;
  actualHours?: number;
  comments?: any[];
  dependencies?: string[];
  progress?: number;
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

interface ProjectCalendarViewProps {
  tasks: Task[];
  events: CalendarEventItem[];
  onCreateEvent: (event: Partial<CalendarEventItem>) => void;
  onEditEvent: (event: CalendarEventItem) => void;
  onDeleteEvent: (event: CalendarEventItem) => void;
  onTaskClick: (task: Task) => void;
}

export const ProjectCalendarView: React.FC<ProjectCalendarViewProps> = ({
  tasks,
  events,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
  onTaskClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEventItem>>({});
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemDialog, setShowItemDialog] = useState(false);

  // Get unique assignees and statuses for filters
  const assignees = useMemo(() => {
    const uniqueAssignees = new Set<string>();
    tasks.forEach(t => t.assignee && uniqueAssignees.add(t.assignee));
    return Array.from(uniqueAssignees);
  }, [tasks]);

  const types = ['meeting', 'deadline', 'milestone', 'review'];

  const statuses = useMemo(() => {
    const uniqueStatuses = new Set<string>();
    tasks.forEach(t => uniqueStatuses.add(t.status));
    return Array.from(uniqueStatuses);
  }, [tasks]);

  // Calendar date calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter and combine tasks and events
  const filteredItems = useMemo(() => {
    const allItems = [
      ...tasks.filter(t => t.dueDate).map(t => ({
        id: t.id,
        title: t.title,
        date: t.dueDate!.toISOString(),
        type: 'task' as const,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee
      })),
      ...events.map(e => ({
        id: e.id,
        title: e.title,
        date: e.start_at,
        type: 'event' as const,
        assignee: ''
      }))
    ];

    return allItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAssignee = assigneeFilter === 'all' || item.assignee === assigneeFilter;
      const matchesStatus = statusFilter === 'all' || (item.type === 'task' && (item as any).status === statusFilter);
      
      return matchesSearch && matchesAssignee && matchesStatus;
    });
  }, [tasks, events, searchQuery, assigneeFilter, statusFilter]);

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    return filteredItems.filter(item => {
      const itemDate = new Date(item.date);
      return isSameDay(itemDate, date);
    });
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setNewEvent({ start_at: format(date, 'yyyy-MM-dd HH:mm:ss') });
    setShowEventDialog(true);
  };

  const handleCreateEvent = () => {
    if (newEvent.title && newEvent.start_at) {
      onCreateEvent(newEvent);
      setShowEventDialog(false);
      setNewEvent({});
    }
  };

  const handleItemClick = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (item.type === 'task') {
      // Find the full task object and open it in the full task view
      const fullTask = tasks.find(t => t.id === item.id);
      if (fullTask) {
        onTaskClick(fullTask);
      }
    } else {
      // For events, show the simple dialog
      setSelectedItem(item);
      setShowItemDialog(true);
    }
  };

  const handleDeleteEvent = () => {
    if (selectedItem && selectedItem.type === 'event') {
      const fullEvent = events.find(e => e.id === selectedItem.id);
      if (fullEvent) {
        onDeleteEvent(fullEvent);
        setShowItemDialog(false);
        setSelectedItem(null);
      }
    }
  };

  // Get color classes based on status/priority
  const getItemColorClasses = (item: any) => {
    const now = new Date();
    const itemDate = new Date(item.date);
    
    // Check if overdue
    if (item.type === 'task') {
      const isOverdue = itemDate < now && item.status !== 'done';
      if (isOverdue) {
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-l-4 border-l-red-500';
      }
      
      switch (item.status) {
        case 'backlog':
          return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-l-4 border-l-slate-400';
        case 'todo':
          return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-l-4 border-l-blue-500';
        case 'in-progress':
          return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-l-4 border-l-amber-500';
        case 'review':
          return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-l-4 border-l-purple-500';
        case 'done':
          return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-l-4 border-l-green-500';
        default:
          return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-l-4 border-l-gray-400';
      }
    } else {
      const isOverdue = itemDate < now;
      if (isOverdue) {
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-l-4 border-l-red-500';
      }
      return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-l-4 border-l-indigo-500';
    }
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <Card className="border-2">
        <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Calendar View
              </span>
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search calendar"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[140px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {assignees.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>


              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <h3 className="text-lg font-semibold">
              {format(currentDate, 'MMMM yyyy')}
            </h3>

            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="border-2 rounded-lg overflow-hidden shadow-sm">
            {/* Week day headers */}
            <div className="grid grid-cols-7 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
              {weekDays.map(day => (
                <div key={day} className="p-3 text-center text-sm font-semibold text-primary border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 auto-rows-fr">
              {calendarDays.map((day, idx) => {
                const dayItems = getItemsForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[120px] p-2 border-r border-b last:border-r-0 transition-all duration-200",
                      !isCurrentMonth && "bg-muted/20 opacity-60",
                      isCurrentMonth && "bg-background hover:bg-accent/30",
                      isDayToday && "ring-2 ring-primary ring-inset bg-primary/5",
                      "cursor-pointer group"
                    )}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-sm font-semibold transition-all",
                        !isCurrentMonth && "text-muted-foreground",
                        isDayToday && "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center shadow-md ring-2 ring-primary/20"
                      )}>
                        {format(day, 'd')}
                      </span>
                      <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </div>

                    <div className="space-y-1.5">
                      {dayItems.slice(0, 3).map(item => (
                        <div
                          key={item.id}
                          onClick={(e) => handleItemClick(item, e)}
                          className={cn(
                            "text-xs p-1.5 rounded-md truncate cursor-pointer transition-all duration-200",
                            "hover:scale-105 hover:shadow-sm font-medium",
                            getItemColorClasses(item)
                          )}
                          title={item.title}
                        >
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayItems.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newEvent.title || ''}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Event title"
              />
            </div>
            <div>
              <Label htmlFor="start">Start Date & Time</Label>
              <Input
                id="start"
                type="datetime-local"
                value={newEvent.start_at ? format(new Date(newEvent.start_at), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setNewEvent({ ...newEvent, start_at: format(new Date(e.target.value), 'yyyy-MM-dd HH:mm:ss') })}
              />
            </div>
            <div>
              <Label htmlFor="end">End Date & Time (Optional)</Label>
              <Input
                id="end"
                type="datetime-local"
                value={newEvent.end_at ? format(new Date(newEvent.end_at), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => setNewEvent({ ...newEvent, end_at: format(new Date(e.target.value), 'yyyy-MM-dd HH:mm:ss') })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Event Dialog (Events only now) */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <div className="text-sm font-medium">{selectedItem?.title}</div>
            </div>
            <div>
              <Label>Date</Label>
              <div className="text-sm">{selectedItem?.date ? format(new Date(selectedItem.date), 'PPP') : ''}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteEvent}>
              Delete Event
            </Button>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
