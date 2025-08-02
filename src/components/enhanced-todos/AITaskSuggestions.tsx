import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Lightbulb, Target, Clock, Users, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AITaskSuggestionsProps {
  taskTitle: string;
  taskDescription: string;
  onSuggestionApply: (suggestion: any) => void;
}

const AITaskSuggestions: React.FC<AITaskSuggestionsProps> = ({ 
  taskTitle, 
  taskDescription, 
  onSuggestionApply 
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Mock AI suggestions based on task content
  const generateSuggestions = async () => {
    setLoading(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockSuggestions = [
      {
        id: 1,
        type: 'subtasks',
        icon: Target,
        title: 'Break Down Into Subtasks',
        description: 'I can suggest logical subtasks to make this more manageable',
        confidence: 95,
        suggestion: {
          subtasks: [
            { title: 'Research and planning phase', estimated_hours: 2 },
            { title: 'Initial implementation', estimated_hours: 4 },
            { title: 'Testing and validation', estimated_hours: 2 },
            { title: 'Documentation and review', estimated_hours: 1 }
          ]
        }
      },
      {
        id: 2,
        type: 'estimation',
        icon: Clock,
        title: 'Time Estimation',
        description: 'Based on similar tasks, this should take approximately 8-12 hours',
        confidence: 87,
        suggestion: {
          estimated_hours: 10,
          reasoning: 'Similar complexity tasks typically require 8-12 hours based on historical data'
        }
      },
      {
        id: 3,
        type: 'assignment',
        icon: Users,
        title: 'Optimal Assignment',
        description: 'Jane Smith has relevant experience and availability for this type of task',
        confidence: 78,
        suggestion: {
          assignee: 'user2',
          reasoning: 'Jane has completed 3 similar tasks with high quality ratings'
        }
      },
      {
        id: 4,
        type: 'priority',
        icon: Zap,
        title: 'Priority Recommendation',
        description: 'This task appears to be blocking other work - consider high priority',
        confidence: 85,
        suggestion: {
          priority: 'high',
          reasoning: 'Keywords suggest this is part of a critical path'
        }
      }
    ];

    setSuggestions(mockSuggestions);
    setLoading(false);
  };

  const applySuggestion = (suggestion: any) => {
    onSuggestionApply(suggestion);
    toast({
      title: "Suggestion Applied",
      description: `AI suggestion for ${suggestion.type} has been applied to your task.`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-medium">AI Task Suggestions</h3>
        </div>
        <Button 
          onClick={generateSuggestions} 
          disabled={loading || !taskTitle}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <>
              <Brain className="h-4 w-4 mr-2 animate-pulse" />
              Analyzing...
            </>
          ) : (
            <>
              <Lightbulb className="h-4 w-4 mr-2" />
              Get AI Suggestions
            </>
          )}
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const IconComponent = suggestion.icon;
            return (
              <Card key={suggestion.id} className="border border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <IconComponent className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{suggestion.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {suggestion.confidence}% confident
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                        
                        {suggestion.type === 'subtasks' && (
                          <div className="space-y-1">
                            {suggestion.suggestion.subtasks.map((subtask: any, idx: number) => (
                              <div key={idx} className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                • {subtask.title} ({subtask.estimated_hours}h)
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {suggestion.suggestion.reasoning && (
                          <p className="text-xs text-gray-500 italic mt-2">
                            {suggestion.suggestion.reasoning}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => applySuggestion(suggestion.suggestion)}
                      size="sm"
                      className="ml-3"
                    >
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!taskTitle && (
        <div className="text-center py-6 text-gray-500 text-sm">
          Enter a task title to get AI-powered suggestions for better task management.
        </div>
      )}
    </div>
  );
};

export default AITaskSuggestions;