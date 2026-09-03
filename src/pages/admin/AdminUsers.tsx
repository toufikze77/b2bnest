import { useCallback, useEffect, useState } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { adminRpc, downloadCsv, logAdminAction } from '@/lib/adminApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';

const PAGE_SIZE = 25;
const ROLES = ['user', 'manager', 'moderator', 'admin', 'owner', 'super_admin'];
const PLANS = ['all', 'starter', 'professional', 'enterprise', 'free'];

export default function AdminUsers() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [pendingAction, setPendingAction] = useState<{ user: any; suspend: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminRpc<any>('admin_list_users', {
        _search: search || null,
        _status: status,
        _plan: plan,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      setRows(data.rows ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e: any) {
      toast({ title: 'Failed to load users', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, status, plan, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const applyStatus = async () => {
    if (!pendingAction) return;
    try {
      await adminRpc('admin_set_user_status', { _user_id: pendingAction.user.id, _active: !pendingAction.suspend });
      toast({ title: pendingAction.suspend ? 'Account suspended' : 'Account reactivated' });
      setPendingAction(null);
      load();
    } catch (e: any) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    }
  };

  const changeRole = async (user: any, role: string) => {
    try {
      await adminRpc('admin_set_user_role', { _user_id: user.id, _role: role });
      toast({ title: 'Role updated', description: `${user.email} is now ${role}` });
      load();
    } catch (e: any) {
      toast({ title: 'Role change failed', description: e.message, variant: 'destructive' });
    }
  };

  const exportCsv = async () => {
    const data = await adminRpc<any>('admin_list_users', { _search: search || null, _status: status, _limit: 5000, _offset: 0 });
    downloadCsv('b2bnest-users.csv', data.rows ?? []);
    await logAdminAction('export.users', 'users', null, { count: (data.rows ?? []).length });
  };

  return (
    <>
      <AdminPageHeader
        title="User Management"
        description="Search, review and manage B2BNest accounts. Suspension is reversible — no data is destroyed."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email or company"
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(0);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['all', 'active', 'suspended', 'paid', 'free', 'trial'].map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No data</TableCell></TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelected(u)}>
                  <TableCell>
                    <div className="font-medium">{u.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>{u.company || '—'}</TableCell>
                  <TableCell>{u.subscribed ? <Badge>{u.plan || 'Paid'}</Badge> : <Badge variant="secondary">{u.is_trial_active ? 'Trial' : 'Free'}</Badge>}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={u.role || 'user'} onValueChange={(v) => changeRole(u, v)}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    {u.is_active ? <Badge variant="outline" className="text-emerald-500">Active</Badge> : <Badge variant="destructive">Suspended</Badge>}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant={u.is_active ? 'outline' : 'default'}
                      onClick={() => setPendingAction({ user: u, suspend: !!u.is_active })}
                    >
                      {u.is_active ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} users</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>{selected?.name || selected?.email}</SheetTitle></SheetHeader>
          {selected && (
            <dl className="mt-6 space-y-3 text-sm">
              {[
                ['Email', selected.email],
                ['Company', selected.company || '—'],
                ['Role', selected.role || 'user'],
                ['Registered', selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'],
                ['Status', selected.is_active ? 'Active' : 'Suspended'],
                ['Subscription', selected.subscribed ? selected.plan || 'Paid' : selected.is_trial_active ? 'Trial' : 'Free'],
                ['Trial ends', selected.trial_ends_at ? new Date(selected.trial_ends_at).toLocaleDateString() : '—'],
                ['Projects', selected.projects ?? 0],
                ['Documents', selected.documents ?? 0],
                ['AI usage', selected.ai_usage ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.suspend ? 'Suspend this account?' : 'Reactivate this account?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.suspend
                ? 'The user will lose access to B2BNest. Their data is preserved and the action can be reversed.'
                : 'The user will regain access to B2BNest.'}
              {' '}This action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyStatus}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
