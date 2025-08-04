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
    const { user_id, action = 'list_boards', board_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'list_boards') {
      return await listTrelloBoards(user_id)
    }

    if (action === 'import_board') {
      if (!board_id) {
        return new Response(
          JSON.stringify({ error: 'board_id is required for import_board' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return await importTrelloBoard(user_id, board_id)
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Trello import error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function listTrelloBoards(userId: string) {
  try {
    const token = await getValidToken(userId, 'trello')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Trello not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(`https://api.trello.com/1/members/me/boards?key=${Deno.env.get('TRELLO_CLIENT_ID')}&token=${token}`)

    if (!response.ok) {
      const error = await response.text()
      console.error('Trello API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch boards' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const boards = await response.json()
    const filteredBoards = boards
      .filter((board: any) => !board.closed)
      .map((board: any) => ({
        id: board.id,
        name: board.name,
        desc: board.desc,
        url: board.url,
        lists: board.lists?.length || 0,
      }))

    return new Response(
      JSON.stringify({ boards: filteredBoards }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error listing Trello boards:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list boards' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function importTrelloBoard(userId: string, boardId: string) {
  try {
    const token = await getValidToken(userId, 'trello')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Trello not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const clientId = Deno.env.get('TRELLO_CLIENT_ID')

    // Get board details
    const boardResponse = await fetch(`https://api.trello.com/1/boards/${boardId}?key=${clientId}&token=${token}`)
    if (!boardResponse.ok) {
      throw new Error('Failed to fetch board details')
    }
    const board = await boardResponse.json()

    // Get lists
    const listsResponse = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${clientId}&token=${token}`)
    if (!listsResponse.ok) {
      throw new Error('Failed to fetch board lists')
    }
    const lists = await listsResponse.json()

    // Get cards for each list
    const cardsResponse = await fetch(`https://api.trello.com/1/boards/${boardId}/cards?key=${clientId}&token=${token}`)
    if (!cardsResponse.ok) {
      throw new Error('Failed to fetch board cards')
    }
    const cards = await cardsResponse.json()

    // Create project in Louvable
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: board.name,
        description: board.desc || `Imported from Trello board: ${board.name}`,
        status: 'active',
      })
      .select()
      .single()

    if (projectError) {
      console.error('Error creating project:', projectError)
      return new Response(
        JSON.stringify({ error: 'Failed to create project' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const importResults = {
      project_id: project.id,
      board_name: board.name,
      lists_imported: 0,
      cards_imported: 0,
      errors: [],
    }

    // Import cards as tasks
    for (const card of cards) {
      try {
        const list = lists.find((l: any) => l.id === card.idList)
        
        // Map Trello list names to task statuses
        let status = 'todo'
        if (list?.name.toLowerCase().includes('doing') || list?.name.toLowerCase().includes('progress')) {
          status = 'in_progress'
        } else if (list?.name.toLowerCase().includes('done') || list?.name.toLowerCase().includes('complete')) {
          status = 'completed'
        }

        // Determine priority based on labels or position
        let priority = 'medium'
        if (card.labels?.some((label: any) => label.name.toLowerCase().includes('urgent') || label.color === 'red')) {
          priority = 'high'
        } else if (card.labels?.some((label: any) => label.color === 'green')) {
          priority = 'low'
        }

        const { error: taskError } = await supabase
          .from('todos')
          .insert({
            user_id: userId,
            title: card.name,
            description: card.desc || undefined,
            status,
            priority,
            due_date: card.due ? new Date(card.due).toISOString().split('T')[0] : null,
            labels: card.labels?.map((label: any) => label.name).filter(Boolean) || [],
          })

        if (taskError) {
          console.error(`Error importing card ${card.id}:`, taskError)
          importResults.errors.push(`Failed to import card: ${card.name}`)
        } else {
          importResults.cards_imported++
        }

      } catch (error) {
        console.error(`Error processing card ${card.id}:`, error)
        importResults.errors.push(`Error processing card: ${card.name}`)
      }
    }

    importResults.lists_imported = lists.length

    return new Response(
      JSON.stringify({
        message: `Successfully imported Trello board "${board.name}"`,
        results: importResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error importing Trello board:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to import board' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}