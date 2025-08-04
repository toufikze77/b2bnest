// Token refresh utility for OAuth integrations
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { decrypt, encrypt } from './crypto.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

export async function refreshIntegrationToken(
  userId: string, 
  integration: 'google_calendar' | 'notion' | 'trello' | 'slack'
): Promise<string | null> {
  try {
    const { data: record, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_name', integration)
      .single()

    if (error || !record?.refresh_token) {
      console.log(`No refresh token found for ${integration}`)
      return null
    }

    const refreshToken = await decrypt(record.refresh_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
    let newTokenData: any = null

    // Handle different OAuth refresh flows
    if (integration === 'google_calendar') {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      newTokenData = await response.json()
    }

    if (integration === 'notion') {
      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${Deno.env.get('NOTION_CLIENT_ID')}:${Deno.env.get('NOTION_CLIENT_SECRET')}`)}`,
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      newTokenData = await response.json()
    }

    if (integration === 'trello') {
      // Trello tokens typically don't expire, but if they do:
      const response = await fetch('https://trello.com/1/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('TRELLO_CLIENT_ID') || '',
          client_secret: Deno.env.get('TRELLO_CLIENT_SECRET') || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      newTokenData = await response.json()
    }

    if (!newTokenData?.access_token) {
      console.error(`Failed to refresh token for ${integration}:`, newTokenData)
      return null
    }

    // Encrypt and store new tokens
    const encryptedAccessToken = await encrypt(newTokenData.access_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
    const encryptedRefreshToken = newTokenData.refresh_token 
      ? await encrypt(newTokenData.refresh_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
      : record.refresh_token

    const expiresAt = newTokenData.expires_in 
      ? new Date(Date.now() + newTokenData.expires_in * 1000).toISOString()
      : null

    await supabase
      .from('user_integrations')
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
      })
      .eq('user_id', userId)
      .eq('integration_name', integration)

    return newTokenData.access_token
  } catch (error) {
    console.error(`Error refreshing ${integration} token:`, error)
    return null
  }
}

export async function getValidToken(userId: string, integration: string): Promise<string | null> {
  try {
    const { data: record, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_name', integration)
      .single()

    if (error || !record?.access_token) {
      return null
    }

    // Check if token is expired
    if (record.expires_at && new Date(record.expires_at) <= new Date()) {
      console.log(`Token expired for ${integration}, refreshing...`)
      return await refreshIntegrationToken(userId, integration as any)
    }

    // Return decrypted token
    return await decrypt(record.access_token, Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-key-32-chars-long')
  } catch (error) {
    console.error(`Error getting valid token for ${integration}:`, error)
    return null
  }
}