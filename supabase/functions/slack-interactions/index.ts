import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { decrypt } from '../shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify Slack request signature
async function verifySlackRequest(req: Request, body: string): Promise<boolean> {
  const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET')
  if (!signingSecret) return true // Skip verification in development
  
  const timestamp = req.headers.get('x-slack-request-timestamp')
  const signature = req.headers.get('x-slack-signature')
  
  if (!timestamp || !signature) return false
  
  // Check if timestamp is too old (5 minutes)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) return false
  
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

// Get user ID by Slack user ID
async function getUserIdBySlack(supabase: any, slackUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_integrations')
    .select('user_id, metadata')
    .eq('integration_name', 'slack')
    .eq('is_connected', true)
    .single()

  if (error || !data) {
    console.error('Error finding Slack user mapping:', error)
    return null
  }

  // Check if the Slack user ID matches in metadata
  if (data.metadata?.slack_user_id === slackUserId) {
    return data.user_id
  }

  return null
}

// Create task from Slack modal
async function createTaskFromSlackModal(supabase: any, {
  slackUserId,
  title,
  dueDate,
  priority,
  description,
}: {
  slackUserId: string;
  title: string;
  dueDate?: string;
  priority: string;
  description?: string;
}) {
  const userId = await getUserIdBySlack(supabase, slackUserId)
  if (!userId) {
    throw new Error('Slack user not linked to any account')
  }

  const todoData: any = {
    user_id: userId,
    title,
    description: description || null,
    priority,
    status: 'todo',
    due_date: dueDate || null,
  }

  const { data, error } = await supabase
    .from('todos')
    .insert(todoData)
    .select()
    .single()

  if (error) {
    console.error('Error creating todo:', error)
    throw new Error('Failed to create task')
  }

  console.log('Task created successfully:', data)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method === 'POST') {
      const body = await req.text()
      
      // Verify Slack request signature
      const isVerified = await verifySlackRequest(req, body)
      if (!isVerified) {
        console.error('Invalid Slack request signature')
        return new Response('Unauthorized', { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        })
      }

      // Parse the form data
      const formData = new URLSearchParams(body)
      const payloadStr = formData.get('payload')
      
      if (!payloadStr) {
        return new Response('No payload found', { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        })
      }

      const payload = JSON.parse(payloadStr)
      console.log('Slack interaction payload:', JSON.stringify(payload, null, 2))

      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Handle different interaction types
      if (payload.type === 'view_submission' && payload.view.callback_id === 'create_task') {
        try {
          const values = payload.view.state.values
          const title = values.task_title_block?.task_title?.value
          const dueDate = values.task_due_block?.task_due_date?.selected_date
          const priority = values.task_priority_block?.task_priority?.selected_option?.value || 'medium'
          const description = values.task_description_block?.task_description?.value

          if (!title) {
            return new Response(JSON.stringify({
              response_action: 'errors',
              errors: {
                task_title_block: 'Task title is required'
              }
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          await createTaskFromSlackModal(supabase, {
            slackUserId: payload.user.id,
            title,
            dueDate,
            priority,
            description,
          })

          return new Response(JSON.stringify({ 
            response_action: 'clear',
            text: `✅ Task "${title}" created successfully!`
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })

        } catch (error) {
          console.error('Error creating task from Slack modal:', error)
          
          if (error.message === 'Slack user not linked to any account') {
            return new Response(JSON.stringify({
              response_action: 'errors',
              errors: {
                task_title_block: 'Your Slack account is not linked. Please connect your account first.'
              }
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          return new Response(JSON.stringify({
            response_action: 'errors',
            errors: {
              task_title_block: 'Failed to create task. Please try again.'
            }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // Handle slash command to open task creation modal
      if (payload.type === 'shortcut' || payload.command === '/createtask') {
        const modal = {
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

        return new Response(JSON.stringify({
          type: 'modal',
          ...modal
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response('Interaction type not supported', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })

    } else {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

  } catch (error) {
    console.error('Slack interactions error:', error)
    return new Response('Internal server error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    })
  }
})