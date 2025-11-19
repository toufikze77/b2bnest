import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Mail, Phone, User, Briefcase, Users, MessageSquare, Sparkles } from 'lucide-react';

const B2BForm: React.FC = () => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    industry: '',
    company_size: '',
    message: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.company_name.trim() || !formData.contact_name.trim() || 
        !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('b2b-form-submit', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: data.ai_score 
          ? `Form submitted! AI Lead Score: ${data.ai_score}/100`
          : 'Your B2B inquiry has been submitted successfully',
      });

      // Reset form
      setFormData({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        industry: '',
        company_size: '',
        message: '',
        priority: 'medium',
      });
    } catch (e: any) {
      console.error('Submission error:', e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to submit form. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Lead Qualification</span>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            B2B Partnership Request
          </h1>
          <p className="text-muted-foreground text-lg">
            Connect with us for business opportunities and collaborations
          </p>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>
              Tell us about your company and how we can work together
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company_name" className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Company Name *
              </Label>
              <Input
                id="company_name"
                placeholder="Your Company Ltd."
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className="border-2"
              />
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contact_name" className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Contact Name *
              </Label>
              <Input
                id="contact_name"
                placeholder="John Doe"
                value={formData.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                className="border-2"
              />
            </div>

            {/* Email & Phone */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@company.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="border-2"
                />
              </div>
            </div>

            {/* Industry & Company Size */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry" className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Industry
                </Label>
                <Select value={formData.industry} onValueChange={(v) => handleChange('industry', v)}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_size" className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Company Size
                </Label>
                <Select value={formData.company_size} onValueChange={(v) => handleChange('company_size', v)}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501+">501+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Request Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(v: any) => handleChange('priority', v)}
              >
                <SelectTrigger className="border-2">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Your Message *
              </Label>
              <Textarea
                id="message"
                placeholder="Tell us about your business needs and how we can help..."
                value={formData.message}
                onChange={(e) => handleChange('message', e.target.value)}
                rows={6}
                className="border-2 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSubmit} 
                disabled={submitting}
                className="flex-1"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setFormData({
                  company_name: '',
                  contact_name: '',
                  email: '',
                  phone: '',
                  industry: '',
                  company_size: '',
                  message: '',
                  priority: 'medium',
                })}
                size="lg"
              >
                Reset
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              * Required fields. Your information will be processed securely with AI-powered lead qualification.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default B2BForm;