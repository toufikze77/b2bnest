import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Activity,
  MessageSquare,
  Plus,
  Clock,
  User,
  Edit,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
  Calendar,
  Target,
  Send,
  Phone,
  Mail,
  Video,
  Paperclip
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ActivityItem {
  id: string;
  type: 'comment' | 'status_change' | 'assignment' | 'file_upload' | 'meeting' | 'call' | 'email' | 'milestone';
  title: string;
  description?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: Date;
  metadata?: Record<string, any>;
}

interface ProjectActivityTimelineProps {
  projectId: string;
  projectName: string;
}

const activityIcons = {
  comment: MessageSquare,
  status_change: Edit,
  assignment: Users,
  file_upload: Paperclip,
  meeting: Video,
  call: Phone,
  email: Mail,
  milestone: Target,
};

const activityColors = {
  comment: 'text-blue-500',
  status_change: 'text-yellow-500',
  assignment: 'text-purple-500',
  file_upload: 'text-green-500',
  meeting: 'text-indigo-500',
  call: 'text-orange-500',
  email: 'text-red-500',
  milestone: 'text-pink-500',
};

const ProjectActivityTimeline = ({ projectId, projectName }: ProjectActivityTimelineProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const { toast } = useToast();

  // Mock user data - in real app, get from auth
  const currentUser = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com'
  };

  useEffect(() => {
    // Mock initial activities
    const mockActivities: ActivityItem[] = [
      {
        id: '1',
        type: 'milestone',
        title: 'Project kickoff completed',
        description: 'Initial project meeting held with all stakeholders',
        user_id: 'user-2',
        user_name: 'Sarah Johnson',
        user_email: 'sarah@example.com',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        metadata: { milestone: 'kickoff' }
      },
      {
        id: '2',
        type: 'status_change',
        title: 'Status changed to Active',
        description: 'Project moved from Planning to Active phase',
        user_id: 'user-1',
        user_name: 'John Doe',
        user_email: 'john@example.com',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        metadata: { from: 'planning', to: 'active' }
      },
      {
        id: '3',
        type: 'assignment',
        title: 'Team members assigned',
        description: 'Added 3 new team members to the project',
        user_id: 'user-2',
        user_name: 'Sarah Johnson',
        user_email: 'sarah@example.com',
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        metadata: { count: 3 }
      },
      {
        id: '4',
        type: 'comment',
        title: 'Added project comment',
        description: 'Great progress on the initial setup. Looking forward to the next milestone.',
        user_id: 'user-3',
        user_name: 'Mike Wilson',
        user_email: 'mike@example.com',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      },
      {
        id: '5',
        type: 'meeting',
        title: 'Sprint planning meeting',
        description: 'Scheduled sprint planning session for next week',
        user_id: 'user-1',
        user_name: 'John Doe',
        user_email: 'john@example.com',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        metadata: { meeting_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
      }
    ];

    setActivities(mockActivities);
  }, [projectId]);

  const addComment = () => {
    if (!newComment.trim()) return;

    const newActivity: ActivityItem = {
      id: Date.now().toString(),
      type: 'comment',
      title: 'Added project comment',
      description: newComment,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_email: currentUser.email,
      created_at: new Date()
    };

    setActivities(prev => [newActivity, ...prev]);
    setNewComment('');
    setIsAddingComment(false);

    toast({
      title: "Comment added",
      description: "Your comment has been added to the project timeline.",
    });
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    const IconComponent = activityIcons[type] || Activity;
    const colorClass = activityColors[type] || 'text-gray-500';
    return <IconComponent className={`h-4 w-4 ${colorClass}`} />;
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getActivityBadge = (type: ActivityItem['type']) => {
    const badges = {
      comment: { text: 'Comment', variant: 'default' as const },
      status_change: { text: 'Status', variant: 'secondary' as const },
      assignment: { text: 'Team', variant: 'outline' as const },
      file_upload: { text: 'File', variant: 'default' as const },
      meeting: { text: 'Meeting', variant: 'secondary' as const },
      call: { text: 'Call', variant: 'outline' as const },
      email: { text: 'Email', variant: 'destructive' as const },
      milestone: { text: 'Milestone', variant: 'default' as const },
    };

    const badge = badges[type] || { text: 'Activity', variant: 'default' as const };
    return <Badge variant={badge.variant}>{badge.text}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Add New Comment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Comment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAddingComment ? (
            <Button 
              onClick={() => setIsAddingComment(true)}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add a comment to the project timeline
            </Button>
          ) : (
            <div className="space-y-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="What's happening with this project?"
                rows={3}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={addComment} disabled={!newComment.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddingComment(false);
                    setNewComment('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Project Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity yet. Add a comment to get started!
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`flex gap-4 pb-4 ${index !== activities.length - 1 ? 'border-b' : ''}`}
                >
                  {/* User Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {getUserInitials(activity.user_name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{activity.user_name}</span>
                      {getActivityBadge(activity.type)}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {getActivityIcon(activity.type)}
                        <span>{formatDistanceToNow(activity.created_at, { addSuffix: true })}</span>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground mb-1">
                      {activity.title}
                    </div>

                    {activity.description && (
                      <div className="text-sm bg-muted p-3 rounded-md">
                        {activity.description}
                      </div>
                    )}

                    {/* Metadata */}
                    {activity.metadata && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {activity.type === 'meeting' && activity.metadata.meeting_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Scheduled for {format(new Date(activity.metadata.meeting_date), 'MMM d, yyyy')}
                          </div>
                        )}
                        {activity.type === 'status_change' && activity.metadata.from && activity.metadata.to && (
                          <div className="flex items-center gap-1">
                            <Edit className="h-3 w-3" />
                            Changed from {activity.metadata.from} to {activity.metadata.to}
                          </div>
                        )}
                        {activity.type === 'assignment' && activity.metadata.count && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {activity.metadata.count} team members added
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground mt-1">
                      {format(activity.created_at, 'MMM d, yyyy • HH:mm')}
                    </div>
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

export default ProjectActivityTimeline;