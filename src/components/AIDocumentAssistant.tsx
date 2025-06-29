
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { templateService } from '@/services/templateService';
import { aiDocumentService } from '@/services/aiDocumentService';
import { Template } from '@/types/template';
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

  const quickSuggestions = [
    "I need an NDA for a new partnership",
    "Help me find invoice templates for my startup",
    "What documents do I need for hiring employees?",
    "I'm starting a business, what's essential?",
    "Show me free legal templates",
    "I need comprehensive contracts"
  ];

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

  if (!isOpen) {
    return <AssistantFloatingButton onClick={() => setIsOpen(true)} />;
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
                <ChatMessage
                  key={message.id}
                  message={message}
                  onTemplateClick={handleTemplateClick}
                  onQuickActionClick={handleQuickAction}
                />
              ))}
              
              {isTyping && <TypingIndicator />}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {messages.length === 1 && (
            <QuickSuggestions
              suggestions={quickSuggestions}
              onSuggestionClick={setInputValue}
            />
          )}

          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            disabled={isTyping}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AIDocumentAssistant;
