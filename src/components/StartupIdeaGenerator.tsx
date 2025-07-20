import React, { useState } from 'react';
import { Lightbulb, Sparkles, RefreshCw, Copy, Download, Brain, Target, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const StartupIdeaGenerator = () => {
  const [industry, setIndustry] = useState('');
  const [budget, setBudget] = useState('');
  const [interests, setInterests] = useState('');
  const [ideas, setIdeas] = useState<Array<{
    title: string;
    description: string;
    targetMarket: string;
    businessModel: string;
    startupCosts: string;
    challenges: string;
    opportunities: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const industries = [
    'Technology & Software',
    'E-commerce & Retail',
    'Healthcare & Wellness',
    'Education & Training',
    'Food & Beverage',
    'Finance & Fintech',
    'Real Estate',
    'Entertainment & Media',
    'Travel & Tourism',
    'Sustainability & Green Tech',
    'Fashion & Beauty',
    'Sports & Fitness',
    'Agriculture & Farming',
    'Manufacturing',
    'Professional Services'
  ];

  const budgetRanges = [
    'Under £1,000',
    '£1,000 - £5,000',
    '£5,000 - £10,000',
    '£10,000 - £25,000',
    '£25,000 - £50,000',
    '£50,000+'
  ];

  const sampleIdeas = [
    {
      title: "AI-Powered Personal Assistant for Small Businesses",
      description: "A virtual assistant that helps small business owners manage appointments, customer inquiries, and basic administrative tasks using natural language processing.",
      targetMarket: "Small business owners, freelancers, and solo entrepreneurs who need administrative support but can't afford full-time staff.",
      businessModel: "SaaS subscription model with tiered pricing based on features and usage volume.",
      startupCosts: "£15,000 - £30,000 for initial development, AI model training, and basic marketing.",
      challenges: "Competition from established players, need for continuous AI model improvement, data privacy concerns.",
      opportunities: "Growing remote work trend, increasing acceptance of AI tools, untapped SME market segment."
    },
    {
      title: "Sustainable Local Food Delivery Network",
      description: "A platform connecting local farmers and sustainable food producers directly with consumers, featuring zero-waste packaging and carbon-neutral delivery.",
      targetMarket: "Environmentally conscious consumers, health-focused families, and supporters of local agriculture.",
      businessModel: "Commission-based revenue from farmers, delivery fees, and premium subscription for regular customers.",
      startupCosts: "£25,000 - £45,000 for platform development, initial inventory, eco-friendly packaging, and delivery vehicles.",
      challenges: "Complex logistics, seasonal availability, competition from established delivery services.",
      opportunities: "Rising environmental awareness, post-pandemic focus on local sourcing, government support for sustainable businesses."
    },
    {
      title: "Virtual Reality Skill Training Platform",
      description: "An immersive VR platform for learning practical skills like cooking, home repairs, and crafts through guided virtual experiences.",
      targetMarket: "Lifelong learners, DIY enthusiasts, educational institutions, and corporate training departments.",
      businessModel: "Freemium model with basic courses free and premium content via subscription or one-time purchases.",
      startupCosts: "£35,000 - £60,000 for VR content development, platform creation, and initial hardware partnerships.",
      challenges: "High content creation costs, VR hardware accessibility, motion sickness concerns for some users.",
      opportunities: "Expanding VR market, remote learning trend, corporate investment in employee development."
    }
  ];

  const generateIdeas = async () => {
    if (!industry && !interests) {
      toast({
        title: "Input Required",
        description: "Please select an industry or describe your interests to generate ideas.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate AI generation with sample ideas for demo
      // In a real implementation, this would call an AI API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const filteredIdeas = sampleIdeas.filter(idea => 
        !industry || idea.targetMarket.toLowerCase().includes(industry.toLowerCase()) ||
        idea.description.toLowerCase().includes(industry.toLowerCase())
      );

      if (filteredIdeas.length === 0) {
        setIdeas(sampleIdeas.slice(0, 2));
      } else {
        setIdeas(filteredIdeas);
      }

      toast({
        title: "Ideas Generated!",
        description: `Generated ${ideas.length || filteredIdeas.length} startup ideas based on your preferences.`,
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Unable to generate ideas. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Idea details copied to clipboard.",
    });
  };

  const exportIdeas = () => {
    const content = ideas.map((idea, index) => 
      `STARTUP IDEA ${index + 1}: ${idea.title}\n\n` +
      `Description: ${idea.description}\n\n` +
      `Target Market: ${idea.targetMarket}\n\n` +
      `Business Model: ${idea.businessModel}\n\n` +
      `Startup Costs: ${idea.startupCosts}\n\n` +
      `Challenges: ${idea.challenges}\n\n` +
      `Opportunities: ${idea.opportunities}\n\n` +
      '---\n\n'
    ).join('');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'startup-ideas.txt';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Your startup ideas have been exported as a text file.",
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
            <Lightbulb className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Startup Idea Generator</h1>
            <p className="text-gray-600">Get inspired with AI-powered business ideas tailored to your interests and budget</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <span>AI-Powered Insights</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            <span>Market Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>Growth Opportunities</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <span>Instant Generation</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Generate Ideas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="industry">Industry Focus</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an industry..." />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="budget">Budget Range</Label>
                <Select value={budget} onValueChange={setBudget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your budget..." />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetRanges.map((range) => (
                      <SelectItem key={range} value={range}>{range}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="interests">Your Interests & Skills</Label>
                <Textarea
                  id="interests"
                  placeholder="Describe your interests, skills, or problems you'd like to solve..."
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  rows={4}
                />
              </div>

              <Button 
                onClick={generateIdeas}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating Ideas...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Ideas
                  </>
                )}
              </Button>

              {ideas.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={exportIdeas}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All Ideas
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Generated Ideas */}
        <div className="lg:col-span-2">
          {ideas.length === 0 ? (
            <Card className="h-full">
              <CardContent className="flex flex-col items-center justify-center h-96 text-center">
                <Lightbulb className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-500 mb-2">Ready to Spark Innovation?</h3>
                <p className="text-gray-400 max-w-md">
                  Fill in your preferences and let our AI generate personalized startup ideas that match your interests and budget.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Startup Ideas</h2>
                <Badge variant="secondary" className="text-sm">
                  {ideas.length} ideas generated
                </Badge>
              </div>

              {ideas.map((idea, index) => (
                <Card key={index} className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl mb-2">{idea.title}</CardTitle>
                        <p className="text-gray-600">{idea.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(
                          `${idea.title}\n\n${idea.description}\n\nTarget Market: ${idea.targetMarket}\n\nBusiness Model: ${idea.businessModel}\n\nStartup Costs: ${idea.startupCosts}\n\nChallenges: ${idea.challenges}\n\nOpportunities: ${idea.opportunities}`
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1 flex items-center gap-2">
                            <Target className="h-4 w-4 text-blue-500" />
                            Target Market
                          </h4>
                          <p className="text-sm text-gray-600">{idea.targetMarket}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            Business Model
                          </h4>
                          <p className="text-sm text-gray-600">{idea.businessModel}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1 flex items-center gap-2">
                            <span className="h-4 w-4 bg-yellow-500 rounded-full flex items-center justify-center text-xs text-white">£</span>
                            Startup Costs
                          </h4>
                          <p className="text-sm text-gray-600">{idea.startupCosts}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">⚠️ Challenges</h4>
                          <p className="text-sm text-gray-600">{idea.challenges}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">🚀 Opportunities</h4>
                          <p className="text-sm text-gray-600">{idea.opportunities}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartupIdeaGenerator;