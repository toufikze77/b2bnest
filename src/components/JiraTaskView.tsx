import React, { useState, useEffect } from 'react';
import { X, Link2, Flag, Calendar, User, Clock, Tag, MoreHorizontal, Share2, Star, Trash2, Archive, Copy, AlertCircle, CheckCircle2, Circle, Timer, MessageSquare, Paperclip, History, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface JiraTaskViewProps {
  task: any;
  onClose: () => void;
  onUpdate: (taskId: string, updates: any) => Promise<void>;
  onDelete?: (taskId: string) => void;
  projects?: any[];
  teamMembers?: any[];
}

// Simple date formatter
const formatDate = (date: Date | string) => {
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatDateTime = (date: Date | string) => {
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${formatDate(d)} ${hours}:${minutes}`;
};

const JiraTaskView: React.FC<JiraTaskViewProps> = ({ 
  task, 
  onClose, 
  onUpdate,
  onDelete,
  projects = [],
  teamMembers = []
}) => {
  const [localTask, setLocalTask] = useState(task);
  const [isEditing, setIsEditing] = useState({
    title: false,
    description: false
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    setLocalTask(task);
    // Load comments, subtasks, and history from your database here
    setComments(task.comments || []);
    setSubtasks(task.subtasks || []);
  }, [task]);

  const handleFieldUpdate = async (field: string, value: any) => {
    const updates = { [field]: value };
    setLocalTask({ ...localTask, ...updates });
    await onUpdate(localTask.id, updates);
  };

  const statusOptions = [
    { value: 'backlog', label: 'Backlog', icon: Circle, color: 'text-gray-500' },
    { value: 'todo', label: 'To Do', icon: Circle, color: 'text-blue-500' },
    { value: 'in-progress', label: 'In Progress', icon: Timer, color: 'text-yellow-500' },
    { value: 'review', label: 'Review', icon: AlertCircle, color: 'text-purple-500' },
    { value: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-500' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
  ];

  const CurrentStatusIcon = statusOptions.find(s => s.value === localTask.status)?.icon || Circle;
  const currentStatusColor = statusOptions.find(s => s.value === localTask.status)?.color || 'text-gray-500';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl min-h-[calc(100vh-4rem)] rounded-lg shadow-2xl flex flex-col mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <CurrentStatusIcon className={`w-5 h-5 ${currentStatusColor}`} />
            <span className="text-sm font-medium text-gray-600">
              {localTask.project || 'No Project'}
            </span>
            <span className="text-sm text-gray-400">/</span>
            <span className="text-sm text-gray-600">TASK-{localTask.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Star className="w-4 h-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48">
                <div className="space-y-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy link
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete?.(localTask.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Title */}
            <div className="mb-6">
              {isEditing.title ? (
                <Input
                  value={localTask.title}
                  onChange={(e) => setLocalTask({ ...localTask, title: e.target.value })}
                  onBlur={() => {
                    setIsEditing({ ...isEditing, title: false });
                    handleFieldUpdate('title', localTask.title);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditing({ ...isEditing, title: false });
                      handleFieldUpdate('title', localTask.title);
                    }
                  }}
                  className="text-2xl font-semibold border-none shadow-none focus-visible:ring-0 px-0"
                  autoFocus
                />
              ) : (
                <h1 
                  className="text-2xl font-semibold cursor-pointer hover:bg-gray-50 px-2 py-1 -mx-2 rounded"
                  onClick={() => setIsEditing({ ...isEditing, title: true })}
                >
                  {localTask.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
              {isEditing.description ? (
                <div>
                  <Textarea
                    value={localTask.description || ''}
                    onChange={(e) => setLocalTask({ ...localTask, description: e.target.value })}
                    className="min-h-[120px]"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <Button 
                      size="sm"
                      onClick={() => {
                        setIsEditing({ ...isEditing, description: false });
                        handleFieldUpdate('description', localTask.description);
                      }}
                    >
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setLocalTask({ ...localTask, description: task.description });
                        setIsEditing({ ...isEditing, description: false });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 p-3 rounded min-h-[80px] whitespace-pre-wrap"
                  onClick={() => setIsEditing({ ...isEditing, description: true })}
                >
                  {localTask.description || 'Add a description...'}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Subtasks</h3>
                <Button variant="ghost" size="sm">
                  <span className="text-xs">Add subtask</span>
                </Button>
              </div>
              <div className="space-y-2">
                {subtasks.length === 0 ? (
                  <p className="text-sm text-gray-500">No subtasks yet</p>
                ) : (
                  subtasks.map((subtask: any) => (
                    <div key={subtask.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <input type="checkbox" checked={subtask.completed} className="w-4 h-4" />
                      <span className="text-sm flex-1">{subtask.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Activity & Comments */}
            <div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="comments">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Comments
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="w-4 h-4 mr-2" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="mt-4">
                  {/* Add Comment */}
                  <div className="mb-4">
                    <div className="flex gap-3">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                          U
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Textarea
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="min-h-[80px] mb-2"
                        />
                        <div className="flex justify-end">
                          <Button 
                            size="sm"
                            disabled={!newComment.trim()}
                            onClick={() => {
                              const comment = {
                                id: Date.now().toString(),
                                content: newComment,
                                author: 'Current User',
                                timestamp: new Date().toISOString()
                              };
                              setComments([...comments, comment]);
                              setNewComment('');
                            }}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Comment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No comments yet. Be the first to comment!
                      </p>
                    ) : (
                      comments.map((comment: any) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className="text-xs">
                              {comment.author?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{comment.author}</span>
                              <span className="text-xs text-gray-500">
                                {formatDateTime(comment.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No activity history
                      </p>
                    ) : (
                      history.map((item: any) => (
                        <div key={item.id} className="flex gap-3 text-sm">
                          <Avatar className="w-6 h-6 shrink-0">
                            <AvatarFallback className="text-xs">
                              {item.user?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-gray-700">{item.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTime(item.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right Sidebar - Details */}
          <div className="w-80 border-l bg-gray-50 p-6 overflow-y-auto shrink-0">
            <div className="space-y-6">
              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Status
                </label>
                <Select 
                  value={localTask.status} 
                  onValueChange={(value) => handleFieldUpdate('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${option.color}`} />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Assignee
                </label>
                <Select 
                  value={localTask.assigned_to || 'unassigned'} 
                  onValueChange={(value) => handleFieldUpdate('assigned_to', value === 'unassigned' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{localTask.assignee || 'Unassigned'}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((member: any) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.display_name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Priority
                </label>
                <Select 
                  value={localTask.priority} 
                  onValueChange={(value) => handleFieldUpdate('priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <Badge className={option.color}>
                          {option.label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Labels */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Labels
                </label>
                <div className="flex flex-wrap gap-2">
                  {(localTask.tags || []).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                    <Tag className="w-3 h-3 mr-1" />
                    Add label
                  </Button>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Due Date
                </label>
                <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      {localTask.dueDate 
                        ? formatDate(new Date(localTask.dueDate))
                        : 'Set due date'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={localTask.dueDate ? new Date(localTask.dueDate) : undefined}
                      onSelect={(date) => {
                        handleFieldUpdate('due_date', date?.toISOString());
                        setShowDatePicker(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Tracking */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Time Tracking
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Estimated</span>
                    <span className="font-medium">{localTask.estimatedHours || 0}h</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Logged</span>
                    <span className="font-medium">{localTask.actualHours || 0}h</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all" 
                      style={{ 
                        width: `${Math.min(100, ((localTask.actualHours || 0) / (localTask.estimatedHours || 1)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Reporter */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">
                  Reporter
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">U</AvatarFallback>
                  </Avatar>
                  <span>Current User</span>
                </div>
              </div>

              {/* Created / Updated */}
              <div className="pt-4 border-t space-y-2">
                <div className="text-xs text-gray-500">
                  Created {localTask.created_at && formatDate(new Date(localTask.created_at))}
                </div>
                <div className="text-xs text-gray-500">
                  Updated {localTask.updated_at && formatDateTime(new Date(localTask.updated_at))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JiraTaskView;
