
import React, { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle, Circle, Calendar, TrendingUp, Edit, Trash2, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  category: string;
  isCompleted: boolean;
  createdAt: string;
}

const GoalTracker = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
    category: 'Business'
  });
  const { toast } = useToast();

  // Load goals from localStorage on initialization
  useEffect(() => {
    try {
      const saved = localStorage.getItem('goalTrackerGoals');
      if (saved) {
        const parsedGoals = JSON.parse(saved);
        console.log('Loading goals from localStorage:', parsedGoals);
        setGoals(parsedGoals);
      }
    } catch (error) {
      console.error('Error loading goals from localStorage:', error);
      setGoals([]);
    }
  }, []);

  // Save goals to localStorage whenever goals change
  useEffect(() => {
    try {
      console.log('Saving goals to localStorage:', goals);
      localStorage.setItem('goalTrackerGoals', JSON.stringify(goals));
    } catch (error) {
      console.error('Error saving goals to localStorage:', error);
    }
  }, [goals]);

  const categories = [
    'Business', 'Financial', 'Marketing', 'Sales', 'Product', 'Team', 'Personal'
  ];

  const addGoal = () => {
    if (!newGoal.title.trim() || !newGoal.targetDate) {
      toast({
        title: "Missing Information",
        description: "Please enter a goal title and target date.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 10 goals max
    if (goals.length >= 10) {
      toast({
        title: "Goal Limit Reached",
        description: "Free plan allows up to 10 goals. Upgrade for unlimited goals.",
        variant: "destructive"
      });
      return;
    }

    const goal: Goal = {
      id: Date.now().toString(),
      title: newGoal.title.trim(),
      description: newGoal.description.trim(),
      targetDate: newGoal.targetDate,
      progress: 0,
      category: newGoal.category,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };

    console.log('Adding new goal:', goal);

    setGoals(prev => {
      const newGoals = [goal, ...prev];
      console.log('Updated goals array:', newGoals);
      return newGoals;
    });

    setNewGoal({
      title: '',
      description: '',
      targetDate: '',
      category: 'Business'
    });
    setIsAddingGoal(false);

    toast({
      title: "Goal Added",
      description: `"${goal.title}" has been added to your goals.`
    });
  };

  const updateProgress = (goalId: string, newProgress: number) => {
    setGoals(prev => prev.map(goal => {
      if (goal.id === goalId) {
        const isCompleted = newProgress >= 100;
        if (isCompleted && !goal.isCompleted) {
          toast({
            title: "🎉 Goal Completed!",
            description: `Congratulations on completing "${goal.title}"!`
          });
        }
        return { ...goal, progress: newProgress, isCompleted };
      }
      return goal;
    }));
  };

  const deleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(goal => goal.id !== goalId));
    toast({
      title: "Goal Deleted",
      description: "Goal has been removed from your tracker."
    });
  };

  const getDaysUntilTarget = (targetDate: string) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const completedGoals = goals.filter(goal => goal.isCompleted).length;
  const averageProgress = goals.length > 0 ? goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length : 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Goal Tracker</h1>
        <p className="text-gray-600">Set and monitor your business milestones</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 10 goals maximum
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Overview Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {goals.length}
                </div>
                <p className="text-gray-600 text-sm">Total Goals</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-xl font-semibold text-green-600">{completedGoals}</div>
                  <div className="text-xs text-green-700">Completed</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xl font-semibold text-blue-600">{Math.round(averageProgress)}%</div>
                  <div className="text-xs text-blue-700">Avg Progress</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add New Goal */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              Add New Goal
              <Badge variant="outline" className="text-xs">
                {goals.length}/10 goals
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isAddingGoal ? (
              <Button 
                onClick={() => setIsAddingGoal(true)} 
                className="w-full"
                disabled={goals.length >= 10}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Goal
              </Button>
            ) : (
              <div className="space-y-4">
                <Input
                  placeholder="Goal title (e.g., Reach $10K monthly revenue)"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    className="p-2 border border-gray-300 rounded-md"
                    value={newGoal.category}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addGoal} className="flex-1">
                    <Target className="h-4 w-4 mr-2" />
                    Add Goal
                  </Button>
                  <Button onClick={() => setIsAddingGoal(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Your Goals ({goals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No goals yet. Set your first goal above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const daysLeft = getDaysUntilTarget(goal.targetDate);
                const isOverdue = daysLeft < 0;
                const isDueSoon = daysLeft <= 7 && daysLeft >= 0;

                return (
                  <div
                    key={goal.id}
                    className={`p-4 border rounded-lg transition-all ${
                      goal.isCompleted 
                        ? 'bg-green-50 border-green-200' 
                        : isOverdue 
                        ? 'bg-red-50 border-red-200'
                        : isDueSoon
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {goal.isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-400" />
                          )}
                          <h3 className={`font-semibold ${goal.isCompleted ? 'line-through text-gray-600' : 'text-gray-900'}`}>
                            {goal.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {goal.category}
                          </Badge>
                        </div>
                        {goal.description && (
                          <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Target: {new Date(goal.targetDate).toLocaleDateString()}
                          </span>
                          <span className={`flex items-center gap-1 ${
                            isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-600'
                          }`}>
                            {isOverdue ? `${Math.abs(daysLeft)} days overdue` : 
                             daysLeft === 0 ? 'Due today' :
                             `${daysLeft} days left`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGoal(goal.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {!goal.isCompleted && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progress: {goal.progress}%</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateProgress(goal.id, Math.min(100, goal.progress + 10))}
                            >
                              +10%
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateProgress(goal.id, Math.max(0, goal.progress - 10))}
                            >
                              -10%
                            </Button>
                          </div>
                        </div>
                        <Progress value={goal.progress} className="h-2" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Ready to Scale Your Goals?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited goals, sub-tasks, team goals, progress analytics, and milestone notifications.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited goals</Badge>
                <Badge variant="outline" className="text-xs">Pro: Team goals + Analytics</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Advanced reporting</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoalTracker;
