
import React from 'react';
import { Bot } from 'lucide-react';

const TypingIndicator = () => {
  return (
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
  );
};

export default TypingIndicator;
