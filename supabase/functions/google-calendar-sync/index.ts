import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getValidToken, refreshIntegrationToken } from '../shared/token-refresh.ts'
import { guardedDenoServeNarrow } from '../_shared/demo-guard.ts'; // Edge Functions CORS batch A (docs/hmrc-p7d/README.md): answers carry the narrowed CORS headers (corsFor), never '*'.
// Demo read-only: demo people get 403 (docs/demo-readonly)
import { PROVIDER, type EventLink, type SyncTask } from './plan.ts'
import { addCounts, emptyCounts, syncTask, syncUser, type Counts, type LinkStore } from './sync.ts'
import { googleApi } from './google.ts'
import { syncAllRefusal } from './secret.ts'
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

/** Google for one person, or null when Google Calendar isn't connected. */
async function googleFor(userId: string) {
  const token = await getValidToken(userId, PROVIDER)
  if (!token) return null
  return googleApi({ token, userId, refresh: () => refreshIntegrationToken(userId, 'google_calendar') })
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
  const google = await googleFor(userId)
  if (!google) return json({ error: 'Google Calendar not connected' }, 400)
  const tasks = await openTasks(userId)
  if (!tasks) return json({ error: 'Failed to fetch tasks' }, 500)
  try {
    return json(result(await syncUser(tasks, userId, google, linkStore(userId))))
  } catch {
    return json({ error: 'Failed to sync tasks' }, 500)
  }
}

async function syncOneTask(userId: string, taskId: string) {
  const google = await googleFor(userId)
  if (!google) return json({ error: 'Google Calendar not connected' }, 400)
  const { data, error } = await supabase.from('todos').select(TASK_COLUMNS).eq('id', taskId).eq('user_id', userId).maybeSingle()
  if (error) return json({ error: 'Failed to fetch task' }, 500)
  // Not found: deleted (or not this person's). Its event, if any, is found by its marker and removed.
  return json(result(await syncTask(taskId, (data as SyncTask | null) ?? null, userId, google, linkStore(userId))))
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
  let done = 0, skippedUsers = 0
  for (const userId of users) {
    if (Date.now() - started > SYNC_ALL_BUDGET_MS) break
    const google = await googleFor(userId)
    const tasks = google ? await openTasks(userId) : null
    if (!google || !tasks) { skippedUsers++; done++; continue }
    try {
      total = addCounts(total, await syncUser(tasks, userId, google, linkStore(userId)))
    } catch {
      total.failed++
    }
    done++
  }
  return json(result(total, { users: done, users_skipped: skippedUsers, more: done < users.length, links_forgotten_for: gone.length }))
}
