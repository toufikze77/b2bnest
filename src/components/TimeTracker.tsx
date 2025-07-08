import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, BarChart3, Calendar, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface TimeEntry {
  id: string;
  project: string;
  task: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  isRunning: boolean;
}

const TimeTracker = () => {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const { toast } = useToast();

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentEntry?.isRunning) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - currentEntry.startTime.getTime()) / 1000);
        setElapsedTime(duration);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [currentEntry]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (!project.trim() || !task.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both project and task name.",
        variant: "destructive"
      });
      return;
    }

    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      project: project.trim(),
      task: task.trim(),
      startTime: new Date(),
      duration: 0,
      isRunning: true
    };

    setCurrentEntry(newEntry);
    setElapsedTime(0);
    
    toast({
      title: "Timer Started",
      description: `Tracking time for "${task}" in ${project}`
    });
  };

  const pauseTimer = () => {
    if (currentEntry) {
      const updatedEntry = {
        ...currentEntry,
        isRunning: false,
        duration: elapsedTime
      };
      setCurrentEntry(updatedEntry);
      
      toast({
        title: "Timer Paused",
        description: "Click resume to continue tracking"
      });
    }
  };

  const resumeTimer = () => {
    if (currentEntry) {
      const updatedEntry = {
        ...currentEntry,
        isRunning: true,
        startTime: new Date(Date.now() - currentEntry.duration * 1000)
      };
      setCurrentEntry(updatedEntry);
      
      toast({
        title: "Timer Resumed",
        description: "Continuing time tracking"
      });
    }
  };

  const stopTimer = () => {
    if (currentEntry) {
      const finalEntry: TimeEntry = {
        ...currentEntry,
        endTime: new Date(),
        duration: elapsedTime,
        isRunning: false
      };

      setEntries(prev => [finalEntry, ...prev].slice(0, 10)); // Keep last 10 entries for free plan
      setCurrentEntry(null);
      setElapsedTime(0);
      setProject('');
      setTask('');
      
      toast({
        title: "Time Logged",
        description: `Saved ${formatTime(elapsedTime)} for "${finalEntry.task}"`
      });
    }
  };

  const getTotalTimeToday = () => {
    const today = new Date().toDateString();
    return entries
      .filter(entry => entry.endTime && entry.endTime.toDateString() === today)
      .reduce((total, entry) => total + entry.duration, 0);
  };

  const getUniqueProjects = () => {
    return [...new Set(entries.map(entry => entry.project))];
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Time Tracker</h1>
        <p className="text-gray-600">Track time spent on projects and tasks</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: Last 10 entries only
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Active Timer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Timer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-6xl font-mono font-bold text-blue-600 mb-6">
              {formatTime(elapsedTime)}
            </div>
            
            {!currentEntry ? (
              <div className="space-y-4">
                <Input
                  placeholder="Project name (e.g., Website Design)"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
                <Input
                  placeholder="Task description (e.g., Homepage layout)"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                />
                <Button onClick={startTimer} className="w-full" size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h3 className="font-semibold text-blue-900">{currentEntry.project}</h3>
                  <p className="text-blue-700">{currentEntry.task}</p>
                </div>
                
                <div className="flex gap-2">
                  {currentEntry.isRunning ? (
                    <Button onClick={pauseTimer} variant="outline" className="flex-1">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={resumeTimer} className="flex-1">
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button onClick={stopTimer} variant="destructive" className="flex-1">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Today's Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {formatTime(getTotalTimeToday())}
                </div>
                <p className="text-gray-600">Total time today</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xl font-semibold">{entries.length}</div>
                  <div className="text-sm text-gray-600">Total entries</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xl font-semibold">{getUniqueProjects().length}</div>
                  <div className="text-sm text-gray-600">Active projects</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No time entries yet. Start your first timer above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{entry.project}</div>
                    <div className="text-sm text-gray-600">{entry.task}</div>
                    <div className="text-xs text-gray-500">
                      {entry.endTime?.toLocaleDateString()} at {entry.endTime?.toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-lg">
                      {formatTime(entry.duration)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Completed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Need Advanced Time Tracking?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited entries, detailed reports, team collaboration, and invoicing integration.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited entries</Badge>
                <Badge variant="outline" className="text-xs">Pro: Team tracking + Reports</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Advanced analytics</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeTracker;