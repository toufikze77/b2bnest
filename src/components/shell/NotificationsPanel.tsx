import { useCallback, useEffect, useRef, useState } from 'react';
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

export const PREVIEW_LIMIT = 20;
// `read` is nullable; treat NULL as unread.
const UNREAD_FILTER = 'read.is.null,read.eq.false';

/** Reads only the signed-in user's notifications; RLS enforces auth.uid() = user_id for select and update. */
export function NotificationsPanel() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  // Guards against responses from an earlier user or an older request.
  const currentUser = useRef<string | null>(userId);
  const requestSeq = useRef(0);

  // Clear immediately on sign-out or user change.
  useEffect(() => {
    currentUser.current = userId;
    requestSeq.current += 1;
    setItems([]);
    setUnread(0);
    setError(false);
    setMarkError(null);
    setLoading(false);
    setMarking(false);
    if (!userId) setOpen(false);
  }, [userId]);

  const isStale = (uid: string, seq: number) => currentUser.current !== uid || requestSeq.current !== seq;

  const load = useCallback(async () => {
    if (!userId) return;
    const uid = userId;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    const [list, count] = await Promise.all([
      supabase.from('notifications').select('id,title,message,read,created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(PREVIEW_LIMIT),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).or(UNREAD_FILTER),
    ]);
    if (isStale(uid, seq)) return;
    if (list.error || count.error) {
      setError(true);
    } else {
      setItems(list.data ?? []);
      setUnread(count.count ?? 0);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const markOne = async (id: string) => {
    if (!userId) return;
    const uid = userId;
    setMarkError(null);
    const { error: err } = await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', uid);
    if (currentUser.current !== uid) return;
    if (err) { setMarkError("Couldn't mark this notification as read. Please try again."); return; }
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
  };

  const markAll = async () => {
    if (!userId) return;
    const uid = userId;
    setMarking(true);
    setMarkError(null);
    // Updates every unread row for this user, not just the visible preview.
    const { error: err } = await supabase.from('notifications').update({ read: true }).eq('user_id', uid).or(UNREAD_FILTER);
    if (currentUser.current !== uid) return;
    setMarking(false);
    if (err) { setMarkError("Couldn't mark notifications as read. Please try again."); return; }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Notifications{unread > 0 && <span className="ml-1.5 font-normal text-muted-foreground">({unread} unread)</span>}</h2>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" disabled={!unread || marking} onClick={markAll}>
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </Button>
        </div>
        {markError && (
          <div role="alert" className="flex items-start gap-2 border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{markError}
          </div>
        )}
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
                    onClick={() => !n.read && markOne(n.id)}
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
