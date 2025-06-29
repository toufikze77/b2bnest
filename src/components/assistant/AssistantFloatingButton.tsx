
import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AssistantFloatingButtonProps {
  onClick: () => void;
}

const AssistantFloatingButton = ({ onClick }: AssistantFloatingButtonProps) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={onClick}
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
};

export default AssistantFloatingButton;
