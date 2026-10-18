import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, AlertCircle, AlertTriangle, Bell, CheckCheck, CheckCircle2, FileText, LifeBuoy, Loader2, Share2, Sparkles, type LucideIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { groupNotifications, isMissingColumnError, KIND_LABEL, notificationKind, safeInAppLink, type NotificationKind } from '@/lib/notifications';

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean | null;
  created_at: string | null;
  type?: string | null;
  link?: string | null;
}

export const PREVIEW_LIMIT = 20;
export const POLL_MS = 60_000;
// `read` is nullable; treat NULL as unread.
const UNREAD_FILTER = 'read.is.null,read.eq.false';
// `link` arrives with the Phase 7 database proposal; until then the bell reads the older columns.
const COLUMNS = 'id,title,message,read,created_at,type,link';
const FALLBACK_COLUMNS = 'id,title,message,read,created_at,type';

const KIND_ICON: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  invoice_overdue: { icon: AlertTriangle, tone: 'text-destructive' },
  invoice_paid: { icon: CheckCircle2, tone: 'text-success' },
  quote_update: { icon: FileText, tone: 'text-primary' },
  note_reminder: { icon: AlarmClock, tone: 'text-warning' },
  shared: { icon: Share2, tone: 'text-primary' },
  support: { icon: LifeBuoy, tone: 'text-primary' },
  welcome: { icon: Sparkles, tone: 'text-primary' },
  general: { icon: Bell, tone: 'text-muted-foreground' },
};

const ROW_CLASS = 'flex min-h-11 w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

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
  const hasLinkColumn = useRef(true);

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
    const fetchList = (cols: string) => supabase.from('notifications').select(cols)
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(PREVIEW_LIMIT);
    const [first, count] = await Promise.all([
      fetchList(hasLinkColumn.current ? COLUMNS : FALLBACK_COLUMNS),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).or(UNREAD_FILTER),
    ]);
    let list = first as { data: NotificationRow[] | null; error: { code?: string; message?: string } | null };
    if (list.error && hasLinkColumn.current && isMissingColumnError(list.error)) {
      hasLinkColumn.current = false;
      if (isStale(uid, seq)) return;
      list = (await fetchList(FALLBACK_COLUMNS)) as typeof list;
    }
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

  // Refresh when the window regains focus, and every minute while the page is visible. Hidden tabs do not poll.
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (timer === undefined) timer = setInterval(load, POLL_MS); };
    const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { load(); start(); } else stop();
    };
    if (document.visibilityState === 'visible') start();
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, load]);

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

  const renderRow = (n: NotificationRow) => {
    const kind = notificationKind(n.type);
    const { icon: Icon, tone } = KIND_ICON[kind];
    const href = safeInAppLink(n.link);
    const content = (
      <>
        <span className="relative mt-0.5 shrink-0">
          <Icon aria-hidden className={cn('h-4 w-4', tone)} />
          {!n.read && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-popover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-muted-foreground">{KIND_LABEL[kind]}</span>
          <span className={cn('block truncate text-sm text-foreground', n.read ? 'font-normal' : 'font-semibold')}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
          <span className="line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
          {n.created_at && <span className="mt-1 block text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>}
        </span>
      </>
    );
    const rowClass = cn(ROW_CLASS, !n.read && 'bg-accent/40');
    if (href) {
      return (
        <Link to={href} className={rowClass} onClick={() => { if (!n.read) markOne(n.id); setOpen(false); }}>
          {content}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => !n.read && markOne(n.id)} className={rowClass}>
        {content}
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 sm:h-10 sm:w-10" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
          <h2 className="text-sm font-semibold text-foreground">Notifications{unread > 0 && <span className="ml-1.5 font-normal text-muted-foreground">({unread} unread)</span>}</h2>
          <Button variant="ghost" size="sm" className="h-11 gap-1.5 text-xs" disabled={!unread || marking} onClick={markAll}>
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
          ) : error && items.length === 0 ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-foreground">Couldn't load notifications.</p>
              <Button variant="outline" size="sm" className="h-11" onClick={load}>Try again</Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Nothing needs your attention</p>
              <p className="text-xs text-muted-foreground">New notifications will appear here.</p>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="flex items-center justify-between gap-2 border-b border-border bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
                  <span className="flex items-center gap-2"><AlertCircle className="h-3.5 w-3.5 shrink-0" />Couldn't refresh. Showing the last list loaded.</span>
                  <Button variant="ghost" size="sm" className="h-11 shrink-0 text-xs" onClick={load}>Try again</Button>
                </div>
              )}
              {groupNotifications(items).map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="bg-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                  <ul className="divide-y divide-border">
                    {group.items.map((n) => <li key={n.id}>{renderRow(n)}</li>)}
                  </ul>
                </section>
              ))}
            </>
          )}
        </ScrollArea>
        <div className="border-t border-border px-4 py-1">
          <Link to="/settings?tab=notifications" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Notification preferences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
