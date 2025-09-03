import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types
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
  comments?: Comment[];
  progress?: number;
}

interface Comment {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed';
  members: string[];
  deadline: Date | null;
}

interface Team {
  id: string;
  name: string;
  members: string[];
}

interface ProjectManagementProps {
  projects?: Project[];
  teams?: Team[];
  tasks?: Task[];
}

const columns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'Todo' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

const ProjectManagement: React.FC<ProjectManagementProps> = ({
  projects = [],
  teams = [],
  tasks = [],
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('kanban');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        {/* Kanban Board */}
        <TabsContent value="kanban">
          <div className="grid grid-cols-5 gap-4">
            {columns.map((col) => (
              <div key={col.id} className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{col.title}</h3>
                  <Button size="sm" variant="ghost">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {tasks
                    .filter((task) => task.status === col.id)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="bg-white p-3 rounded shadow-sm border hover:shadow-md transition"
                      >
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs text-gray-500">{task.description}</p>
                        )}
                        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                          <span>{task.priority}</span>
                          <span>
                            💬 {task.comments ? task.comments.length : 0}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* List View */}
        <TabsContent value="list">
          <ul className="divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="p-3">
                <strong>{task.title}</strong> — {task.status}
              </li>
            ))}
          </ul>
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats">
          <div className="p-6 bg-white rounded-lg border">
            <h2 className="text-lg font-bold mb-4">Stats</h2>
            <p className="text-gray-500">Projects: {projects.length}</p>
            <p className="text-gray-500">Teams: {teams.length}</p>
            <p className="text-gray-500">Tasks: {tasks.length}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectManagement;
