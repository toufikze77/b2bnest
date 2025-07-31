
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Zap, MessageSquare, Settings, TrendingUp, FileText, Users, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { templateService } from '@/services/templateService';
import { aiPlatformService } from '@/services/aiPlatformService';
import { Template } from '@/types/template';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from './assistant/ChatMessage';
import TypingIndicator from './assistant/TypingIndicator';
import QuickSuggestions from './assistant/QuickSuggestions';
import ChatInput from './assistant/ChatInput';
import AssistantFloatingButton from './assistant/AssistantFloatingButton';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  templates?: Template[];
  quickActions?: string[];
  timestamp: Date;
}

interface AIDocumentAssistantProps {
  onTemplateSelect?: (template: Template) => void;
}

const AIDocumentAssistant = ({ onTemplateSelect }: AIDocumentAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [currentCategory, setCurrentCategory] = useState('General');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI Business Assistant. I can help you with CRM, project management, financial tools, trading analytics, and document generation. Choose a category below or ask me anything!",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const categories = [
    { id: 'CRM', name: 'CRM', icon: Users, description: 'Customer & Sales Management' },
    { id: 'Project Management', name: 'Projects', icon: Settings, description: 'Task & Team Management' },
    { id: 'Finance', name: 'Finance', icon: Calculator, description: 'Invoicing & Analytics' },
    { id: 'Trading', name: 'Trading', icon: TrendingUp, description: 'Market & Portfolio Analysis' },
    { id: 'Documents', name: 'Documents', icon: FileText, description: 'Templates & Legal Forms' },
    { id: 'General', name: 'General', icon: MessageSquare, description: 'Platform Overview' }
  ];

  const quickQuestions = {
    'CRM': [
      "How do I add my first customer contact?",
      "Show me how to track sales deals",
      "What CRM analytics are available?",
      "Help me organize my customer data"
    ],
    'Project Management': [
      "How do I create my first project?",
      "Show me task management features",
      "How can my team collaborate better?",
      "What project tracking tools exist?"
    ],
    'Finance': [
      "How do I generate my first invoice?",
      "Show me ROI calculation tools",
      "Help me track business expenses",
      "What financial reports can I create?"
    ],
    'Trading': [
      "Show me market analysis features",
      "How do I track my investment portfolio?",
      "What trading tools are available?",
      "Help me understand market trends"
    ],
    'Documents': [
      "Show me business document templates",
      "How do I create legal contracts?",
      "What compliance forms are available?",
      "Help me generate professional documents"
    ],
    'General': [
      "What's the best way to get started?",
      "Show me the most popular features",
      "How do platform tools work together?",
      "What integrations are available?"
    ]
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const callAIAssistant = async (message: string, category: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to use the AI assistant');
      }

      const response = await supabase.functions.invoke('ai-business-assistant', {
        body: {
          message,
          category,
          context: `Platform assistance for ${category} category`
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (error) {
      console.error('AI Assistant Error:', error);
      return {
        response: "I'm having trouble connecting right now. Please try again or contact support.",
        suggestions: quickQuestions[category as keyof typeof quickQuestions] || [],
        quickActions: []
      };
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const message = messageText || inputValue.trim();
    if (!message) return;

    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const { response, suggestions, quickActions } = await callAIAssistant(message, currentCategory);
      
      const assistantMessage: Message = {
        id: Date.now().toString() + '_assistant',
        type: 'assistant',
        content: response,
        quickActions: quickActions || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString() + '_error',
        type: 'assistant',
        content: "I apologize, but I'm having trouble processing your request right now. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setCurrentCategory(categoryId);
    const category = categories.find(c => c.id === categoryId);
    
    const welcomeMessage: Message = {
      id: Date.now().toString() + '_category',
      type: 'assistant',
      content: `Great! I'm here to help you with ${category?.name}. ${category?.description}. Here are some things I can help you with:`,
      quickActions: quickQuestions[categoryId as keyof typeof quickQuestions]?.slice(0, 3) || [],
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, welcomeMessage]);
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  if (!isOpen) {
    return <AssistantFloatingButton onClick={() => setIsOpen(true)} />;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[650px] flex flex-col">
      <Card className="flex-1 flex flex-col shadow-2xl border-2">
        <CardHeader className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white rounded-t-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Business Assistant</CardTitle>
                <div className="flex items-center gap-1 text-sm text-blue-100">
                  <Zap className="h-3 w-3" />
                  <span>Powered by Advanced AI</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 m-2">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
              <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
                <Badge variant="secondary" className="flex items-center gap-1">
                  {categories.find(c => c.id === currentCategory)?.icon && 
                    React.createElement(categories.find(c => c.id === currentCategory)!.icon, { className: "h-3 w-3" })
                  }
                  {currentCategory}
                </Badge>
                <span className="text-xs text-gray-600">Active Category</span>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      onTemplateClick={onTemplateSelect}
                      onQuickActionClick={handleQuickQuestion}
                    />
                  ))}
                  
                  {isTyping && <TypingIndicator />}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>

              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={() => handleSendMessage()}
                disabled={isTyping}
              />
            </TabsContent>
            
            <TabsContent value="categories" className="flex-1 flex flex-col mt-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 mb-3">Choose a Category</h3>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={currentCategory === category.id ? "default" : "outline"}
                      className="w-full h-auto p-4 flex flex-col items-start gap-2"
                      onClick={() => {
                        handleCategorySelect(category.id);
                        setActiveTab('chat');
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <category.icon className="h-5 w-5" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <span className="text-xs text-left opacity-70">{category.description}</span>
                    </Button>
                  ))}
                  
                  <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Quick Questions</h4>
                    <div className="space-y-2">
                      {quickQuestions[currentCategory as keyof typeof quickQuestions]?.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            handleQuickQuestion(question);
                            setActiveTab('chat');
                          }}
                          className="w-full text-left text-xs bg-white border rounded p-2 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIDocumentAssistant;
