import React, { useState, useEffect } from 'react';

type Goal = {
  id: string;
  title: string;
  description: string;
  targetDate: string; // store as string for localStorage
  progress: number;
  category: string;
  isCompleted: boolean;
  createdAt: string;
};

const categories = ['Business', 'Health', 'Learning', 'Personal'];

const GoalTracker: React.FC = () => {
  // Load goals from localStorage on mount
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const raw = localStorage.getItem('goalTrackerGoals');
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('Failed to load goals:', error);
      return [];
    }
  });

  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
    category: 'Business',
  });

  // Persist goals to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('goalTrackerGoals', JSON.stringify(goals));
    } catch (error) {
      console.error('Failed to save goals:', error);
    }
  }, [goals]);

  const addGoal = () => {
    if (!newGoal.title.trim()) return;
    if (goals.length >= 10) return;

    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title.trim(),
      description: newGoal.description.trim(),
      targetDate: newGoal.targetDate,
      progress: 0,
      category: newGoal.category,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    setGoals([goal, ...goals]);
    setNewGoal({ title: '', description: '', targetDate: '', category: 'Business' });
    setIsAddingGoal(false);
  };

  const updateProgress = (goalId: string, newProgress: number) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, progress: Math.max(0, Math.min(100, newProgress)), isCompleted: newProgress >= 100 }
          : g
      )
    );
  };

  const deleteGoal = (goalId: string) => {
    setGoals(goals.filter((g) => g.id !== goalId));
  };

  const daysLeft = (targetDateStr: string) => {
    if (!targetDateStr) return NaN;
    const target = new Date(targetDateStr);
    const today = new Date();
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Goal Tracker</h1>
      <p className="text-gray-600 mb-6">Set and monitor your business milestones</p>

      {/* Add Goal */}
      <div className="mb-6 p-4 border rounded-lg">
        {!isAddingGoal ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">{goals.length}/10 goals</div>
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={() => setIsAddingGoal(true)}
              disabled={goals.length >= 10}
            >
              Add New Goal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              className="w-full border p-2 rounded"
              placeholder="Goal title"
              value={newGoal.title}
              onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))}
            />
            <input
              className="w-full border p-2 rounded"
              placeholder="Description"
              value={newGoal.description}
              onChange={(e) => setNewGoal((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border p-2 rounded"
                value={newGoal.category}
                onChange={(e) => setNewGoal((p) => ({ ...p, category: e.target.value }))}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="border p-2 rounded"
                type="date"
                value={newGoal.targetDate}
                onChange={(e) => setNewGoal((p) => ({ ...p, targetDate: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={addGoal}>
                Add Goal
              </button>
              <button className="px-4 py-2 rounded border" onClick={() => setIsAddingGoal(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Goals List */}
      <div className="p-4 border rounded-lg">
        {goals.length === 0 ? (
          <p className="text-gray-600">No goals yet. Add your first goal above.</p>
        ) : (
          <div className="space-y-4">
            {goals.map((g) => {
              const d = daysLeft(g.targetDate);
              const overdue = !Number.isNaN(d) && d < 0;
              const dueSoon = !Number.isNaN(d) && d >= 0 && d <= 7;

              return (
                <div
                  key={g.id}
                  className={`p-4 rounded border transition ${
                    g.isCompleted
                      ? 'bg-green-50 border-green-200'
                      : overdue
                      ? 'bg-red-50 border-red-200'
                      : dueSoon
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className={`font-semibold ${g.isCompleted ? 'line-through text-gray-600' : 'text-gray-900'}`}>
                        {g.title}
                      </h3>
                      {g.description && <p className="text-sm text-gray-600">{g.description}</p>}
                      <div className="text-sm text-gray-600 mt-1">
                        Target: {g.targetDate || '—'} •{' '}
                        {Number.isNaN(d) ? '—' : overdue ? `${Math.abs(d)} days overdue` : d === 0 ? 'Due today' : `${d} days left`}
                      </div>
                    </div>
                    <button className="text-red-600" onClick={() => deleteGoal(g.id)}>
                      Delete
                    </button>
                  </div>

                  {!g.isCompleted && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress: {g.progress}%</span>
                        <div className="flex gap-2">
                          <button className="px-2 py-1 border rounded" onClick={() => updateProgress(g.id, g.progress + 10)}>
                            +10%
                          </button>
                          <button className="px-2 py-1 border rounded" onClick={() => updateProgress(g.id, g.progress - 10)}>
                            -10%
                          </button>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 rounded">
                        <div className="h-2 rounded" style={{ width: `${g.progress}%`, background: '#2563eb' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalTracker;
