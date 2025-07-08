import React, { useState } from 'react';
import { Plus, Trash2, Check, X, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const TodoList = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const addTodo = () => {
    if (newTodo.trim()) {
      const todo: Todo = {
        id: Date.now().toString(),
        text: newTodo.trim(),
        completed: false
      };
      setTodos([...todos, todo]);
      setNewTodo('');
    }
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = () => {
    if (editText.trim()) {
      setTodos(todos.map(todo => 
        todo.id === editingId ? { ...todo, text: editText.trim() } : todo
      ));
    }
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const completedCount = todos.filter(todo => todo.completed).length;
  const totalCount = todos.length;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">To-Do List</h1>
        <p className="text-gray-600">Stay organized and track your tasks efficiently</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Add New Task</span>
            <span className="text-sm font-normal text-gray-500">
              {completedCount}/{totalCount} completed
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter a new task..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
              className="flex-1"
            />
            <Button onClick={addTodo} className="px-6">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">📝</div>
              <p>No tasks yet. Add your first task above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    todo.completed 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => toggleTodo(todo.id)}
                  />
                  
                  <div className="flex-1">
                    {editingId === todo.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button size="sm" onClick={saveEdit} variant="outline">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" onClick={cancelEdit} variant="outline">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={`${
                          todo.completed 
                            ? 'line-through text-gray-500' 
                            : 'text-gray-900'
                        }`}
                      >
                        {todo.text}
                      </span>
                    )}
                  </div>

                  {editingId !== todo.id && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(todo)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTodo(todo.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {todos.length > 0 && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-lg">
            <div className="text-sm text-blue-700">
              <strong>{completedCount}</strong> of <strong>{totalCount}</strong> tasks completed
            </div>
            <div className="w-32 bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoList;