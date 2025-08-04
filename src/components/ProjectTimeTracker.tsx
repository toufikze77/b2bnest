import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Calendar, 
  Timer, 
  Plus,
  Edit,
  Trash2,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TimeEntry {
  id: string;
  project_id: string;
  user_id: string;
  task_name: string;
  description?: string;
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  is_billable: boolean;
  hourly_rate?: number;
  created_at: Date;
}

interface ProjectTimeTrackerProps {
  projectId: string;
  projectName: string;
}

const ProjectTimeTracker = ({ projectId, projectName }: ProjectTimeTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Partial<TimeEntry> | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const { toast } = useToast();

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking && currentEntry) {
      interval = setInterval(() => {
        const startTime = new Date(currentEntry.start_time!);
        const now = new Date();
        const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setCurrentTime(diff);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, currentEntry]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (!taskName.trim()) {
      toast({
        title: "Task name required",
        description: "Please enter a task name before starting the timer.",
        variant: "destructive"
      });
      return;
    }

    const newEntry: Partial<TimeEntry> = {
      id: Date.now().toString(),
      project_id: projectId,
      task_name: taskName,
      description,
      start_time: new Date(),
      is_billable: isBillable,
      hourly_rate: hourlyRate || undefined,
      duration_minutes: 0
    };

    setCurrentEntry(newEntry);
    setIsTracking(true);
    setCurrentTime(0);

    toast({
      title: "Timer started",
      description: `Started tracking time for "${taskName}"`,
    });
  };

  const pauseTimer = () => {
    setIsTracking(false);
    toast({
      title: "Timer paused",
      description: "You can resume or stop the timer.",
    });
  };

  const resumeTimer = () => {
    if (currentEntry) {
      setIsTracking(true);
      toast({
        title: "Timer resumed",
        description: "Continuing time tracking.",
      });
    }
  };

  const stopTimer = () => {
    if (currentEntry) {
      const endTime = new Date();
      const durationMinutes = Math.floor(currentTime / 60);
      
      const completedEntry: TimeEntry = {
        ...currentEntry,
        end_time: endTime,
        duration_minutes: durationMinutes,
        created_at: new Date()
      } as TimeEntry;

      setTimeEntries(prev => [completedEntry, ...prev]);
      setCurrentEntry(null);
      setIsTracking(false);
      setCurrentTime(0);
      setTaskName('');
      setDescription('');

      toast({
        title: "Timer stopped",
        description: `Logged ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m for "${completedEntry.task_name}"`,
      });
    }
  };

  const deleteEntry = (entryId: string) => {
    setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
    toast({
      title: "Time entry deleted",
      description: "The time entry has been removed.",
    });
  };

  const getTotalTime = () => {
    return timeEntries.reduce((total, entry) => total + entry.duration_minutes, 0);
  };

  const getTotalBillableAmount = () => {
    return timeEntries
      .filter(entry => entry.is_billable && entry.hourly_rate)
      .reduce((total, entry) => {
        const hours = entry.duration_minutes / 60;
        return total + (hours * entry.hourly_rate!);
      }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Timer Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Time Tracker - {projectName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Timer Display */}
          <div className="text-center py-6">
            <div className="text-4xl font-mono font-bold text-primary mb-2">
              {formatTime(currentTime)}
            </div>
            {currentEntry && (
              <div className="text-muted-foreground">
                Tracking: {currentEntry.task_name}
              </div>
            )}
          </div>

          {/* Task Input */}
          {!isTracking && !currentEntry && (
            <div className="space-y-4">
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="What are you working on?"
                className="text-lg"
              />
              
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description (optional)"
                rows={2}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="billable"
                    checked={isBillable}
                    onChange={(e) => setIsBillable(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="billable" className="text-sm">Billable</label>
                </div>
                
                {isBillable && (
                  <Input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                    placeholder="Hourly rate"
                    min="0"
                    step="0.01"
                  />
                )}
              </div>
            </div>
          )}

          {/* Timer Controls */}
          <div className="flex justify-center gap-2">
            {!isTracking && !currentEntry && (
              <Button onClick={startTimer} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Start Timer
              </Button>
            )}
            
            {isTracking && (
              <Button onClick={pauseTimer} variant="secondary" className="flex items-center gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            
            {!isTracking && currentEntry && (
              <Button onClick={resumeTimer} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            
            {currentEntry && (
              <Button onClick={stopTimer} variant="destructive" className="flex items-center gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Time Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">
                  {Math.floor(getTotalTime() / 60)}h {getTotalTime() % 60}m
                </div>
                <div className="text-sm text-muted-foreground">Total Time</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{timeEntries.length}</div>
                <div className="text-sm text-muted-foreground">Time Entries</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">
                  ${getTotalBillableAmount().toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Billable Amount</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No time entries yet. Start tracking time to see your entries here.
            </div>
          ) : (
            <div className="space-y-2">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{entry.task_name}</div>
                    {entry.description && (
                      <div className="text-sm text-muted-foreground">{entry.description}</div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>{format(entry.created_at, 'MMM d, yyyy')}</span>
                      <span>{format(entry.start_time, 'HH:mm')}{entry.end_time && ` - ${format(entry.end_time, 'HH:mm')}`}</span>
                      {entry.is_billable && (
                        <Badge variant="secondary" className="text-xs">
                          Billable
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-mono font-medium">
                        {Math.floor(entry.duration_minutes / 60)}h {entry.duration_minutes % 60}m
                      </div>
                      {entry.is_billable && entry.hourly_rate && (
                        <div className="text-sm text-green-600">
                          ${((entry.duration_minutes / 60) * entry.hourly_rate).toFixed(2)}
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntry(entry.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectTimeTracker;