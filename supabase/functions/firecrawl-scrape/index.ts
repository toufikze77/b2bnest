import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CrawlOptions {
  limit?: number
  scrapeOptions?: {
    formats?: string[]
    includeTags?: string[]
    excludeTags?: string[]
    onlyMainContent?: boolean
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url, action, options = {} } = await req.json()
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let endpoint = 'https://api.firecrawl.dev/v1'
    let requestBody: any = { url }

    if (action === 'scrape') {
      endpoint += '/scrape'
      requestBody = {
        url,
        formats: options.formats || ['markdown', 'html'],
        includeTags: options.includeTags,
        excludeTags: options.excludeTags,
        onlyMainContent: options.onlyMainContent || true
      }
    } else if (action === 'crawl') {
      endpoint += '/crawl'
      requestBody = {
        url,
        limit: options.limit || 10,
        scrapeOptions: {
          formats: options.formats || ['markdown'],
          onlyMainContent: options.onlyMainContent || true,
          ...options.scrapeOptions
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "scrape" or "crawl"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Making Firecrawl ${action} request:`, { url, options })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Firecrawl API error:', data)
      return new Response(
        JSON.stringify({ 
          error: data.error || `Firecrawl API error: ${response.status}`,
          details: data
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Firecrawl response received successfully')

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in firecrawl-scrape function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})