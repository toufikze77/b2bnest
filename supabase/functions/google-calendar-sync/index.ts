import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getValidToken } from '../shared/token-refresh.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { user_id, action = 'sync_tasks' } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'sync_tasks') {
      return await syncTasksToCalendar(user_id)
    }

    if (action === 'create_event') {
      const { task_id } = await req.json()
      return await createCalendarEvent(user_id, task_id)
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Calendar sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function syncTasksToCalendar(userId: string) {
  try {
    const token = await getValidToken(userId, 'google_calendar')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tasks with due dates that aren't completed
    const { data: tasks, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .not('due_date', 'is', null)

    if (error) {
      console.error('Error fetching tasks:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks with due dates found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []
    
    for (const task of tasks) {
      try {
        const event = await createEventFromTask(token, task)
        if (event) {
          results.push({ task_id: task.id, event_id: event.id, status: 'created' })
        }
      } catch (error) {
        console.error(`Error creating event for task ${task.id}:`, error)
        results.push({ task_id: task.id, status: 'error', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Synced ${results.filter(r => r.status === 'created').length} tasks to calendar`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error syncing tasks to calendar:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to sync tasks' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function createCalendarEvent(userId: string, taskId: string) {
  try {
    const token = await getValidToken(userId, 'google_calendar')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: task, error } = await supabase
      .from('todos')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single()

    if (error || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const event = await createEventFromTask(token, task)
    
    if (!event) {
      return new Response(
        JSON.stringify({ error: 'Failed to create calendar event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ event_id: event.id, message: 'Calendar event created' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating calendar event:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create event' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function createEventFromTask(token: string, task: any) {
  try {
    const dueDate = new Date(task.due_date)
    const startTime = new Date(dueDate.getTime() - (2 * 60 * 60 * 1000)) // 2 hours before due
    
    const eventData = {
      summary: `📋 ${task.title}`,
      description: task.description || 'Task reminder from Louvable',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: dueDate.toISOString(),
        timeZone: 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      colorId: task.priority === 'high' ? '11' : task.priority === 'medium' ? '5' : '2', // Red, Yellow, Green
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Google Calendar API error:', error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating event from task:', error)
    return null
  }
}