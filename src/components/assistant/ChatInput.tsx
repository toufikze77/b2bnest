
import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

const ChatInput = ({ value, onChange, onSend, disabled }: ChatInputProps) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 bg-background">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask a question about B2BNEST"
          aria-label="Your question"
          className="flex-1 border-gray-300 focus:border-blue-500"
          disabled={disabled}
        />
        <Button
          onClick={onSend}
          size="sm"
          aria-label="Send"
          disabled={!value.trim() || disabled}
          className="px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Fixed answers to common questions. Not an AI.
      </p>
    </div>
  );
};

export default ChatInput;
