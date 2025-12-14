import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Bell, Mail, Clock, CheckCircle, AlertCircle, MessageSquare, FolderOpen, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getUserNotificationPreferences, updateNotificationPreferences } from '@/services/taskNotificationService';

interface NotificationSettings {
  email_task_assigned: boolean;
  email_task_completed: boolean;
  email_task_status_changed: boolean;
  email_task_due_reminder: boolean;
  email_task_overdue: boolean;
  email_task_comment: boolean;
  email_project_update: boolean;
  email_weekly_digest: boolean;
  due_reminder_hours: number;
}

const defaultSettings: NotificationSettings = {
  email_task_assigned: true,
  email_task_completed: true,
  email_task_status_changed: true,
  email_task_due_reminder: true,
  email_task_overdue: true,
  email_task_comment: true,
  email_project_update: true,
  email_weekly_digest: true,
  due_reminder_hours: 24
};

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadPreferences();
    }
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const prefs = await getUserNotificationPreferences(user.id);
      if (prefs) {
        setSettings({
          email_task_assigned: prefs.email_task_assigned ?? true,
          email_task_completed: prefs.email_task_completed ?? true,
          email_task_status_changed: prefs.email_task_status_changed ?? true,
          email_task_due_reminder: prefs.email_task_due_reminder ?? true,
          email_task_overdue: prefs.email_task_overdue ?? true,
          email_task_comment: prefs.email_task_comment ?? true,
          email_project_update: prefs.email_project_update ?? true,
          email_weekly_digest: prefs.email_weekly_digest ?? true,
          due_reminder_hours: prefs.due_reminder_hours ?? 24
        });
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!user?.id) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    setSaving(true);
    const result = await updateNotificationPreferences(user.id, { [key]: value });
    setSaving(false);

    if (result.ok) {
      toast({
        title: "Preference updated",
        description: `${value ? 'Enabled' : 'Disabled'} notification`
      });
    } else {
      // Revert on error
      setSettings(settings);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive"
      });
    }
  };

  const handleReminderChange = async (hours: string) => {
    if (!user?.id) return;

    const hoursNum = parseInt(hours);
    const newSettings = { ...settings, due_reminder_hours: hoursNum };
    setSettings(newSettings);

    setSaving(true);
    const result = await updateNotificationPreferences(user.id, { due_reminder_hours: hoursNum });
    setSaving(false);

    if (result.ok) {
      toast({
        title: "Reminder timing updated",
        description: `You'll be reminded ${hoursNum} hours before due date`
      });
    } else {
      setSettings(settings);
      toast({
        title: "Error",
        description: "Failed to update reminder timing",
        variant: "destructive"
      });
    }
  };

  const toggleAll = async (enabled: boolean) => {
    if (!user?.id) return;

    const newSettings: NotificationSettings = {
      email_task_assigned: enabled,
      email_task_completed: enabled,
      email_task_status_changed: enabled,
      email_task_due_reminder: enabled,
      email_task_overdue: enabled,
      email_task_comment: enabled,
      email_project_update: enabled,
      email_weekly_digest: enabled,
      due_reminder_hours: settings.due_reminder_hours
    };

    setSettings(newSettings);

    setSaving(true);
    const result = await updateNotificationPreferences(user.id, newSettings);
    setSaving(false);

    if (result.ok) {
      toast({
        title: enabled ? "All notifications enabled" : "All notifications disabled",
      });
    } else {
      loadPreferences();
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const notificationOptions = [
    {
      key: 'email_task_assigned' as const,
      label: 'Task Assigned',
      description: 'When someone assigns a task to you',
      icon: CheckCircle
    },
    {
      key: 'email_task_completed' as const,
      label: 'Task Completed',
      description: 'When a task you created or are watching is completed',
      icon: CheckCircle
    },
    {
      key: 'email_task_status_changed' as const,
      label: 'Status Changes',
      description: 'When task status is updated',
      icon: AlertCircle
    },
    {
      key: 'email_task_due_reminder' as const,
      label: 'Due Date Reminders',
      description: 'Get reminded before tasks are due',
      icon: Clock
    },
    {
      key: 'email_task_overdue' as const,
      label: 'Overdue Alerts',
      description: 'When tasks become overdue',
      icon: AlertCircle
    },
    {
      key: 'email_task_comment' as const,
      label: 'Comments',
      description: 'When someone comments on your task',
      icon: MessageSquare
    },
    {
      key: 'email_project_update' as const,
      label: 'Project Updates',
      description: 'Important project announcements',
      icon: FolderOpen
    },
    {
      key: 'email_weekly_digest' as const,
      label: 'Weekly Digest',
      description: 'Summary of your weekly activity',
      icon: Calendar
    }
  ];

  const allEnabled = notificationOptions.every(opt => settings[opt.key]);
  const allDisabled = notificationOptions.every(opt => !settings[opt.key]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose which email notifications you'd like to receive
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleAll(true)}
              disabled={allEnabled || saving}
            >
              Enable All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => toggleAll(false)}
              disabled={allDisabled || saving}
            >
              Disable All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationOptions.map((option) => {
          const Icon = option.icon;
          return (
            <div 
              key={option.key} 
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor={option.key} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
              <Switch
                id={option.key}
                checked={settings[option.key]}
                onCheckedChange={(checked) => handleToggle(option.key, checked)}
                disabled={saving}
              />
            </div>
          );
        })}

        {/* Due reminder timing */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Due Date Reminder Timing</Label>
              <p className="text-sm text-muted-foreground">
                How far in advance to remind you of upcoming due dates
              </p>
            </div>
            <Select
              value={settings.due_reminder_hours.toString()}
              onValueChange={handleReminderChange}
              disabled={saving || !settings.email_task_due_reminder}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">2 days</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">1 week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferences;
