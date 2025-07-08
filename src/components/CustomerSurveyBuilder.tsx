import React, { useState } from 'react';
import { FileText, Plus, Trash2, Save, Eye, Users, BarChart3, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  type: 'text' | 'multiple-choice' | 'rating' | 'yes-no' | 'email';
  question: string;
  options?: string[];
  required: boolean;
}

interface CustomerSurvey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  status: 'draft' | 'published';
  responses: number;
  createdAt: Date;
}

const CustomerSurveyBuilder = () => {
  const [surveys, setSurveys] = useState<CustomerSurvey[]>([]);
  const [currentSurvey, setCurrentSurvey] = useState<CustomerSurvey | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [surveyData, setSurveyData] = useState({
    title: '',
    description: '',
    questions: [] as Question[]
  });
  const { toast } = useToast();

  const questionTypes = [
    { value: 'text', label: 'Text Answer' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'rating', label: 'Rating (1-5)' },
    { value: 'yes-no', label: 'Yes/No' },
    { value: 'email', label: 'Email Address' }
  ];

  const startNewSurvey = () => {
    if (surveys.length >= 5) {
      toast({
        title: "Survey Limit Reached",
        description: "Free plan allows up to 5 surveys. Upgrade for unlimited surveys.",
        variant: "destructive"
      });
      return;
    }

    setIsBuilding(true);
    setSurveyData({
      title: '',
      description: '',
      questions: []
    });
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: 'text',
      question: '',
      required: false
    };

    setSurveyData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setSurveyData(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      )
    }));
  };

  const deleteQuestion = (questionId: string) => {
    setSurveyData(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
  };

  const saveSurvey = () => {
    if (!surveyData.title || surveyData.questions.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please add a title and at least one question.",
        variant: "destructive"
      });
      return;
    }

    const survey: CustomerSurvey = {
      id: Date.now().toString(),
      title: surveyData.title,
      description: surveyData.description,
      questions: surveyData.questions,
      status: 'draft',
      responses: 0,
      createdAt: new Date()
    };

    setSurveys(prev => [survey, ...prev]);
    setIsBuilding(false);
    setSurveyData({ title: '', description: '', questions: [] });

    toast({
      title: "Survey Created",
      description: `Survey "${survey.title}" has been saved as draft.`
    });
  };

  const publishSurvey = (surveyId: string) => {
    setSurveys(prev => prev.map(survey => 
      survey.id === surveyId 
        ? { ...survey, status: 'published' as const }
        : survey
    ));

    toast({
      title: "Survey Published",
      description: "Your survey is now live and ready to collect responses."
    });
  };

  const duplicateSurvey = (survey: CustomerSurvey) => {
    if (surveys.length >= 5) {
      toast({
        title: "Survey Limit Reached",
        description: "Free plan allows up to 5 surveys.",
        variant: "destructive"
      });
      return;
    }

    const duplicated: CustomerSurvey = {
      ...survey,
      id: Date.now().toString(),
      title: `${survey.title} (Copy)`,
      status: 'draft',
      responses: 0,
      createdAt: new Date()
    };

    setSurveys(prev => [duplicated, ...prev]);
    toast({
      title: "Survey Duplicated",
      description: "Survey has been duplicated and saved as draft."
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'published' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800';
  };

  if (isBuilding) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Build Your Survey</h1>
          <p className="text-gray-600">Create engaging surveys to collect customer feedback</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Survey Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Survey Title *</Label>
              <Input
                id="title"
                placeholder="Customer Satisfaction Survey"
                value={surveyData.title}
                onChange={(e) => setSurveyData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Help us improve by sharing your feedback..."
                rows={3}
                value={surveyData.description}
                onChange={(e) => setSurveyData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Questions</h3>
                <Button onClick={addQuestion} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>

              {surveyData.questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p>No questions added yet. Click "Add Question" to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {surveyData.questions.map((question, index) => (
                    <div key={question.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-gray-600">Question {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteQuestion(question.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label>Question Text</Label>
                          <Input
                            placeholder="Enter your question..."
                            value={question.question}
                            onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Question Type</Label>
                            <Select 
                              value={question.type} 
                              onValueChange={(value: any) => updateQuestion(question.id, { type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {questionTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center space-x-2 pt-6">
                            <input
                              type="checkbox"
                              id={`required-${question.id}`}
                              checked={question.required}
                              onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                              className="rounded"
                            />
                            <Label htmlFor={`required-${question.id}`}>Required</Label>
                          </div>
                        </div>

                        {question.type === 'multiple-choice' && (
                          <div>
                            <Label>Options (one per line)</Label>
                            <Textarea
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              rows={3}
                              value={question.options?.join('\n') || ''}
                              onChange={(e) => updateQuestion(question.id, { 
                                options: e.target.value.split('\n').filter(opt => opt.trim()) 
                              })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={saveSurvey} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save Survey
              </Button>
              <Button variant="outline" onClick={() => setIsBuilding(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Customer Survey Builder</h1>
        <p className="text-gray-600">Create and manage customer feedback surveys</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 5 surveys maximum
        </Badge>
      </div>

      <div className="mb-6">
        <Button onClick={startNewSurvey} disabled={surveys.length >= 5}>
          <Plus className="h-4 w-4 mr-2" />
          {surveys.length >= 5 ? 'Limit Reached' : 'Create New Survey'}
        </Button>
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Surveys Created Yet</h3>
            <p className="text-gray-600 mb-4">
              Start collecting valuable customer feedback by creating your first survey.
            </p>
            <Button onClick={startNewSurvey}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Survey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {surveys.map((survey) => (
            <Card key={survey.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg mb-1">{survey.title}</CardTitle>
                    {survey.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{survey.description}</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(survey.status)}>
                    {survey.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {survey.questions.length} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {survey.responses} responses
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    Created: {survey.createdAt.toLocaleDateString()}
                  </div>

                  <div className="flex gap-2 pt-2">
                    {survey.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => publishSurvey(survey.id)}
                        className="flex-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Publish
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateSurvey(survey)}
                      disabled={surveys.length >= 5}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Survey Distribution & Analytics</h4>
              <p className="text-sm text-blue-700 mb-3">
                Once published, you can share your survey link with customers via email, social media, or embed it on your website. 
                Track responses and analyze feedback to improve your business.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-800">Share Options</div>
                  <div className="text-blue-600">Email, SMS, Social Media, Website Embed</div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-800">Analytics</div>
                  <div className="text-blue-600">Response rates, completion time, feedback trends</div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="font-semibold text-blue-800">Export</div>
                  <div className="text-blue-600">CSV, PDF reports, data visualization</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerSurveyBuilder;