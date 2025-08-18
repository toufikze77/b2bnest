import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Target, Plus, Calendar, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Goal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  deadline: string;
  category: string;
  completed: boolean;
}

const GoalTracker = () => {
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('goalTrackerGoals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetValue: 100,
    deadline: '',
    category: 'Business'
  });
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem('goalTrackerGoals', JSON.stringify(goals));
  }, [goals]);

  const addGoal = () => {
    if (!newGoal.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a goal title.",
        variant: "destructive"
      });
      return;
    }

    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title.trim(),
      description: newGoal.description.trim(),
      targetValue: newGoal.targetValue,
      currentValue: 0,
      deadline: newGoal.deadline,
      category: newGoal.category,
      completed: false
    };

    setGoals(prev => [goal, ...prev]);
    setNewGoal({ title: '', description: '', targetValue: 100, deadline: '', category: 'Business' });
    setIsAddingGoal(false);

    toast({
      title: "Goal Created",
      description: `"${goal.title}" has been added to your tracker.`
    });
  };

  const updateProgress = (goalId: string, value: number) => {
    setGoals(prev => prev.map(goal => 
      goal.id === goalId 
        ? { ...goal, currentValue: Math.min(value, goal.targetValue) }
        : goal
    ));
  };

  const toggleComplete = (goalId: string) => {
    setGoals(prev => prev.map(goal => 
      goal.id === goalId 
        ? { ...goal, completed: !goal.completed, currentValue: goal.completed ? 0 : goal.targetValue }
        : goal
    ));
  };

  const deleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(goal => goal.id !== goalId));
    toast({
      title: "Goal Deleted",
      description: "Goal has been removed from your tracker."
    });
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Goal Tracker</h1>
            <p className="text-muted-foreground">Track and achieve your business goals</p>
          </div>
        </div>
        <Button onClick={() => setIsAddingGoal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Goal
        </Button>
      </div>

      {isAddingGoal && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Goal title"
              value={newGoal.title}
              onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
            />
            <Textarea
              placeholder="Goal description (optional)"
              value={newGoal.description}
              onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                placeholder="Target value"
                value={newGoal.targetValue}
                onChange={(e) => setNewGoal(prev => ({ ...prev, targetValue: Number(e.target.value) }))}
              />
              <Input
                type="date"
                value={newGoal.deadline}
                onChange={(e) => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingGoal(false)}>
                Cancel
              </Button>
              <Button onClick={addGoal}>
                Create Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => (
          <Card key={goal.id} className={goal.completed ? 'border-green-200 bg-green-50/50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {goal.completed && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {goal.title}
                  </CardTitle>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                  )}
                </div>
                <Badge variant={goal.completed ? 'default' : 'secondary'}>
                  {goal.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{goal.currentValue} / {goal.targetValue}</span>
                </div>
                <Progress value={getProgressPercentage(goal.currentValue, goal.targetValue)} />
              </div>

              {goal.deadline && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Due: {new Date(goal.deadline).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex gap-2">
                {!goal.completed && (
                  <Input
                    type="number"
                    placeholder="Update progress"
                    className="flex-1"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const value = Number((e.target as HTMLInputElement).value);
                        updateProgress(goal.id, value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                )}
                <Button
                  size="sm"
                  variant={goal.completed ? 'outline' : 'default'}
                  onClick={() => toggleComplete(goal.id)}
                >
                  {goal.completed ? 'Reopen' : 'Complete'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteGoal(goal.id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {goals.length === 0 && !isAddingGoal && (
        <Card className="text-center py-12">
          <CardContent>
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Goals Yet</h3>
            <p className="text-muted-foreground mb-4">Start tracking your business goals to measure progress</p>
            <Button onClick={() => setIsAddingGoal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoalTracker;