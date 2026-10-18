import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import ChatInput from './assistant/ChatInput';
import ChatMessage from './assistant/ChatMessage';
import { answerQuestion, HELP_LINK, CONTACT_LINK, HELP_TOPICS, type HelpLink } from '@/lib/helpAssistant';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  links?: HelpLink[];
  quickActions?: string[];
  timestamp: Date;
}

interface AIDocumentAssistantProps {
  /** Kept for the homepage's existing prop; this assistant does not suggest templates. */
  onTemplateSelect?: (template: unknown) => void;
}

const WELCOME: Message = {
  id: 'welcome',
  type: 'assistant',
  content:
    "Hello. I'm the B2BNEST help assistant. I answer common questions about what B2BNEST does, plans and prices, " +
    "getting started and where to get help. I'm not an AI: if I don't know something, I'll say so and point you to the Help page.",
  links: [HELP_LINK, CONTACT_LINK],
  quickActions: HELP_TOPICS.map((t) => t.question),
  timestamp: new Date(),
};

/** Homepage help assistant: a keyword-based helper (not an AI). Answers come from src/lib/helpAssistant.ts. */
const AIDocumentAssistant = (_props: AIDocumentAssistantProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const ask = (messageText?: string) => {
    const text = (messageText ?? inputValue).trim();
    if (!text) return;
    const answer = answerQuestion(text);
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `${now}_user`, type: 'user', content: text, timestamp: new Date() },
      { id: `${now}_assistant`, type: 'assistant', content: answer.text, links: answer.links, quickActions: answer.suggestions, timestamp: new Date() },
    ]);
    setInputValue('');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open the help assistant"
        className="fixed bottom-4 right-4 z-50 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring sm:bottom-6 sm:right-6"
      >
        <HelpCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Help assistant"
      className="fixed bottom-4 right-4 z-50 flex h-[min(650px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-96 flex-col sm:bottom-6 sm:right-6"
    >
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex-shrink-0 rounded-t-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white/20 p-2">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Help assistant</h2>
                <p className="text-sm text-blue-100">Answers to common questions. Not an AI.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close the help assistant"
              className="inline-flex h-11 w-11 items-center justify-center rounded text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onQuickActionClick={ask} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 border-t border-border">
          <ChatInput value={inputValue} onChange={setInputValue} onSend={() => ask()} />
        </div>
      </div>
    </div>
  );
};

export default AIDocumentAssistant;
