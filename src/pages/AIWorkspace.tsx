import React, { useState, useEffect } from 'react';
import { Plus, Brain, Save, FileText, Image, List, Hash, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubscription } from '@/hooks/useSubscription';
import SubscriptionUpgrade from '@/components/SubscriptionUpgrade';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Block {
  id: string;
  type: 'text' | 'heading' | 'image' | 'list' | 'quote' | 'divider';
  content: string;
  order: number;
}

interface Workspace {
  id: string;
  user_id: string;
  title: string;
  blocks: Block[];
  created_at: string;
  updated_at: string;
}

const AIWorkspace = () => {
  const { isPremium, loading } = useSubscription();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newWorkspaceTitle, setNewWorkspaceTitle] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (isPremium && user) {
      loadWorkspaces();
    }
  }, [isPremium, user]);

  const loadWorkspaces = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('ai_workspaces' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading workspaces:', error);
      return;
    }

    const workspaces = (data || []) as unknown as Workspace[];
    setWorkspaces(workspaces);
    if (workspaces.length > 0 && !currentWorkspace) {
      setCurrentWorkspace(workspaces[0]);
    }
  };

  const createWorkspace = async () => {
    if (!user || !newWorkspaceTitle.trim()) return;

    const newWorkspace = {
      user_id: user.id,
      title: newWorkspaceTitle,
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'heading' as const,
          content: newWorkspaceTitle,
          order: 0
        }
      ]
    };

    const { data, error } = await supabase
      .from('ai_workspaces' as any)
      .insert(newWorkspace)
      .select()
      .single();

    if (error) {
      toast.error('Failed to create workspace');
      return;
    }

    const workspace = data as unknown as Workspace;
    setWorkspaces(prev => [workspace, ...prev]);
    setCurrentWorkspace(workspace);
    setNewWorkspaceTitle('');
    toast.success('Workspace created!');
  };

  const addBlock = (type: Block['type']) => {
    if (!currentWorkspace) return;

    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      content: '',
      order: currentWorkspace.blocks.length
    };

    const updatedWorkspace = {
      ...currentWorkspace,
      blocks: [...currentWorkspace.blocks, newBlock]
    };

    setCurrentWorkspace(updatedWorkspace);
  };

  const updateBlock = (blockId: string, content: string) => {
    if (!currentWorkspace) return;

    const updatedWorkspace = {
      ...currentWorkspace,
      blocks: currentWorkspace.blocks.map(block =>
        block.id === blockId ? { ...block, content } : block
      )
    };

    setCurrentWorkspace(updatedWorkspace);
  };

  const deleteBlock = (blockId: string) => {
    if (!currentWorkspace) return;

    const updatedWorkspace = {
      ...currentWorkspace,
      blocks: currentWorkspace.blocks.filter(block => block.id !== blockId)
    };

    setCurrentWorkspace(updatedWorkspace);
  };

  const saveWorkspace = async () => {
    if (!currentWorkspace || !user) return;

    const { error } = await supabase
      .from('ai_workspaces' as any)
      .update({
        title: currentWorkspace.title,
        blocks: currentWorkspace.blocks,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentWorkspace.id);

    if (error) {
      toast.error('Failed to save workspace');
      return;
    }

    toast.success('Workspace saved!');
    loadWorkspaces();
  };

  const generateWithAI = async (prompt: string) => {
    if (!currentWorkspace) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          message: `Generate content for a workspace document based on this prompt: ${prompt}. Format it as structured content with headings, paragraphs, and lists. Use markdown formatting with # for headings and - for lists.`,
          conversationType: 'document_assistant',
          userIndustry: 'General',
          businessStage: 'startup'
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to generate content');
      }

      if (!data || !data.response) {
        throw new Error('No response received from AI');
      }

      // Parse AI response and create blocks
      const aiContent = data.response;
      const lines = aiContent.split('\n').filter((line: string) => line.trim());
      
      const newBlocks: Block[] = [];
      let order = currentWorkspace.blocks.length;

      lines.forEach((line: string) => {
        if (line.startsWith('# ')) {
          newBlocks.push({
            id: crypto.randomUUID(),
            type: 'heading',
            content: line.replace('# ', ''),
            order: order++
          });
        } else if (line.startsWith('## ')) {
          newBlocks.push({
            id: crypto.randomUUID(),
            type: 'heading',
            content: line.replace('## ', ''),
            order: order++
          });
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          newBlocks.push({
            id: crypto.randomUUID(),
            type: 'list',
            content: line.replace(/^[*-] /, ''),
            order: order++
          });
        } else if (line.startsWith('> ')) {
          newBlocks.push({
            id: crypto.randomUUID(),
            type: 'quote',
            content: line.replace('> ', ''),
            order: order++
          });
        } else if (line.trim()) {
          newBlocks.push({
            id: crypto.randomUUID(),
            type: 'text',
            content: line,
            order: order++
          });
        }
      });

      if (newBlocks.length === 0) {
        // Fallback: create a single text block with the entire content
        newBlocks.push({
          id: crypto.randomUUID(),
          type: 'text',
          content: aiContent,
          order: currentWorkspace.blocks.length
        });
      }

      const updatedWorkspace = {
        ...currentWorkspace,
        blocks: [...currentWorkspace.blocks, ...newBlocks]
      };

      setCurrentWorkspace(updatedWorkspace);
      toast.success(`AI generated ${newBlocks.length} content blocks!`);
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error(`Failed to generate AI content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderBlock = (block: Block) => {
    const commonProps = {
      value: block.content,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        updateBlock(block.id, e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && block.content === '') {
          deleteBlock(block.id);
        }
      },
      className: "border-none outline-none resize-none bg-transparent"
    };

    switch (block.type) {
      case 'heading':
        return (
          <Input
            {...commonProps}
            placeholder="Heading"
            className="text-2xl font-bold"
          />
        );
      case 'text':
        return (
          <Textarea
            {...commonProps}
            placeholder="Start writing..."
            className="min-h-[60px]"
          />
        );
      case 'list':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-2">•</span>
            <Input
              {...commonProps}
              placeholder="List item"
            />
          </div>
        );
      case 'quote':
        return (
          <div className="border-l-4 border-primary pl-4">
            <Textarea
              {...commonProps}
              placeholder="Quote"
              className="italic min-h-[60px]"
            />
          </div>
        );
      case 'divider':
        return <hr className="my-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!isPremium) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Brain className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-4">AI Workspace</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Create, edit, and collaborate with AI assistance - like Notion, but smarter
          </p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Premium Feature</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">
              AI Workspace is available for premium subscribers. Upgrade to access:
            </p>
            <ul className="text-left mb-6 space-y-2">
              <li>• Unlimited AI-powered workspaces</li>
              <li>• Real-time collaboration</li>
              <li>• Smart content generation</li>
              <li>• Advanced formatting options</li>
              <li>• Export to multiple formats</li>
            </ul>
            <Button onClick={() => setShowUpgrade(true)}>
              Upgrade to Premium
            </Button>
          </CardContent>
        </Card>

        {showUpgrade && (
          <SubscriptionUpgrade
            featureName="AI Workspace"
            onUpgrade={() => setShowUpgrade(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Workspace</h1>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={currentWorkspace?.id || ''}
            onValueChange={(value) => {
              const workspace = workspaces.find(w => w.id === value);
              if (workspace) setCurrentWorkspace(workspace);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map(workspace => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={saveWorkspace} disabled={!currentWorkspace}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create New</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Workspace title"
                  value={newWorkspaceTitle}
                  onChange={(e) => setNewWorkspaceTitle(e.target.value)}
                />
                <Button onClick={createWorkspace} className="w-full" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Workspace
                </Button>
              </div>
              
              {currentWorkspace && (
                <>
                  <hr />
                  <div className="space-y-3">
                    <p className="font-medium">Add Block</p>
                    <div className="space-y-2">
                      <Button 
                        onClick={() => addBlock('text')} 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Text
                      </Button>
                      <Button 
                        onClick={() => addBlock('heading')} 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                      >
                        <Hash className="h-4 w-4 mr-2" />
                        Heading
                      </Button>
                      <Button 
                        onClick={() => addBlock('list')} 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                      >
                        <List className="h-4 w-4 mr-2" />
                        List
                      </Button>
                      <Button 
                        onClick={() => addBlock('quote')} 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                      >
                        <Quote className="h-4 w-4 mr-2" />
                        Quote
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="font-medium">AI Content Generation</p>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Describe what you want to generate... (e.g., business plan, marketing strategy, project outline)"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          onClick={() => generateWithAI(aiPrompt || 'Create a business plan outline')}
                          disabled={isGenerating}
                          className="w-full"
                          size="sm"
                        >
                          <Brain className="h-4 w-4 mr-2" />
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>
                        <Button 
                          onClick={() => {
                            setAiPrompt('');
                            generateWithAI('Create a business plan outline');
                          }}
                          disabled={isGenerating}
                          variant="outline"
                          size="sm"
                        >
                          Quick Start
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Editor */}
        <div className="lg:col-span-3">
          {currentWorkspace ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {currentWorkspace.blocks
                    .sort((a, b) => a.order - b.order)
                    .map(block => (
                      <div key={block.id} className="group relative">
                        {renderBlock(block)}
                      </div>
                    ))
                  }
                  
                  {currentWorkspace.blocks.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4" />
                      <p>Start creating your workspace by adding blocks</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Workspace Selected</h3>
                <p className="text-muted-foreground mb-4">
                  Create a new workspace or select an existing one to start working
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWorkspace;