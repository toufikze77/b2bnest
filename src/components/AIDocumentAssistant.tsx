
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, FileText, X, MessageCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { templateService } from '@/services/templateService';
import { aiDocumentService } from '@/services/aiDocumentService';
import { Template } from '@/types/template';

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI Document Assistant powered by advanced AI. I can help you find the perfect business documents, explain legal requirements, and provide personalized recommendations. What type of document do you need help with today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = async (userInput: string): Promise<{ content: string; templates: Template[]; quickActions: string[] }> => {
    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

    // Use AI service to analyze intent and get recommendations
    const intent = aiDocumentService.analyzeIntent(userInput);
    const templates = aiDocumentService.getPersonalizedRecommendations(intent, 4);
    const content = aiDocumentService.generateContextualResponse(userInput, templates);
    const quickActions = aiDocumentService.getQuickActions(templates);

    // Fallback to search if AI service doesn't find good matches
    let finalTemplates = templates;
    if (templates.length === 0) {
      finalTemplates = templateService.searchTemplates(userInput).slice(0, 3);
    }

    return { content, templates: finalTemplates, quickActions };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString() + '_user',
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const { content, templates, quickActions } = await generateAIResponse(inputValue);
      
      const assistantMessage: Message = {
        id: Date.now().toString() + '_assistant',
        type: 'assistant',
        content,
        templates,
        quickActions,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString() + '_error',
        type: 'assistant',
        content: "I apologize, but I'm having trouble processing your request right now. Please try again, or browse our template categories to find what you need.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTemplateClick = (template: Template) => {
    onTemplateSelect?.(template);
    
    const confirmMessage: Message = {
      id: Date.now().toString() + '_confirm',
      type: 'assistant',
      content: `Great choice! "${template.title}" is an excellent template. It's ${template.difficulty.toLowerCase()} level and ${template.price === 0 ? 'completely free' : `priced at $${template.price}`}. You can preview it or download it directly. Would you like me to suggest any complementary documents that often go with this one?`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
  };

  const quickSuggestions = [
    "I need an NDA for a new partnership",
    "Help me find invoice templates for my startup",
    "What documents do I need for hiring employees?",
    "I'm starting a business, what's essential?",
    "Show me free legal templates",
    "I need comprehensive contracts"
  ];

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
          size="lg"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-12 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity">
          AI Assistant
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] flex flex-col">
      <Card className="flex-1 flex flex-col shadow-2xl border-2">
        <CardHeader className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Document Assistant</CardTitle>
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
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : 'bg-gray-50 text-gray-900 border'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.type === 'assistant' && (
                        <div className="p-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        
                        {message.templates && message.templates.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.templates.map((template) => (
                              <div
                                key={template.id}
                                className="p-3 bg-white rounded-lg border cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200"
                                onClick={() => handleTemplateClick(template)}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium text-sm text-gray-900">
                                    {template.title}
                                  </span>
                                  {template.featured && (
                                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                      Featured
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mb-2">
                                  {template.description.substring(0, 100)}...
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {template.category.name}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {template.difficulty}
                                    </Badge>
                                  </div>
                                  <span className="text-sm font-semibold text-green-600">
                                    {template.price === 0 ? 'Free' : `$${template.price}`}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {message.quickActions && message.quickActions.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-600 mb-2">Quick actions:</p>
                            <div className="flex flex-wrap gap-1">
                              {message.quickActions.map((action, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleQuickAction(action)}
                                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-1 hover:bg-blue-100 transition-colors"
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-gray-500">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {messages.length === 1 && (
            <div className="p-4 border-t bg-gradient-to-r from-blue-50 to-purple-50">
              <p className="text-xs text-gray-600 mb-2 font-medium">Try asking me:</p>
              <div className="grid grid-cols-1 gap-1">
                {quickSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(suggestion)}
                    className="text-xs bg-white border rounded-lg px-3 py-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-300 transition-all duration-200 text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about business documents..."
                className="flex-1 border-gray-300 focus:border-blue-500"
                disabled={isTyping}
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                disabled={!inputValue.trim() || isTyping}
                className="px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              AI Assistant • Always learning, always helping
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIDocumentAssistant;
