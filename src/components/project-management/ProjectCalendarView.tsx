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
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  dueDate: Date | null;
  project: string;
  tags: string[];
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
}

export const ProjectCalendarView: React.FC<ProjectCalendarViewProps> = ({
  tasks,
  events,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent
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
    setSelectedItem(item);
    setShowItemDialog(true);
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

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar View
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
          <div className="border rounded-lg overflow-hidden">
            {/* Week day headers */}
            <div className="grid grid-cols-7 bg-muted/50">
              {weekDays.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
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
                      "min-h-[100px] p-2 border-r border-b last:border-r-0",
                      !isCurrentMonth && "bg-muted/20",
                      "hover:bg-accent/50 transition-colors cursor-pointer group"
                    )}
                    onClick={() => handleDateClick(day)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        !isCurrentMonth && "text-muted-foreground",
                        isDayToday && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      )}>
                        {format(day, 'd')}
                      </span>
                      <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                    </div>

                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map(item => (
                        <div
                          key={item.id}
                          onClick={(e) => handleItemClick(item, e)}
                          className={cn(
                            "text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                            item.type === 'task' 
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "bg-accent text-accent-foreground border border-border"
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

      {/* View/Edit Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.type === 'task' ? 'Task Details' : 'Event Details'}
            </DialogTitle>
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
            {selectedItem?.type === 'task' && (
              <>
                <div>
                  <Label>Status</Label>
                  <Badge variant="outline" className="ml-2">{selectedItem.status}</Badge>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Badge variant="outline" className="ml-2">{selectedItem.priority}</Badge>
                </div>
                {selectedItem.assignee && (
                  <div>
                    <Label>Assignee</Label>
                    <div className="text-sm flex items-center gap-2 mt-1">
                      <User className="h-4 w-4" />
                      {selectedItem.assignee}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            {selectedItem?.type === 'event' && (
              <Button variant="destructive" onClick={handleDeleteEvent}>
                Delete Event
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
