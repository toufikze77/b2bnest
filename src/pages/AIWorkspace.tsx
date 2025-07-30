import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Brain, 
  Save, 
  FileText, 
  Image, 
  List, 
  Hash, 
  Quote, 
  Download, 
  Copy, 
  Trash2, 
  FolderOpen 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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
      setHasUnsavedChanges(false);
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
      .from('ai_workspaces')
      .insert(newWorkspace)
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  const deleteBlock = (blockId: string) => {
    if (!currentWorkspace) return;

    const updatedWorkspace = {
      ...currentWorkspace,
      blocks: currentWorkspace.blocks.filter(block => block.id !== blockId)
    };

    setCurrentWorkspace(updatedWorkspace);
    setHasUnsavedChanges(true);
  };

  const saveWorkspace = async () => {
    if (!currentWorkspace || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('ai_workspaces')
        .update({
          title: currentWorkspace.title,
          blocks: currentWorkspace.blocks as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentWorkspace.id);

      if (error) {
        console.error('Error saving workspace:', error);
        toast.error('Failed to save workspace');
        return;
      }

      setHasUnsavedChanges(false);
      toast.success('Workspace saved successfully!');
      loadWorkspaces();
    } catch (err) {
      console.error('Exception saving workspace:', err);
      toast.error('Failed to save workspace');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadWorkspace = () => {
    if (!currentWorkspace) return;

    const dataStr = JSON.stringify(currentWorkspace, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${currentWorkspace.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_workspace.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast.success('Workspace downloaded successfully!');
  };

  const duplicateWorkspace = async () => {
    if (!currentWorkspace || !user) return;

    try {
      const { data, error } = await supabase
        .from('ai_workspaces')
        .insert({
          user_id: user.id,
          title: `${currentWorkspace.title} (Copy)`,
          blocks: currentWorkspace.blocks as any
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Workspace duplicated successfully!');
      loadWorkspaces();
      setCurrentWorkspace(data as unknown as Workspace);
    } catch (error) {
      console.error('Error duplicating workspace:', error);
      toast.error('Failed to duplicate workspace');
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('ai_workspaces')
        .delete()
        .eq('id', workspaceId);

      if (error) throw error;

      toast.success('Workspace deleted successfully!');
      loadWorkspaces();
      
      // If we deleted the current workspace, clear it
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(null);
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error('Failed to delete workspace');
    }
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
      setHasUnsavedChanges(true);
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
      {/* Header with Workspace Management */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">AI Workspace</h1>
            <p className="text-muted-foreground">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Workspace Selector */}
          <Select
            value={currentWorkspace?.id || ''}
            onValueChange={(value) => {
              const workspace = workspaces.find(w => w.id === value);
              if (workspace) {
                setCurrentWorkspace(workspace);
                setHasUnsavedChanges(false);
              }
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.length === 0 ? (
                <SelectItem value="empty" disabled>
                  No workspaces found - create one below
                </SelectItem>
              ) : (
                workspaces.map(workspace => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{workspace.title}</span>
                      <Badge variant="outline" className="ml-2">
                        {workspace.blocks.length} blocks
                      </Badge>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Workspace Actions */}
          {currentWorkspace && (
            <>
              <Button 
                onClick={saveWorkspace} 
                disabled={!currentWorkspace || isSaving || !hasUnsavedChanges}
                variant={hasUnsavedChanges ? "default" : "outline"}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save*' : 'Saved'}
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Workspace Actions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={downloadWorkspace}
                        variant="outline" 
                        size="sm"
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button 
                        onClick={duplicateWorkspace}
                        variant="outline" 
                        size="sm"
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </Button>
                    </div>
                    <Button 
                      onClick={() => deleteWorkspace(currentWorkspace.id)}
                      variant="destructive" 
                      size="sm"
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Workspace
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Workspace Info Card */}
      {workspaces.length > 0 && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    Your Saved Workspaces
                  </span>
                </div>
                <Badge variant="secondary">
                  {workspaces.length} total
                </Badge>
              </div>
              <div className="text-sm text-blue-700">
                {currentWorkspace ? (
                  <span>
                    Current: <strong>{currentWorkspace.title}</strong> • 
                    {currentWorkspace.blocks.length} blocks • 
                    Last updated: {new Date(currentWorkspace.updated_at).toLocaleDateString()}
                  </span>
                ) : (
                  'Select a workspace to continue'
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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