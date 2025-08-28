import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const PublicWorkRequest: React.FC = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'urgent'>('medium');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-work-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ title, description: desc, priority, requester_email: email })
      });
      if (!res.ok) throw new Error('Submission failed');
      const json = await res.json();
      toast({ title: 'Submitted', description: `Request ID ${json.id}` });
      setTitle(''); setDesc(''); setPriority('medium'); setEmail('');
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Submit a Work Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Your email (optional)" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <Textarea placeholder="Describe your request" value={desc} onChange={(e)=>setDesc(e.target.value)} />
          <Select value={priority} onValueChange={(v:any)=>setPriority(v)}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>{submitting ? 'Submitting...' : 'Submit'}</Button>
            <Button variant="outline" onClick={()=>{ setTitle(''); setDesc(''); setPriority('medium'); setEmail(''); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicWorkRequest;