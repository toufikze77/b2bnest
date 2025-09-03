import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useCommentCount } from '@/hooks/useCommentCount';

interface CommentButtonProps {
  taskId: string;
  onOpenComments: () => void;
}

export const CommentButton: React.FC<CommentButtonProps> = ({ taskId, onOpenComments }) => {
  const commentCount = useCommentCount(taskId);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-blue-50 hover:text-blue-600"
      onClick={(e) => {
        e.stopPropagation();
        onOpenComments();
      }}
      title="View Comments"
    >
      <MessageCircle className="w-3 h-3 mr-1" />
      {commentCount > 0 && commentCount}
    </Button>
  );
};