import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Workflow, Plus, Play, Edit, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WorkflowStep {
  id: string;
  name: string;
  type: 'trigger' | 'action' | 'condition';
  description: string;
  config: any;
}

interface AIWorkflow {
  id: string;
  name: string;
  description: string;
  workflow_steps: any;
  industry_tags: string[];
  is_active: boolean;
  usage_count: number;
}

const WorkflowBuilder = () => {
  const [workflows, setWorkflows] = useState<AIWorkflow[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    industry: ''
  });
  const { toast } = useToast();

  const workflowTemplates = [
    {
      name: "New Client Onboarding",
      description: "Automated process for onboarding new clients with document generation",
      steps: [
        { type: 'trigger', name: 'Client Signup', description: 'When a new client registers' },
        { type: 'action', name: 'Generate Welcome Email', description: 'Send personalized welcome email' },
        { type: 'action', name: 'Create Document Package', description: 'Generate required documents' },
        { type: 'action', name: 'Schedule Follow-up', description: 'Create calendar reminder' }
      ],
      industry: 'Professional Services'
    },
    {
      name: "Invoice Processing",
      description: "Automated invoice creation and payment tracking",
      steps: [
        { type: 'trigger', name: 'Service Completed', description: 'When work is marked complete' },
        { type: 'action', name: 'Generate Invoice', description: 'Auto-create invoice from template' },
        { type: 'action', name: 'Send to Client', description: 'Email invoice to client' },
        { type: 'condition', name: 'Payment Check', description: 'Monitor payment status' },
        { type: 'action', name: 'Send Reminder', description: 'Auto-reminder if overdue' }
      ],
      industry: 'Finance'
    },
    {
      name: "HR Process Automation",
      description: "Streamlined employee document generation and tracking",
      steps: [
        { type: 'trigger', name: 'New Hire', description: 'When employee is added' },
        { type: 'action', name: 'Generate Contracts', description: 'Create employment documents' },
        { type: 'action', name: 'Setup Onboarding', description: 'Prepare welcome materials' },
        { type: 'condition', name: 'Document Signed', description: 'Check completion status' }
      ],
      industry: 'Human Resources'
    }
  ];

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Error loading workflows:', error);
    }
  };

  const createWorkflow = async (template?: any) => {
    const workflowData = template || newWorkflow;
    
    if (!workflowData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for your workflow.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const steps = template ? template.steps.map((step: any, index: number) => ({
        id: `step_${index}`,
        ...step,
        config: {}
      })) : [];

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ai_workflows')
        .insert({
          user_id: user.user.id,
          name: workflowData.name,
          description: workflowData.description,
          workflow_steps: steps,
          industry_tags: workflowData.industry ? [workflowData.industry.toLowerCase()] : [],
          is_active: true
        });

      if (error) throw error;

      await loadWorkflows();
      setNewWorkflow({ name: '', description: '', industry: '' });
      toast({
        title: "Workflow Created",
        description: "Your AI workflow has been successfully created!",
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: "Error",
        description: "Failed to create workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleWorkflow = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_workflows')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      await loadWorkflows();
      
      toast({
        title: `Workflow ${!isActive ? 'Activated' : 'Deactivated'}`,
        description: `The workflow has been ${!isActive ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'trigger': return '⚡';
      case 'action': return '⚙️';
      case 'condition': return '❓';
      default: return '📋';
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'trigger': return 'bg-green-100 text-green-800';
      case 'action': return 'bg-blue-100 text-blue-800';
      case 'condition': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Workflow className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <CardTitle>AI Workflow Builder</CardTitle>
              <CardDescription>
                Design and automate your business processes with intelligent workflows
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create New Workflow */}
          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Custom Workflow
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Workflow name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
              />
              <Input
                placeholder="Industry (optional)"
                value={newWorkflow.industry}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, industry: e.target.value })}
              />
              <Button 
                onClick={() => createWorkflow()}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Workflow'}
              </Button>
            </div>
            <Textarea
              placeholder="Describe what this workflow should accomplish..."
              value={newWorkflow.description}
              onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Workflow Templates */}
          <div>
            <h4 className="font-semibold mb-4">Quick Start Templates</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workflowTemplates.map((template, index) => (
                <Card key={index} className="border-dashed hover:border-solid transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="space-y-1">
                      {template.steps.slice(0, 3).map((step, stepIndex) => (
                        <div key={stepIndex} className="flex items-center gap-2 text-xs">
                          <span>{getStepIcon(step.type)}</span>
                          <span className="text-gray-600">{step.name}</span>
                        </div>
                      ))}
                      {template.steps.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{template.steps.length - 3} more steps
                        </div>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      onClick={() => createWorkflow(template)}
                      disabled={isCreating}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Workflows */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Workflows</h3>
        {workflows.length > 0 ? (
          workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Workflow className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <CardDescription>{workflow.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={workflow.is_active ? "default" : "secondary"}>
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      Used {workflow.usage_count} times
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Workflow Steps */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Workflow Steps:</h5>
                    <div className="space-y-2">
                      {workflow.workflow_steps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <Badge className={getStepColor(step.type)} variant="secondary">
                            {getStepIcon(step.type)} {step.type}
                          </Badge>
                          <span className="text-sm">{step.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toggleWorkflow(workflow.id, workflow.is_active)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      {workflow.is_active ? 'Pause' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Workflow className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Workflows Yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first automated workflow to streamline your business processes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;
