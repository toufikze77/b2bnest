import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, User, Plus, X } from "lucide-react";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  user_id: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

const ProjectManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(true);

  // Load data from Supabase
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (tasksError) throw tasksError;
        setTasks(tasksData || []);
        
        // Load profiles (all users for assignment)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name, display_name');
        
        if (profilesError) throw profilesError;
        setProfiles(profilesData || []);
        
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load project data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  // Add new task
  const addTask = async () => {
    if (!newTask.title.trim() || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([{ 
          title: newTask.title, 
          description: newTask.description,
          user_id: user.id,
          status: 'todo',
          priority: 'medium'
        }])
        .select()
        .single();

      if (error) throw error;

      setTasks(prev => [data, ...prev]);
      setNewTask({ title: "", description: "" });
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  // Assign user to task
  const assignUser = async (taskId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ assigned_to: userId })
        .eq('id', taskId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, assigned_to: userId } : task
        )
      );
      
      toast({
        title: "Success",
        description: "User assigned successfully",
      });
    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user",
        variant: "destructive",
      });
    }
  };

  // Remove user assignment
  const removeAssignment = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ assigned_to: null })
        .eq('id', taskId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, assigned_to: null } : task
        )
      );
      
      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      });
    }
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskId));
      
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error", 
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const getAssignedUserName = (userId: string | null) => {
    if (!userId) return null;
    const profile = profiles.find(p => p.id === userId);
    return profile?.display_name || profile?.full_name || profile?.email || 'Unknown User';
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p>Please log in to access project management.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📌 Project Management</h1>
      </div>

      {/* Add Task Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="flex-1"
            />
            <Textarea
              placeholder="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="flex-1"
              rows={1}
            />
            <Button 
              onClick={addTask}
              disabled={!newTask.title.trim()}
              className="shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No tasks yet. Create your first task above!</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{task.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {task.status}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {task.priority}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {task.description}
                      </p>
                    )}

                    {/* Assignment Section */}
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm font-medium">Assigned to:</span>
                      
                      {task.assigned_to ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="flex items-center gap-1">
                            {getAssignedUserName(task.assigned_to)}
                            <button
                              onClick={() => removeAssignment(task.id)}
                              className="ml-1 hover:text-red-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        </div>
                      ) : (
                        <Select onValueChange={(userId) => assignUser(task.id, userId)}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Assign to user..." />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.display_name || profile.full_name || profile.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTask(task.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;