import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, Clock, Flag, User, Plus, X, Check, 
  ChevronDown, Settings, History, Activity, Code,
  Users, Zap, Send, Smile, ThumbsUp, AlertCircle,
  HelpCircle, CheckCircle2, Link2
} from 'lucide-react';
import { getUserDisplayInfo } from '@/utils/profileUtils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  labels: string[];
  due_date?: string;
  start_date?: string;
  assigned_to?: string;
  reporter_id?: string;
  created_at: string;
  updated_at: string;
  estimated_hours?: number;
  actual_hours?: number;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_profile?: {
    display_name?: string;
    full_name?: string;
  };
}

interface EnhancedTodoViewProps {
  todo: Todo;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onClose: () => void;
}

export const EnhancedTodoView: React.FC<EnhancedTodoViewProps> = ({ todo, onUpdate, onClose }) => {
  const { user } = useAuth();
  const [localTodo, setLocalTodo] = useState(todo);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [assigneeInfo, setAssigneeInfo] = useState<any>(null);
  const [reporterInfo, setReporterInfo] = useState<any>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);

  useEffect(() => {
    fetchSubtasks();
    fetchComments();
    if (todo.assigned_to) {
      fetchUserInfo(todo.assigned_to, setAssigneeInfo);
    }
    if (todo.reporter_id) {
      fetchUserInfo(todo.reporter_id, setReporterInfo);
    }
  }, [todo.id]);

  const fetchUserInfo = async (userId: string, setter: (info: any) => void) => {
    const info = await getUserDisplayInfo(userId);
    setter(info);
  };

  const fetchSubtasks = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_subtasks' as any)
        .select('*')
        .eq('todo_id', todo.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setSubtasks((data as any) || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('todo_comments')
        .select('*')
        .eq('todo_id', todo.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { batchGetUserDisplayInfo } = await import('@/utils/profileUtils');
        const profilesData = await batchGetUserDisplayInfo(userIds);
        const profilesMap = new Map(profilesData.map(p => [p.id, p]));
        
        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          user_profile: profilesMap.get(comment.user_id)
        }));
        
        setComments(commentsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('todo_subtasks' as any)
        .insert({
          todo_id: todo.id,
          title: newSubtask.trim(),
          completed: false,
          user_id: user.id
        } as any);

      if (error) throw error;
      setNewSubtask('');
      fetchSubtasks();
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('todo_subtasks' as any)
        .update({ completed: !completed } as any)
        .eq('id', subtaskId);

      if (error) throw error;
      fetchSubtasks();
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('todo_comments')
        .insert({
          todo_id: todo.id,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;
      
      // Send notification to task owner/assignee
      if (todo.assigned_to && todo.assigned_to !== user.id) {
        try {
          const { notifyTaskComment } = await import('@/services/taskNotificationService');
          // Get project_id from supabase if available
          const { data: taskData } = await supabase
            .from('todos')
            .select('project_id')
            .eq('id', todo.id)
            .maybeSingle();
            
          await notifyTaskComment(
            todo.id,
            todo.title,
            user.id,
            todo.assigned_to,
            newComment.trim(),
            taskData?.project_id
          );
        } catch (notifyError) {
          console.error('Failed to send comment notification:', notifyError);
        }
      }
      
      setNewComment('');
      fetchComments();
      toast({ title: "Comment added" });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleUpdateField = async (field: string, value: any) => {
    const oldValue = localTodo[field as keyof Todo];
    const updates = { [field]: value };
    setLocalTodo(prev => ({ ...prev, ...updates }));
    onUpdate(todo.id, updates);
    
    // Send notification for status changes
    if (field === 'status' && user && todo.assigned_to && todo.assigned_to !== user.id) {
      try {
        const { notifyTaskStatusChanged } = await import('@/services/taskNotificationService');
        const { data: taskData } = await supabase
          .from('todos')
          .select('project_id')
          .eq('id', todo.id)
          .maybeSingle();
          
        await notifyTaskStatusChanged(
          todo.id,
          todo.title,
          user.id,
          todo.assigned_to,
          String(oldValue || 'unknown'),
          String(value),
          taskData?.project_id
        );
      } catch (notifyError) {
        console.error('Failed to send status change notification:', notifyError);
      }
    }
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== todo.title) {
      handleUpdateField('title', editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'in-progress': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'done': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'blocked': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur z-50 flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span>{todo.id.substring(0, 8).toUpperCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Link2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl">
            {/* Title */}
            <div className="mb-6">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setEditTitle(todo.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    className="text-2xl font-semibold h-auto py-2"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveTitle}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h1 
                  className="text-2xl font-semibold cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {localTodo.title}
                </h1>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="mb-6">
              <Select 
                value={localTodo.status} 
                onValueChange={(value) => handleUpdateField('status', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <Textarea
                value={localTodo.description || ''}
                onChange={(e) => handleUpdateField('description', e.target.value)}
                placeholder="Add a description..."
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Subtasks */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-3">Subtasks</h3>
              <div className="space-y-2 mb-3">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 group">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleToggleSubtask(subtask.id, subtask.completed)}
                    >
                      {subtask.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                      )}
                    </Button>
                    <span className={cn(
                      "text-sm flex-1",
                      subtask.completed && "line-through text-muted-foreground"
                    )}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  placeholder="Add subtask"
                  className="text-sm"
                />
                <Button size="sm" onClick={handleAddSubtask}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Related work items */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold mb-2">Related work items</h3>
              <Button variant="outline" size="sm" className="text-muted-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Add related work item
              </Button>
            </div>

            {/* Activity Section */}
            <div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="worklog">Work log</TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="mt-6">
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {comment.user_profile?.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {comment.user_profile?.display_name || 'User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      </div>
                    ))}

                    {/* Comment Input */}
                    {user && (
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.email?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            className="min-h-[80px] resize-none mb-2"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm">
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                Looks good!
                              </Button>
                              <Button variant="ghost" size="sm">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Need help?
                              </Button>
                              <Button variant="ghost" size="sm">
                                <HelpCircle className="h-4 w-4 mr-1" />
                                Can you clarify...?
                              </Button>
                            </div>
                            <Button size="sm" onClick={handleAddComment}>
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Pro tip: press <kbd className="px-1 py-0.5 bg-muted rounded">M</kbd> to comment
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history">
                  <p className="text-sm text-muted-foreground">History will be displayed here</p>
                </TabsContent>

                <TabsContent value="worklog">
                  <p className="text-sm text-muted-foreground">Work log will be displayed here</p>
                </TabsContent>

                <TabsContent value="all">
                  <p className="text-sm text-muted-foreground">All activity will be displayed here</p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Details Sidebar */}
        <div className="w-80 border-l bg-muted/30 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Details Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Details</h3>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            <Separator />

            {/* Assignee */}
            <div>
              <label className="text-sm font-medium mb-2 block">Assignee</label>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {assigneeInfo ? assigneeInfo.display_name?.[0] : <User className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {assigneeInfo?.display_name || 'Unassigned'}
                </span>
              </div>
              {!localTodo.assigned_to && (
                <Button variant="link" size="sm" className="text-blue-600 px-0 mt-1">
                  Assign to me
                </Button>
              )}
            </div>

            {/* Labels */}
            <div>
              <label className="text-sm font-medium mb-2 block">Labels</label>
              <div className="flex flex-wrap gap-1">
                {localTodo.labels.map((label, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
              <Button variant="link" size="sm" className="text-muted-foreground px-0 mt-1">
                Add labels
              </Button>
            </div>

            {/* Parent */}
            <div>
              <label className="text-sm font-medium mb-2 block">Parent</label>
              <Button variant="link" size="sm" className="text-muted-foreground px-0">
                Add parent
              </Button>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-sm font-medium mb-2 block">Due date</label>
              <Input
                type="date"
                value={localTodo.due_date || ''}
                onChange={(e) => handleUpdateField('due_date', e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Team */}
            <div>
              <label className="text-sm font-medium mb-2 block">Team</label>
              <Button variant="link" size="sm" className="text-muted-foreground px-0">
                Add team
              </Button>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-sm font-medium mb-2 block">Start date</label>
              <Input
                type="date"
                value={localTodo.start_date || ''}
                onChange={(e) => handleUpdateField('start_date', e.target.value)}
                className="text-sm"
              />
            </div>

            <Separator />

            {/* Status Badge */}
            <div>
              <Badge className={cn("uppercase text-xs font-semibold", getStatusColor(localTodo.status))}>
                {localTodo.status === 'in-progress' ? 'PENDING' : localTodo.status.toUpperCase()}
              </Badge>
            </div>

            <Separator />

            {/* Development */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Development</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start text-blue-600">
                  <Code className="h-4 w-4 mr-2" />
                  Open with VS Code
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-blue-600">
                  <Code className="h-4 w-4 mr-2" />
                  Create branch
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-blue-600">
                  <Code className="h-4 w-4 mr-2" />
                  Create commit
                </Button>
              </div>
            </div>

            <Separator />

            {/* Releases */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Releases</h4>
              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                PENDING
              </Badge>
            </div>

            <Separator />

            {/* Reporter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Reporter</label>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 bg-orange-500">
                  <AvatarFallback className="text-xs text-white">
                    {reporterInfo?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {reporterInfo?.display_name || 'Unknown'}
                </span>
              </div>
            </div>

            <Separator />

            {/* Automation */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4" />
                <h4 className="text-sm font-semibold">Automation</h4>
              </div>
              <Button variant="link" size="sm" className="text-muted-foreground px-0">
                Rule executions
              </Button>
            </div>

            <Separator />

            {/* Timestamps */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Created {new Date(localTodo.created_at).toLocaleDateString()}</p>
              <p>Updated {new Date(localTodo.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
