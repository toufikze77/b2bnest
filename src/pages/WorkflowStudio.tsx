import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Save, Settings, History, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import WorkflowSidebar from '@/components/workflow/WorkflowSidebar';
import NodeConfigurator from '@/components/workflow/NodeConfigurator';
import ExecutionHistory from '@/components/workflow/ExecutionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'transform' | 'integration';
  category: string;
  name: string;
  position: { x: number; y: number };
  config: Record<string, any>;
  connections: string[];
}

export interface Workflow {
  id?: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  is_active: boolean;
  execution_count: number;
}

const WorkflowStudio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState<Workflow>({
    name: 'Untitled Workflow',
    description: '',
    nodes: [],
    is_active: false,
    execution_count: 0
  });
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    loadWorkflow();
  }, []);

  const loadWorkflow = async () => {
    if (!user) return;
    
    // Load the most recent workflow or create a new one
    const { data, error } = await supabase
      .from('ai_workflows')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data && !error) {
      const nodes = Array.isArray(data.workflow_steps) 
        ? (data.workflow_steps as unknown as WorkflowNode[])
        : [];
      
      setWorkflow({
        id: data.id,
        name: data.name,
        description: data.description || '',
        nodes,
        is_active: data.is_active,
        execution_count: data.usage_count
      });
    }
  };

  const saveWorkflow = async () => {
    if (!user) {
      toast.error('Please sign in to save workflows');
      return;
    }

    setIsSaving(true);
    try {
      const workflowData = {
        user_id: user.id,
        name: workflow.name,
        description: workflow.description,
        workflow_steps: workflow.nodes as any,
        is_active: workflow.is_active,
        updated_at: new Date().toISOString()
      };

      if (workflow.id) {
        const { error } = await supabase
          .from('ai_workflows')
          .update(workflowData)
          .eq('id', workflow.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ai_workflows')
          .insert(workflowData)
          .select()
          .single();

        if (error) throw error;
        setWorkflow(prev => ({ ...prev, id: data.id }));
      }

      toast.success('Workflow saved successfully!');
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const executeWorkflow = async () => {
    if (!workflow.nodes.length) {
      toast.error('Add nodes to your workflow first');
      return;
    }

    setIsExecuting(true);
    try {
      // Simulate workflow execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setWorkflow(prev => ({
        ...prev,
        execution_count: prev.execution_count + 1
      }));

      toast.success('Workflow executed successfully!');
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast.error('Failed to execute workflow');
    } finally {
      setIsExecuting(false);
    }
  };

  const addNode = (nodeType: WorkflowNode) => {
    const newNode: WorkflowNode = {
      ...nodeType,
      id: `node_${Date.now()}`,
      position: { x: 100, y: 100 + workflow.nodes.length * 120 },
      connections: []
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
  };

  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      )
    }));
  };

  const deleteNode = (nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId)
    }));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const connectNodes = (fromId: string, toId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === fromId
          ? { ...node, connections: [...node.connections, toId] }
          : node
      )
    }));
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <input
                type="text"
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="text-xl font-semibold bg-transparent border-none outline-none"
                placeholder="Workflow Name"
              />
              <p className="text-sm text-muted-foreground">
                {workflow.nodes.length} nodes • {workflow.execution_count} executions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={executeWorkflow}
              disabled={isExecuting || !workflow.nodes.length}
            >
              <Play className="h-4 w-4 mr-2" />
              {isExecuting ? 'Executing...' : 'Test Run'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={saveWorkflow}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Node Library */}
        <WorkflowSidebar onAddNode={addNode} />

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          <Tabs defaultValue="canvas" className="flex-1 flex flex-col">
            <div className="border-b px-6">
              <TabsList>
                <TabsTrigger value="canvas">Canvas</TabsTrigger>
                <TabsTrigger value="history">Execution History</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="canvas" className="flex-1 m-0">
              <WorkflowCanvas
                nodes={workflow.nodes}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
                onNodeUpdate={updateNode}
                onNodeDelete={deleteNode}
                onNodeConnect={connectNodes}
              />
            </TabsContent>

            <TabsContent value="history" className="flex-1 m-0 p-6 overflow-auto">
              <ExecutionHistory workflowId={workflow.id} />
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0 p-6 overflow-auto">
              <div className="max-w-2xl space-y-6">
                <div>
                  <label className="text-sm font-medium">Workflow Description</label>
                  <textarea
                    value={workflow.description}
                    onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full mt-2 p-3 border rounded-lg"
                    rows={4}
                    placeholder="Describe what this workflow does..."
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Active Status</p>
                    <p className="text-sm text-muted-foreground">
                      Enable this workflow to run automatically
                    </p>
                  </div>
                  <Button
                    variant={workflow.is_active ? 'default' : 'outline'}
                    onClick={() => setWorkflow(prev => ({ ...prev, is_active: !prev.is_active }))}
                  >
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar - Node Configuration */}
        {selectedNode && (
          <NodeConfigurator
            node={selectedNode}
            onUpdate={(updates) => updateNode(selectedNode.id, updates)}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
};

export default WorkflowStudio;
