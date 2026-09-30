import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bell, CheckCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean | null;
  created_at: string | null;
}

/** Reads only the signed-in user's notifications; RLS enforces auth.uid() = user_id for select and update. */
export function NotificationsPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('notifications')
      .select('id,title,message,read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (err) setError(true);
    else setItems(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    const { error: err } = await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', user.id);
    if (err) load();
  };

  const markAll = async () => {
    setMarking(true);
    await markRead(items.filter((n) => !n.read).map((n) => n.id));
    setMarking(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" disabled={!unread || marking} onClick={markAll}>
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[60vh]">
          {loading && items.length === 0 ? (
            <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-foreground">Couldn't load notifications.</p>
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground">New notifications will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => !n.read && markRead([n.id])}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none', !n.read && 'bg-accent/40')}
                  >
                    <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                      <span className="line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
                      {n.created_at && <span className="mt-1 block text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border px-4 py-2.5">
          <Link to="/settings?tab=notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
            Notification preferences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
