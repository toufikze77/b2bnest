import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, Users, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

interface ShareProjectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string; description?: string } | null;
}

interface TeamUser { id: string; display_name: string | null; full_name: string | null; email: string; }

const emailSchema = z.string().trim().email('Invalid email').max(255);
const messageSchema = z.string().trim().max(1000).optional();

const ShareProjectDialog: React.FC<ShareProjectDialogProps> = ({ isOpen, onOpenChange, project }) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<'in_platform' | 'email'>('in_platform');
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [recipientUserId, setRecipientUserId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, email')
        .eq('is_active', true)
        .order('display_name', { ascending: true })
        .limit(200);
      setUsers((data as TeamUser[]) || []);
    })();
  }, [isOpen]);

  const handleShare = async () => {
    if (!project) return;
    try {
      if (tab === 'email') {
        const parsed = emailSchema.safeParse(recipientEmail);
        if (!parsed.success) { toast({ title: 'Invalid email', description: parsed.error.errors[0].message, variant: 'destructive' }); return; }
      } else if (!recipientUserId) {
        toast({ title: 'Select a recipient', variant: 'destructive' }); return;
      }
      const msgParsed = messageSchema.safeParse(message || undefined);
      if (!msgParsed.success) { toast({ title: 'Message too long', variant: 'destructive' }); return; }

      setLoading(true);
      const shareUrl = `${window.location.origin}/project-management?project=${project.id}`;
      const { data, error } = await supabase.functions.invoke('share-project', {
        body: {
          projectId: project.id,
          projectName: project.name,
          projectDescription: project.description,
          method: tab,
          recipientUserId: tab === 'in_platform' ? recipientUserId : undefined,
          recipientEmail: tab === 'email' ? recipientEmail.trim() : undefined,
          message: message.trim() || undefined,
          shareUrl,
        },
      });
      if (error) throw error;
      toast({ title: 'Project shared', description: `Logged for data protection compliance.` });
      setRecipientEmail(''); setRecipientUserId(''); setMessage('');
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Share failed', description: e?.message || 'Try again', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Project{project ? `: ${project.name}` : ''}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <Shield className="w-3 h-3" /> Every share is logged (sender, recipient, time, IP) for GDPR compliance.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="in_platform"><Users className="w-4 h-4 mr-2" />In-platform</TabsTrigger>
            <TabsTrigger value="email"><Mail className="w-4 h-4 mr-2" />Email</TabsTrigger>
          </TabsList>

          <TabsContent value="in_platform" className="space-y-3 mt-4">
            <Label>Recipient</Label>
            <Select value={recipientUserId} onValueChange={setRecipientUserId}>
              <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name || u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="email" className="space-y-3 mt-4">
            <Label>Recipient email</Label>
            <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="name@example.com" />
          </TabsContent>
        </Tabs>

        <div className="space-y-2 mt-2">
          <Label>Message (optional)</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="Add a short note..." />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleShare} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareProjectDialog;
