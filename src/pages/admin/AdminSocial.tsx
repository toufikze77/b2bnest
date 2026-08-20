import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { adminRpc, logAdminAction } from '@/lib/adminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessagesSquare, Heart, MessageCircle, Users } from 'lucide-react';

export default function AdminSocial() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminRpc<any>('admin_social_stats', { _limit: 20 }));
    } catch (e: any) {
      toast({ title: 'Failed to load community stats', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (postId: string, hide: boolean) => {
    setBusy(postId);
    try {
      await adminRpc('admin_moderate_post', { _post_id: postId, _hide: hide });
      await logAdminAction(hide ? 'social.hide_post' : 'social.restore_post', 'social_posts', postId);
      toast({ title: hide ? 'Post hidden' : 'Post restored' });
      await load();
    } catch (e: any) {
      toast({ title: 'Moderation failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Social / Community"
        description="Community activity and moderation controls."
        actions={<Button variant="outline" size="sm" onClick={load}>Refresh</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total posts" value={Number(data?.total_posts ?? 0).toLocaleString()} icon={<MessagesSquare className="h-4 w-4" />} hint={`${Number(data?.posts_today ?? 0)} today`} />
        <AdminStatCard label="Comments" value={Number(data?.comments ?? 0).toLocaleString()} icon={<MessageCircle className="h-4 w-4" />} />
        <AdminStatCard label="Likes" value={Number(data?.likes ?? 0).toLocaleString()} icon={<Heart className="h-4 w-4" />} />
        <AdminStatCard label="Active authors (30d)" value={Number(data?.active_authors ?? 0).toLocaleString()} icon={<Users className="h-4 w-4" />} hint={`${Number(data?.forum_posts ?? 0)} forum posts`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent posts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(data?.recent_posts ?? []).length === 0 && <p className="text-sm text-muted-foreground">No posts</p>}
            {(data?.recent_posts ?? []).map((p: any) => (
              <div key={p.id} className="rounded-lg border border-border/60 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{p.author || 'Unknown'}</span>
                  <span>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</span>
                  {!p.is_public && <Badge variant="secondary">Hidden</Badge>}
                </div>
                <p className="text-sm">{p.content || '—'}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{Number(p.like_count ?? 0)} likes</span>
                  <span>{Number(p.comment_count ?? 0)} comments</span>
                  <Button
                    size="sm"
                    variant={p.is_public ? 'outline' : 'secondary'}
                    disabled={busy === p.id}
                    onClick={() => moderate(p.id, !!p.is_public)}
                  >
                    {p.is_public ? 'Hide post' : 'Restore post'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top authors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.top_authors ?? []).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
            {(data?.top_authors ?? []).map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">{a.author || 'Unknown'}</span>
                <span className="tabular-nums text-muted-foreground">{Number(a.posts)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
