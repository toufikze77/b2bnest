import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string;
  comments: string[];
};

type Column = {
  id: string;
  title: string;
  tasks: Task[];
};

const STORAGE_KEY = "projectManagementData";

const ProjectManagement: React.FC = () => {
  const [columns, setColumns] = useState<Column[]>([
    { id: "todo", title: "To Do", tasks: [] },
    { id: "inprogress", title: "In Progress", tasks: [] },
    { id: "done", title: "Done", tasks: [] },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("todo");
  const [activeCommentTask, setActiveCommentTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState("");

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setColumns(JSON.parse(raw));
    } catch {
      // ignore errors
    }
  }, []);

  // Save to localStorage whenever columns change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {
      // ignore write errors
    }
  }, [columns]);

  // Add a task
  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      comments: [],
    };
    setColumns((prev) =>
      prev.map((col) =>
        col.id === selectedColumn ? { ...col, tasks: [task, ...col.tasks] } : col
      )
    );
    setNewTaskTitle("");
    setNewTaskDesc("");
  };

  // Add a comment
  const addComment = (taskId: string, colId: string) => {
    if (!newComment.trim()) return;
    setColumns((prev) =>
      prev.map((col) =>
        col.id === colId
          ? {
              ...col,
              tasks: col.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, comments: [...t.comments, newComment.trim()] }
                  : t
              ),
            }
          : col
      )
    );
    setNewComment("");
    setActiveCommentTask(null);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Project Management</h1>

      {/* Add Task */}
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
        />
        <Input
          placeholder="Task description"
          value={newTaskDesc}
          onChange={(e) => setNewTaskDesc(e.target.value)}
        />
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          className="border rounded p-2"
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <Button onClick={addTask}>Add Task</Button>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.id} className="bg-gray-50 p-3 rounded shadow">
            <h2 className="font-semibold mb-3">{col.title}</h2>
            <div className="space-y-3">
              {col.tasks.map((task) => (
                <Card key={task.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600">{task.description}</p>
                      )}
                    </div>
                    {/* Comment button with count */}
                    <button
                      className="flex items-center text-sm text-gray-600 hover:text-blue-600"
                      onClick={() => setActiveCommentTask(task)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      {task.comments.length > 0 && task.comments.length}
                    </button>
                  </div>

                  {/* Comments List */}
                  {task.comments.length > 0 && (
                    <div className="mt-2 pl-2 border-l text-sm space-y-1">
                      {task.comments.map((c, i) => (
                        <p key={i} className="text-gray-700">
                          • {c}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Add Comment */}
                  {activeCommentTask?.id === task.id && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => addComment(task.id, col.id)}
                        >
                          Add Comment
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveCommentTask(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectManagement;
