import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ProfileEditDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setEmail(user.email || '');
    supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.full_name || data?.display_name || ''));
  }, [open, user]);

  const save = async () => {
    if (!user) return;
    const trimmed = name.trim();
    const newEmail = email.trim().toLowerCase();
    if (!trimmed) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: trimmed, display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: trimmed } });

      let emailMsg = '';
      if (newEmail && newEmail !== (user.email || '').toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
        if (emailErr) throw emailErr;
        emailMsg = ' Check both inboxes to confirm the new email address.';
      }
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: { userId: user.id, name: trimmed } }));
      toast({ title: 'Profile updated', description: `Your details were saved.${emailMsg}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update the name and email shown on your account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="profile-email">Email address</Label>
            <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
