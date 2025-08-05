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

// Verify Slack request signature
async function verifySlackRequest(req: Request): Promise<boolean> {
  const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET')
  if (!signingSecret) return true // Skip verification in development
  
  const timestamp = req.headers.get('x-slack-request-timestamp')
  const signature = req.headers.get('x-slack-signature')
  
  if (!timestamp || !signature) return false
  
  // Check if timestamp is too old (5 minutes)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false
  
  const body = await req.text()
  const sigBase = `v0:${timestamp}:${body}`
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBase))
  const expectedSignature = 'v0=' + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return signature === expectedSignature
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method === 'POST') {
      // Verify Slack request signature
      const isVerified = await verifySlackRequest(req.clone())
      if (!isVerified) {
        console.error('Invalid Slack request signature')
        return new Response('Unauthorized', { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        })
      }

      const formData = await req.formData()
      const command = formData.get('command')
      const text = formData.get('text')
      const userId = formData.get('user_id')
      const channelId = formData.get('channel_id')
      const triggerId = formData.get('trigger_id')
      
      console.log('Slack command received:', { command, text, userId })

      if (command === '/louvable') {
        return await handleLouvableCommand(text as string, userId as string, channelId as string)
      }

      if (command === '/task' || command === '/todo') {
        return await handleTaskCommand(text as string, userId as string, triggerId as string)
      }

      return new Response('Unknown command', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      })
    }

    // GET endpoint for task updates/webhooks
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      const userId = url.searchParams.get('user_id')
      
      if (action === 'send_task_update' && userId) {
        return await sendTaskUpdate(userId)
      }
    }

    return new Response('Method not allowed', { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    })

  } catch (error) {
    console.error('Slack command error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    })
  }
})

async function handleLouvableCommand(text: string, slackUserId: string, channelId: string) {
  try {
    // Find user by Slack ID in metadata
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('user_id, metadata')
      .eq('integration_name', 'slack')
      .eq('metadata->slack_user_id', slackUserId)
      .single()

    if (!integration) {
      return new Response('Please connect your Louvable account first', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const userId = integration.user_id

    if (!text || text === 'help') {
      return new Response(`
*Louvable Commands:*
• \`/louvable my tasks\` - Show your active tasks
• \`/louvable create [task name]\` - Create a new task
• \`/louvable help\` - Show this help message
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    if (text === 'my tasks') {
      const { data: todos } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'todo')
        .limit(10)

      if (!todos || todos.length === 0) {
        return new Response('You have no active tasks! 🎉', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        })
      }

      const taskList = todos.map(todo => 
        `• ${todo.title} ${todo.due_date ? `(due: ${todo.due_date})` : ''}`
      ).join('\n')

      return new Response(`*Your Active Tasks:*\n${taskList}`, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    if (text.startsWith('create ')) {
      const taskTitle = text.replace('create ', '').trim()
      
      if (!taskTitle) {
        return new Response('Please provide a task title: `/louvable create [task name]`', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        })
      }

      const { error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          title: taskTitle,
          status: 'todo',
          priority: 'medium'
        })

      if (error) {
        console.error('Error creating task:', error)
        return new Response('Failed to create task', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        })
      }

      return new Response(`✅ Task created: "${taskTitle}"`, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    return new Response('Unknown command. Type `/louvable help` for available commands.', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })

  } catch (error) {
    console.error('Error handling Louvable command:', error)
    return new Response('Something went wrong. Please try again.', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
}

async function handleTaskCommand(text: string, slackUserId: string, triggerId: string) {
  try {
    // Find user by Slack ID in metadata
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('user_id, metadata')
      .eq('integration_name', 'slack')
      .eq('metadata->slack_user_id', slackUserId)
      .single()

    if (!integration) {
      return new Response('Please connect your Slack account first at the Integration Hub', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    const taskText = text?.toString().trim()
    
    if (!taskText) {
      // Open modal for task creation
      if (triggerId) {
        const modal = {
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: 'create_task',
            title: {
              type: 'plain_text',
              text: 'Create New Task'
            },
            submit: {
              type: 'plain_text',
              text: 'Create Task'
            },
            close: {
              type: 'plain_text',
              text: 'Cancel'
            },
            blocks: [
              {
                type: 'input',
                block_id: 'task_title_block',
                element: {
                  type: 'plain_text_input',
                  action_id: 'task_title',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Enter task title...'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Task Title'
                }
              },
              {
                type: 'input',
                block_id: 'task_description_block',
                optional: true,
                element: {
                  type: 'plain_text_input',
                  action_id: 'task_description',
                  multiline: true,
                  placeholder: {
                    type: 'plain_text',
                    text: 'Enter task description...'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Description'
                }
              },
              {
                type: 'input',
                block_id: 'task_priority_block',
                element: {
                  type: 'static_select',
                  action_id: 'task_priority',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select priority'
                  },
                  initial_option: {
                    text: {
                      type: 'plain_text',
                      text: 'Medium'
                    },
                    value: 'medium'
                  },
                  options: [
                    {
                      text: {
                        type: 'plain_text',
                        text: 'Low'
                      },
                      value: 'low'
                    },
                    {
                      text: {
                        type: 'plain_text',
                        text: 'Medium'
                      },
                      value: 'medium'
                    },
                    {
                      text: {
                        type: 'plain_text',
                        text: 'High'
                      },
                      value: 'high'
                    },
                    {
                      text: {
                        type: 'plain_text',
                        text: 'Critical'
                      },
                      value: 'critical'
                    }
                  ]
                },
                label: {
                  type: 'plain_text',
                  text: 'Priority'
                }
              },
              {
                type: 'input',
                block_id: 'task_due_block',
                optional: true,
                element: {
                  type: 'datepicker',
                  action_id: 'task_due_date',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select due date'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Due Date'
                }
              }
            ]
          }
        }

        // Open modal using Slack Web API
        try {
          const slackToken = Deno.env.get('SLACK_BOT_TOKEN')
          if (!slackToken) {
            throw new Error('SLACK_BOT_TOKEN not configured')
          }

          const modalResponse = await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(modal)
          })

          const modalResult = await modalResponse.json()
          
          if (!modalResult.ok) {
            console.error('Failed to open modal:', modalResult)
            throw new Error('Failed to open modal')
          }

          return new Response('', {
            status: 200,
            headers: corsHeaders
          })

        } catch (error) {
          console.error('Error opening modal:', error)
          return new Response('Please provide a task description. Usage: `/task Your task description`', {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          })
        }
      }

      return new Response('Please provide a task description. Usage: `/task Your task description`', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // Quick task creation from command text
    try {
      const { error: todoError } = await supabase
        .from('todos')
        .insert({
          user_id: integration.user_id,
          title: taskText,
          status: 'todo',
          priority: 'medium'
        })

      if (todoError) {
        console.error('Error creating todo:', todoError)
        throw new Error('Failed to create task')
      }

      return new Response(`✅ Task created: *${taskText}*`, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })

    } catch (error) {
      console.error('Error creating task:', error)
      return new Response('Failed to create task. Please try again or use the web app.', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

  } catch (error) {
    console.error('Error handling task command:', error)
    return new Response('Something went wrong. Please try again.', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
}

async function sendTaskUpdate(userId: string) {
  try {
    const token = await getValidToken(userId, 'slack')
    if (!token) {
      return new Response('Slack not connected', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get user's overdue tasks
    const { data: overdueTasks } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .lt('due_date', new Date().toISOString())
      .eq('status', 'todo')

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response('No overdue tasks', { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get Slack channel from integration metadata
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('metadata')
      .eq('user_id', userId)
      .eq('integration_name', 'slack')
      .single()

    const slackUserId = integration?.metadata?.slack_user_id
    if (!slackUserId) {
      return new Response('Slack user ID not found', { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const message = `🚨 *Overdue Tasks Reminder*\n${overdueTasks.map(task => 
      `• ${task.title} (due: ${task.due_date})`
    ).join('\n')}`

    // Send DM to user
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackUserId,
        text: message,
      }),
    })

    const result = await response.json()
    
    if (!result.ok) {
      console.error('Slack API error:', result)
      return new Response(JSON.stringify({ error: result.error }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'Task update sent' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error sending task update:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
}