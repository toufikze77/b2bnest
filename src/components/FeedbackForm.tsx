import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, Lightbulb, Bug, Star } from 'lucide-react';

interface FeedbackFormProps {
  type: 'feedback' | 'feature_request';
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ type }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium'
  });

  const categories = type === 'feedback' 
    ? ['General', 'User Interface', 'Performance', 'Bug Report', 'Documentation']
    : ['New Feature', 'Enhancement', 'Integration', 'Mobile App', 'API', 'Other'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to submit feedback.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('feedback_requests')
        .insert({
          user_id: user.id,
          type,
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category || categories[0],
          priority: formData.priority,
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Your ${type === 'feedback' ? 'feedback' : 'feature request'} has been submitted successfully!`
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        category: '',
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit your request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIcon = () => {
    return type === 'feedback' ? MessageSquare : Lightbulb;
  };

  const getTitle = () => {
    return type === 'feedback' ? 'Submit Feedback' : 'Request Feature';
  };

  const getDescription = () => {
    return type === 'feedback' 
      ? 'Help us improve by sharing your thoughts and suggestions'
      : 'Tell us about features you\'d like to see in future updates';
  };

  const Icon = getIcon();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {getTitle()}
        </CardTitle>
        <CardDescription>
          {getDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder={type === 'feedback' ? 'Brief summary of your feedback' : 'Brief description of the feature'}
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder={
                type === 'feedback' 
                  ? 'Please provide detailed feedback about your experience...' 
                  : 'Please describe the feature you would like to see, including how it would help you...'
              }
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
              rows={5}
              maxLength={1000}
            />
            <p className="text-sm text-muted-foreground">
              {formData.description.length}/1000 characters
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting...' : `Submit ${type === 'feedback' ? 'Feedback' : 'Feature Request'}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default FeedbackForm;