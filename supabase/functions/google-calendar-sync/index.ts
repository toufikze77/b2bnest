import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { guardedDenoServeNarrow } from '../_shared/demo-guard.ts'; // Edge Functions CORS batch A (docs/hmrc-p7d/README.md): answers carry the narrowed CORS headers (corsFor), never '*'.
// Demo read-only: demo people get 403 (docs/demo-readonly)
import { PROVIDER, type EventLink, type SyncTask } from './plan.ts'
import { addCounts, emptyCounts, syncTask, syncUser, type Counts, type LinkStore } from './sync.ts'
import { googleApi } from './google.ts'
import { syncAllRefusal } from './secret.ts'
import { googleAccess, type Access, type StoredTokens } from './tokens.ts'
// Google Calendar sync (docs/google-calendar-sync/README.md): one all-day event per open task with a due date, kept in
// step through calendar_event_links (service role only). Actions:
//   sync_tasks              the signed-in person's tasks (the "Sync now" button)
//   sync_task (create_event) one task, after it was created, edited, completed or deleted in the app
//   forget_links            Google Calendar was disconnected: drop this person's links (their events are left alone)
//   sync_all                every connected person; only with the x-calendar-sync-secret header (pg_cron), never a sign-in

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-calendar-sync-secret',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const TASK_COLUMNS = 'id,title,description,due_date,priority,status,completed_at,archived_at'
/** sync_all stops starting new people after this long (the next run continues). */
const SYNC_ALL_BUDGET_MS = 100_000

guardedDenoServeNarrow()(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action ?? 'sync_tasks'

    // The catch-up: the server secret only (constant time). A person's sign-in is never enough.
    if (action === 'sync_all') {
      const refusal = syncAllRefusal(req, Deno.env.get('CALENDAR_SYNC_CRON_SECRET'), corsHeaders)
      if (refusal) return refusal
      return await syncAll()
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    // getUser(token): the supabase-js pinned above predates getClaims, which threw "is not a function".
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const user_id = userData.user.id

    if (action === 'sync_tasks') {
      return await syncTasksToCalendar(user_id)
    }

    if (action === 'sync_task' || action === 'create_event') {
      const task_id = typeof body.task_id === 'string' ? body.task_id : ''
      if (!/^[0-9a-f-]{36}$/i.test(task_id)) return json({ error: 'Missing task_id' }, 400)
      return await syncOneTask(user_id, task_id)
    }

    if (action === 'forget_links') {
      const { error } = await supabase.from('calendar_event_links').delete().eq('user_id', user_id).eq('provider', PROVIDER)
      if (error) {
        console.error('google-calendar-sync: forget_links failed', error.code)
        return json({ error: 'Failed to forget links' }, 500)
      }
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)

  } catch (error) {
    console.error('Calendar sync error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Internal server error' }, 500)
  }
})

/** The link rows of one person (service role). */
function linkStore(userId: string): LinkStore {
  return {
    async get(taskId) {
      const { data } = await supabase.from('calendar_event_links').select('task_id,external_event_id,content_hash')
        .eq('user_id', userId).eq('provider', PROVIDER).eq('task_id', taskId).maybeSingle()
      return (data as EventLink | null) ?? null
    },
    async all() {
      const { data, error } = await supabase.from('calendar_event_links').select('task_id,external_event_id,content_hash')
        .eq('user_id', userId).eq('provider', PROVIDER)
      if (error) throw new Error('links_unreadable')
      return (data ?? []) as EventLink[]
    },
    async save(link) {
      const { error } = await supabase.from('calendar_event_links').upsert(
        { user_id: userId, provider: PROVIDER, task_id: link.task_id, external_event_id: link.external_event_id, content_hash: link.content_hash, synced_at: new Date().toISOString() },
        { onConflict: 'user_id,task_id,provider' })
      // The task was deleted meanwhile (foreign key): nothing to keep.
      if (error && error.code !== '23503') console.error('google-calendar-sync: link not saved', error.code)
    },
    async remove(taskId) {
      await supabase.from('calendar_event_links').delete().eq('user_id', userId).eq('provider', PROVIDER).eq('task_id', taskId)
    },
  }
}

// Tokens: get_integration_tokens / store_integration_tokens (service role), not shared/token-refresh.ts, whose app-side
// key (ENCRYPTION_SECRET) can't read what the OAuth callback stores. Refresh: B2BNEST's own Google app.
const tokenDeps = {
  async readTokens(userId: string): Promise<StoredTokens | null> {
    const { data, error } = await supabase.rpc('get_integration_tokens', { p_integration_name: PROVIDER, p_user_id: userId })
    if (error) { console.error('google-calendar-sync: tokens unreadable', error.code); return null }
    const row = (Array.isArray(data) ? data[0] : data) as StoredTokens | undefined
    return row ?? null
  },
  async readMetadata(userId: string) {
    const { data } = await supabase.from('user_integrations').select('metadata').eq('user_id', userId).eq('integration_name', PROVIDER).maybeSingle()
    return (data as { metadata?: unknown } | null)?.metadata ?? null
  },
  async storeTokens(userId: string, t: { accessToken: string; refreshToken: string; expiresAt: string | null; metadata: Record<string, unknown> }) {
    const { error } = await supabase.rpc('store_integration_tokens', {
      p_integration_name: PROVIDER, p_access_token: t.accessToken, p_refresh_token: t.refreshToken,
      p_expires_at: t.expiresAt, p_metadata: t.metadata, p_user_id: userId,
    })
    if (error) console.error('google-calendar-sync: tokens not saved', error.code)
    return !error
  },
  async markDisconnected(userId: string) {
    // Only is_connected: the card then offers Connect again. The tokens stay until the person reconnects or disconnects.
    const { error } = await supabase.from('user_integrations').update({ is_connected: false }).eq('user_id', userId).eq('integration_name', PROVIDER)
    if (error) console.error('google-calendar-sync: could not mark Google Calendar as disconnected', error.code)
  },
  fetchFn: fetch,
  clientId: Deno.env.get('GOOGLE_CLIENT_ID'),
  clientSecret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
}

const RECONNECT = { error: 'Google Calendar needs to be reconnected', reconnect: true }

/** Google for one person, or the answer to give when it can't be used. */
async function googleFor(userId: string): Promise<{ google: ReturnType<typeof googleApi>; access: Extract<Access, { ok: true }> } | { refusal: Response; reason: string }> {
  const access = await googleAccess(userId, tokenDeps)
  if (!access.ok) {
    if (access.reason === 'reconnect') return { refusal: json(RECONNECT, 400), reason: access.reason }
    if (access.reason === 'not_connected') return { refusal: json({ error: 'Google Calendar not connected' }, 400), reason: access.reason }
    return { refusal: json({ error: 'Could not reach Google Calendar. Please try again.' }, 502), reason: access.reason }
  }
  return { google: googleApi({ token: access.token, userId, refresh: access.refresh }), access }
}

/** Open tasks with a due date of one person (the ones that should have an event). */
async function openTasks(userId: string): Promise<SyncTask[] | null> {
  const { data, error } = await supabase.from('todos').select(TASK_COLUMNS)
    .eq('user_id', userId).not('due_date', 'is', null).is('archived_at', null).is('completed_at', null).neq('status', 'done')
  if (error) {
    console.error('google-calendar-sync: tasks unreadable', error.code)
    return null
  }
  return (data ?? []) as SyncTask[]
}

const result = (c: Counts, extra: Record<string, unknown> = {}) => ({ success: true, ...c, ...extra })

async function syncTasksToCalendar(userId: string) {
  const g = await googleFor(userId)
  if ('refusal' in g) return g.refusal
  const tasks = await openTasks(userId)
  if (!tasks) return json({ error: 'Failed to fetch tasks' }, 500)
  try {
    const counts = await syncUser(tasks, userId, g.google, linkStore(userId))
    // Google rejected the refresh token during the run (a 401 then a failed refresh): ask for a reconnection.
    if (g.access.needsReconnect()) return json({ ...RECONNECT, ...counts }, 400)
    return json(result(counts))
  } catch {
    return json({ error: 'Failed to sync tasks' }, 500)
  }
}

async function syncOneTask(userId: string, taskId: string) {
  const g = await googleFor(userId)
  if ('refusal' in g) return g.refusal
  const { data, error } = await supabase.from('todos').select(TASK_COLUMNS).eq('id', taskId).eq('user_id', userId).maybeSingle()
  if (error) return json({ error: 'Failed to fetch task' }, 500)
  // Not found: deleted (or not this person's). Its event, if any, is found by its marker and removed.
  const counts = await syncTask(taskId, (data as SyncTask | null) ?? null, userId, g.google, linkStore(userId))
  if (g.access.needsReconnect()) return json({ ...RECONNECT, ...counts }, 400)
  return json(result(counts))
}

async function syncAll() {
  const started = Date.now()
  const { data: rows, error } = await supabase.from('user_integrations').select('user_id')
    .eq('integration_name', PROVIDER).eq('is_connected', true)
  if (error) return json({ error: 'Failed to list connections' }, 500)
  const users = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))]
  // Links of people who are no longer connected (a disconnect whose forget_links call was lost).
  const { data: stale } = await supabase.from('calendar_event_links').select('user_id').eq('provider', PROVIDER)
  const gone = [...new Set((stale ?? []).map((r: { user_id: string }) => r.user_id))].filter((u) => !users.includes(u))
  if (gone.length) await supabase.from('calendar_event_links').delete().eq('provider', PROVIDER).in('user_id', gone)

  let total = emptyCounts()
  let done = 0, skippedUsers = 0, reconnectUsers = 0
  for (const userId of users) {
    if (Date.now() - started > SYNC_ALL_BUDGET_MS) break
    const g = await googleFor(userId)
    if ('refusal' in g) { if (g.reason === 'reconnect') reconnectUsers++; else skippedUsers++; done++; continue }
    const tasks = await openTasks(userId)
    if (!tasks) { skippedUsers++; done++; continue }
    try {
      total = addCounts(total, await syncUser(tasks, userId, g.google, linkStore(userId)))
      if (g.access.needsReconnect()) reconnectUsers++
    } catch {
      total.failed++
    }
    done++
  }
  return json(result(total, { users: done, users_skipped: skippedUsers, users_need_reconnect: reconnectUsers, more: done < users.length, links_forgotten_for: gone.length }))
}
