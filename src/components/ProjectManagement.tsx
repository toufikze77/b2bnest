import React, { useState } from 'react';

type Task = {
  id: string;
  title: string;
  description: string;
  comments: string[];
  assignees: string[]; // ✅ ensure it's always an array
};

type Column = {
  id: string;
  title: string;
  tasks: Task[];
};

const ProjectManagement: React.FC = () => {
  const [columns, setColumns] = useState<Column[]>([
    { id: 'todo', title: 'To Do', tasks: [] },
    { id: 'inprogress', title: 'In Progress', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

  // ✅ addTask now initializes assignees properly
  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      comments: [],
      assignees: [], // ✅ prevent "undefined is not iterable"
    };
    setColumns((prev) =>
      prev.map((col) =>
        col.id === 'todo' ? { ...col, tasks: [task, ...col.tasks] } : col
      )
    );
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  const addComment = (colId: string, taskId: string, text: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === colId
          ? {
              ...col,
              tasks: col.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, comments: [...t.comments, text] }
                  : t
              ),
            }
          : col
      )
    );
  };

  const assignUser = (colId: string, taskId: string, user: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === colId
          ? {
              ...col,
              tasks: col.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      assignees: t.assignees
                        ? [...t.assignees, user]
                        : [user], // ✅ fallback in case it's missing
                    }
                  : t
              ),
            }
          : col
      )
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Project Management</h1>

      {/* Add Task */}
      <div className="flex gap-2 mb-6">
        <input
          className="border p-2 rounded flex-1"
          placeholder="Task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
        />
        <input
          className="border p-2 rounded flex-1"
          placeholder="Description"
          value={newTaskDesc}
          onChange={(e) => setNewTaskDesc(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={addTask}
        >
          Add Task
        </button>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.id} className="p-4 border rounded">
            <h2 className="font-semibold mb-2">{col.title}</h2>
            {col.tasks.map((task) => (
              <div key={task.id} className="p-3 mb-3 border rounded bg-white">
                <h3 className="font-medium">{task.title}</h3>
                <p className="text-sm text-gray-600">{task.description}</p>

                {/* Comments */}
                <div className="mt-2">
                  <h4 className="text-sm font-semibold mb-1">Comments</h4>
                  {task.comments.map((c, i) => (
                    <p key={i} className="text-xs text-gray-700">
                      • {c}
                    </p>
                  ))}
                  <button
                    className="text-xs text-blue-600 mt-1"
                    onClick={() => addComment(col.id, task.id, 'New comment')}
                  >
                    + Add Comment
                  </button>
                </div>

                {/* Assignees */}
                <div className="mt-2">
                  <h4 className="text-sm font-semibold mb-1">Assignees</h4>
                  {task.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.assignees.map((u, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-gray-200 rounded"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No assignees yet</p>
                  )}
                  <button
                    className="text-xs text-green-600 mt-1"
                    onClick={() => assignUser(col.id, task.id, 'User')}
                  >
                    + Assign User
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectManagement;