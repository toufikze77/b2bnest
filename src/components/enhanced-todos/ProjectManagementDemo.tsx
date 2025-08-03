import React, { useState } from 'react';
import { Plus, Calendar as CalendarIcon, User, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CreateTodoDialog from './CreateTodoDialog';

// Demo component to showcase Project Management Hub functionality
const ProjectManagementDemo = () => {
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [tasks, setTasks] = useState([
    {
      id: '1',
      title: 'Design Homepage Mockup',
      description: 'Create responsive homepage design with modern aesthetics',
      status: 'in-progress',
      priority: 'high',
      assignee: 'John Doe',
      dueDate: new Date(2024, 2, 15),
      project: 'Website Redesign',
      tags: ['design', 'ui/ux', 'homepage'],
      estimatedHours: 20,
      progress: 60,
    },
    {
      id: '2',
      title: 'Setup Authentication System',
      description: 'Implement secure user authentication with JWT',
      status: 'todo',
      priority: 'urgent',
      assignee: 'Jane Smith',
      dueDate: new Date(2024, 2, 20),
      project: 'Website Redesign',
      tags: ['backend', 'security', 'auth'],
      estimatedHours: 15,
    }
  ]);

  const handleCreateTask = (taskData) => {
    const newTask = {
      id: `task-${Date.now()}`,
      title: taskData.title,
      description: taskData.description || '',
      status: 'todo',
      priority: taskData.priority || 'medium',
      assignee: taskData.assigned_to || 'Unassigned',
      dueDate: taskData.due_date ? new Date(taskData.due_date) : null,
      project: 'Demo Project',
      tags: taskData.labels || [],
      estimatedHours: taskData.estimated_hours,
      progress: 0,
    };

    setTasks(prev => [...prev, newTask]);
    console.log('Created task:', newTask);
  };

  const statusColumns = [
    { id: 'todo', title: 'To Do', color: 'bg-blue-100', count: tasks.filter(t => t.status === 'todo').length },
    { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-100', count: tasks.filter(t => t.status === 'in-progress').length },
    { id: 'done', title: 'Done', color: 'bg-green-100', count: tasks.filter(t => t.status === 'done').length }
  ];

  const priorityColors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500'
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Management Hub</h1>
          <p className="text-gray-600">AI-powered project management with enhanced task creation</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateTask(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'done').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in-progress').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Urgent</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.priority === 'urgent').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statusColumns.map(column => (
          <div key={column.id} className={`${column.color} rounded-lg p-4 min-h-[400px]`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{column.title}</h3>
              <Badge variant="secondary">{column.count}</Badge>
            </div>
            
            <div className="space-y-3">
              {tasks
                .filter(task => task.status === column.id)
                .map(task => (
                  <Card key={task.id} className="cursor-pointer hover:shadow-lg transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`}></div>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-3">{task.description}</p>
                      
                      {task.progress && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all" 
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mb-3">
                        {task.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{task.assignee}</span>
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {task.dueDate.toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Created Tasks List */}
      {tasks.length > 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.slice(-3).map(task => (
                <div key={task.id} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{task.title}</h4>
                    <p className="text-sm text-gray-600">{task.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{task.priority}</Badge>
                    <Badge variant="secondary">{task.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Create Task Dialog */}
      <CreateTodoDialog
        isOpen={showCreateTask}
        onOpenChange={setShowCreateTask}
        onCreateTodo={handleCreateTask}
      />
    </div>
  );
};

export default ProjectManagementDemo;