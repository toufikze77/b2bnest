import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, Send, TrendingUp, Target, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AI_QUESTION_MAX_LENGTH, BUSINESS_STAGES, INDUSTRIES, aiErrorMessage, creditsLeftText } from "@/lib/aiStudio";

const AIBusinessAdvisor = () => {
  const [question, setQuestion] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessStage, setBusinessStage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const { toast } = useToast();

  const industries = INDUSTRIES;
  const businessStages = BUSINESS_STAGES;
  const [creditsLeft, setCreditsLeft] = useState<string | null>(null);

  const quickQuestions = [
    'How can I reduce operational costs?',
    'What growth strategies should I consider?',
    'How to improve customer retention?',
    'What compliance requirements should I know?',
    'How to scale my business effectively?'
  ];

  const handleAskAdvisor = async () => {
    if (!question.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide your question.",
        variant: "destructive",
      });
      return;
    }
    
    if (question.length > AI_QUESTION_MAX_LENGTH) {
      toast({ title: "Question too long", description: `The limit is ${AI_QUESTION_MAX_LENGTH.toLocaleString('en-GB')} characters.`, variant: "destructive" });
      return;
    }

    if (!industry || !businessStage) {
      toast({
        title: "Missing Information", 
        description: "Please select your industry and business stage.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: question,
          conversationType: 'business_advisor',
          userIndustry: industry,
          businessStage: businessStage,
          context: {
            questionType: 'strategic_advice'
          }
        }
      });

      if (error) throw error;
      if (typeof data?.response !== 'string' || !data.response.trim()) throw new Error('No answer');

      setResponse(data.response);
      // Phase 20: ai-assistant returns the credits left after this answer.
      const left = creditsLeftText(data);
      setCreditsLeft(left);
      toast({
        title: "Advice ready",
        description: left ?? "Your answer is below.",
      });
    } catch (error) {
      // Phase 20: the server's own reason (no credits left, trial ended, suspended, AI service down: credit given back).
      toast({
        title: "No answer this time",
        description: await aiErrorMessage(error, "The AI advisor didn't answer. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Brain className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>AI Business Advisor</CardTitle>
              <CardDescription>
                General strategic advice for your industry and business stage. It doesn't read your own business data. Each answer uses one AI credit.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Business Context */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Industry</label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind.toLowerCase()}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Business Stage</label>
              <Select value={businessStage} onValueChange={setBusinessStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business stage" />
                </SelectTrigger>
                <SelectContent>
                  {businessStages.map((stage) => (
                    <SelectItem key={stage} value={stage.toLowerCase()}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Questions */}
          <div>
            <label className="text-sm font-medium mb-2 block">Quick Questions</label>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-blue-50"
                  onClick={() => setQuestion(q)}
                >
                  {q}
                </Badge>
              ))}
            </div>
          </div>

          {/* Question Input */}
          <div>
            <label htmlFor="advisor-question" className="text-sm font-medium mb-2 block">Your Question</label>
            <Textarea
              id="advisor-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={AI_QUESTION_MAX_LENGTH}
              aria-describedby="advisor-question-count"
              placeholder="Ask me anything about your business strategy, operations, growth, or challenges..."
              rows={3}
            />
            <p id="advisor-question-count" className={`mt-1 text-right text-xs ${question.length >= AI_QUESTION_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="polite">
              {question.length.toLocaleString('en-GB')} / {AI_QUESTION_MAX_LENGTH.toLocaleString('en-GB')} characters
            </p>
          </div>

          <Button 
            onClick={handleAskAdvisor} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Brain className="h-4 w-4 mr-2 animate-spin" />
                Getting Strategic Advice...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Ask AI Advisor
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditsLeft && <p className="mb-3 text-xs text-muted-foreground" data-testid="credits-left">{creditsLeft}</p>}
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                {response}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benefits Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-semibold text-green-900">Growth Insights</h4>
            <p className="text-sm text-green-700">Strategic recommendations for scaling</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-semibold text-blue-900">Cost Optimization</h4>
            <p className="text-sm text-blue-700">Identify savings opportunities</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h4 className="font-semibold text-purple-900">Market Analysis</h4>
            <p className="text-sm text-purple-700">Industry-specific insights</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIBusinessAdvisor;