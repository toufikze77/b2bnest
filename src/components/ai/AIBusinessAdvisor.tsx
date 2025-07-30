import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, Send, TrendingUp, Target, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AIBusinessAdvisor = () => {
  const [question, setQuestion] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessStage, setBusinessStage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const { toast } = useToast();

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 
    'Professional Services', 'Real Estate', 'Education', 'Food & Beverage', 'Other'
  ];

  const businessStages = [
    'Startup', 'Growth Stage', 'Established', 'Scale-up', 'Enterprise'
  ];

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

      setResponse(data.response);
      toast({
        title: "Advice Generated",
        description: "Your AI business advisor has provided strategic insights!",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to get advice from AI. Please try again.",
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
                Get personalized strategic advice based on your industry and business stage
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
            <label className="text-sm font-medium mb-2 block">Your Question</label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask me anything about your business strategy, operations, growth, or challenges..."
              rows={3}
            />
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