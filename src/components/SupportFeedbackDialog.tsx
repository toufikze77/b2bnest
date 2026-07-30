import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Lightbulb, Smile, Bug, MessageCircleHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

type FeedbackKind = 'suggestion' | 'praise' | 'bug';

const OPTIONS: { key: FeedbackKind; label: string; icon: React.ElementType }[] = [
  { key: 'suggestion', label: 'I have a suggestion', icon: Lightbulb },
  { key: 'praise', label: 'I like something', icon: Smile },
  { key: 'bug', label: 'I found a bug', icon: Bug },
];

interface SupportFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SupportFeedbackDialog: React.FC<SupportFeedbackDialogProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setKind(null);
    setSubject('');
    setMessage('');
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to send feedback.',
        variant: 'destructive',
      });
      return;
    }
    if (!kind || !message.trim()) {
      toast({
        title: 'Almost there',
        description: 'Pick a category and tell us a bit more.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('feedback_requests').insert({
        user_id: user.id,
        type: kind === 'suggestion' ? 'feature_request' : 'feedback',
        title: subject.trim() || OPTIONS.find((o) => o.key === kind)!.label,
        description: message.trim(),
        category: kind === 'bug' ? 'Bug Report' : kind === 'suggestion' ? 'New Feature' : 'General',
        priority: kind === 'bug' ? 'high' : 'medium',
        status: 'open',
      });
      if (error) throw error;

      toast({ title: 'Thank you!', description: 'Your feedback has been sent to our team.' });
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error('Feedback submit error:', err);
      toast({
        title: 'Error',
        description: 'Could not send your feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleHeart className="h-5 w-5 text-primary" />
            Support &amp; Feedback
          </DialogTitle>
          <DialogDescription>We would love to hear your thoughts.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center text-sm transition-colors',
                'bg-muted/50 hover:bg-accent hover:text-accent-foreground',
                kind === key && 'border-primary bg-primary/10 text-primary'
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          <Input
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={100}
          />
          <Textarea
            placeholder="Tell us more..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !kind || !message.trim()}>
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupportFeedbackDialog;
