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
    const { user_id, action = 'sync_tasks', database_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'list_databases') {
      return await listNotionDatabases(user_id)
    }

    if (action === 'sync_tasks') {
      if (!database_id) {
        return new Response(
          JSON.stringify({ error: 'database_id is required for sync_tasks' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return await syncTasksToNotion(user_id, database_id)
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Notion sync error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function listNotionDatabases(userId: string) {
  try {
    const token = await getValidToken(userId, 'notion')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Notion not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: {
          value: 'database',
          property: 'object',
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Notion API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch databases' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const databases = data.results.map((db: any) => ({
      id: db.id,
      title: db.title?.map((t: any) => t.plain_text).join('') || 'Untitled',
      url: db.url,
    }))

    return new Response(
      JSON.stringify({ databases }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error listing Notion databases:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list databases' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function syncTasksToNotion(userId: string, databaseId: string) {
  try {
    const token = await getValidToken(userId, 'notion')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Notion not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tasks that haven't been synced to Notion yet
    const { data: tasks, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'completed')

    if (error) {
      console.error('Error fetching tasks:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tasks to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    for (const task of tasks) {
      try {
        const page = await createNotionPage(token, databaseId, task)
        if (page) {
          results.push({ task_id: task.id, page_id: page.id, status: 'created' })
        }
      } catch (error) {
        console.error(`Error creating Notion page for task ${task.id}:`, error)
        results.push({ task_id: task.id, status: 'error', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Synced ${results.filter(r => r.status === 'created').length} tasks to Notion`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error syncing tasks to Notion:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to sync tasks' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function createNotionPage(token: string, databaseId: string, task: any) {
  try {
    const pageData = {
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: task.title,
              },
            },
          ],
        },
        Status: {
          select: {
            name: task.status === 'todo' ? 'To Do' : task.status === 'in_progress' ? 'In Progress' : 'Done',
          },
        },
        Priority: {
          select: {
            name: task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low',
          },
        },
        ...(task.due_date && {
          'Due Date': {
            date: {
              start: task.due_date,
            },
          },
        }),
      },
      children: task.description ? [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: task.description,
                },
              },
            ],
          },
        },
      ] : [],
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(pageData),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Notion API error:', error)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating Notion page:', error)
    return null
  }
}