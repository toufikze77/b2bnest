import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  links?: { label: string; to: string }[];
  quickActions?: string[];
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  onQuickActionClick: (action: string) => void;
}

const ChatMessage = ({ message, onQuickActionClick }: ChatMessageProps) => {
  return (
    <div data-from={message.type} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          message.type === 'user'
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
            : 'border border-border bg-muted text-foreground'
        }`}
      >
        <div className="flex items-start gap-2">
          {message.type === 'assistant' && (
            <div className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 p-1">
              <HelpCircle aria-hidden className="h-3 w-3 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-line text-sm leading-relaxed">{message.content}</p>

            {message.links && message.links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {message.quickActions && message.quickActions.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-muted-foreground">You can ask:</p>
                <div className="flex flex-wrap gap-1">
                  {message.quickActions.map((action) => (
                    <button
                      type="button"
                      key={action}
                      onClick={() => onQuickActionClick(action)}
                      className="min-h-11 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
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
