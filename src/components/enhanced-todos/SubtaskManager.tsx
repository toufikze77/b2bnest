import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
}

interface SubtaskManagerProps {
  subtasks: Subtask[];
  onSubtasksChange: (subtasks: Subtask[]) => void;
}

const SubtaskManager: React.FC<SubtaskManagerProps> = ({ subtasks, onSubtasksChange }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Mock user list for assignment
  const mockUsers = [
    { id: 'user1', name: 'John Doe', email: 'john@example.com' },
    { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'user3', name: 'Mike Johnson', email: 'mike@example.com' },
    { id: 'user4', name: 'Sarah Wilson', email: 'sarah@example.com' }
  ];

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;

    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    };

    onSubtasksChange([...subtasks, newSubtask]);
    setNewSubtaskTitle('');
  };

  const updateSubtask = (id: string, updates: Partial<Subtask>) => {
    const updatedSubtasks = subtasks.map(subtask =>
      subtask.id === id ? { ...subtask, ...updates } : subtask
    );
    onSubtasksChange(updatedSubtasks);
  };

  const deleteSubtask = (id: string) => {
    const updatedSubtasks = subtasks.filter(subtask => subtask.id !== id);
    onSubtasksChange(updatedSubtasks);
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Subtasks</Label>
      
      {/* Add new subtask */}
      <div className="flex gap-2">
        <Input
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          placeholder="Add subtask..."
          onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
          className="flex-1"
        />
        <Button 
          type="button" 
          onClick={addSubtask}
          size="sm"
          disabled={!newSubtaskTitle.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Existing subtasks */}
      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <Card key={subtask.id} className="p-3">
            <CardContent className="p-0">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={subtask.completed}
                  onCheckedChange={(checked) => 
                    updateSubtask(subtask.id, { completed: !!checked })
                  }
                />
                
                <Input
                  value={subtask.title}
                  onChange={(e) => updateSubtask(subtask.id, { title: e.target.value })}
                  className={`flex-1 ${subtask.completed ? 'line-through text-gray-500' : ''}`}
                />

                <Select 
                  value={subtask.assignee || ''} 
                  onValueChange={(value) => updateSubtask(subtask.id, { assignee: value || undefined })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Assign">
                      {subtask.assignee ? (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span className="truncate">
                            {mockUsers.find(u => u.id === subtask.assignee)?.name?.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span>Assign</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {mockUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {user.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSubtask(subtask.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {subtasks.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No subtasks yet. Add one above to break down this task.
        </div>
      )}
    </div>
  );
};

export default SubtaskManager;
