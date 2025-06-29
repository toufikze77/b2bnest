
import React from 'react';
import { Bot, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Template } from '@/types/template';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  templates?: Template[];
  quickActions?: string[];
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  onTemplateClick: (template: Template) => void;
  onQuickActionClick: (action: string) => void;
}

const ChatMessage = ({ message, onTemplateClick, onQuickActionClick }: ChatMessageProps) => {
  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                    onClick={() => onTemplateClick(template)}
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
                      onClick={() => onQuickActionClick(action)}
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
  );
};

export default ChatMessage;
