# Per-tenant WhatsApp Integration (BYO credentials)

Each subscriber connects their **own** WhatsApp/Twilio account. Credentials are encrypted at rest and never sent to the browser. Workflow steps execute server-side using only the calling user's credentials.

## 1. Storage (reuse existing `user_integrations`)

We already have:
- `public.user_integrations` (per-user, RLS-protected, tokens encrypted)
- `store_integration_tokens(name, access_token, refresh_token, expires_at, metadata)`
- `get_integration_tokens(name)` — SECURITY DEFINER, audit-logged

New `integration_name` value: `whatsapp_twilio`
- `access_token` ← Twilio Auth Token (encrypted)
- `metadata` ← `{ account_sid, from_number, channel: "whatsapp"|"sms", verified: bool }`

Add migration to:
- Create RPC `test_whatsapp_connection(p_user_id)` returning bool (calls into edge function via UI — not via SQL).
- Add `workflow_run_logs` table (per-user) for audit of executed steps.

```text
workflow_run_logs
├─ user_id          uuid (RLS: own rows only)
├─ workflow_id      uuid nullable
├─ step             text   (e.g. "whatsapp.send")
├─ status           text   ("ok" | "error")
├─ provider         text   ("twilio")
├─ request_summary  jsonb  (to, channel, body length — never full secrets)
├─ response_summary jsonb  (message sid, error code)
└─ created_at       timestamptz
```

## 2. Edge functions

**`whatsapp-connect`** (JWT-required)
- Body: `{ account_sid, auth_token, from_number, channel }`
- Validates with Twilio `GET /Accounts/{sid}.json` using basic auth
- On success → calls `store_integration_tokens('whatsapp_twilio', auth_token, null, null, {account_sid, from_number, channel, verified:true})`
- Returns `{ ok, verified_at }`

**`whatsapp-disconnect`** (JWT-required)
- Marks the user's `user_integrations` row `is_connected=false` and nulls the tokens.

**`workflow-execute`** (JWT-required)
- Body: `{ workflow_id?, steps: [{ type: "whatsapp.send", to, body, mediaUrl? }] }`
- Loads creds via `get_integration_tokens('whatsapp_twilio')` for the caller only
- Validates inputs (Zod): E.164 `to`, body ≤ 1600 chars, max 10 steps/run, rate-limit 30 calls/min per user
- Calls Twilio REST directly (`https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`) with HTTP Basic
- Writes to `workflow_run_logs`; returns per-step `{ ok, sid?, error? }`

Security posture:
- All three functions: CORS + `getClaims()` JWT check, no service-role exposed to client
- Never echo `auth_token` back in responses
- SSRF-safe: only fetches `api.twilio.com`
- Input allowlists; reject any `to` not matching `^\+[1-9]\d{6,14}$`

## 3. Frontend

**New page `src/pages/integrations/WhatsAppSettings.tsx`** (route `/integrations/whatsapp`)
- Status card: Connected / Not connected (reads `get_user_integrations_safe`)
- "Connect" form: Account SID, Auth Token (password field), From number, Channel (WhatsApp/SMS)
- "Test message" button → calls `workflow-execute` with one step
- "Disconnect" button

**Workflow builder update** (`src/components/workflow/...`)
- Add **Send WhatsApp** step block with icon, fields (to, body, optional media)
- Run button calls `workflow-execute` edge function
- Inline empty-state CTA when user hasn't connected yet → links to `/integrations/whatsapp`

**Template**: add "Lead → WhatsApp welcome" template to the gallery.

## 4. What's intentionally NOT in this change

- No workspace-level Twilio connector (you confirmed multi-tenant — each user brings their own keys)
- No other providers (Slack/HubSpot/etc) — ask separately when ready
- No scheduled/cron triggers yet — manual run only; can add `pg_cron` later

## Approval needed
This requires a DB migration (new `workflow_run_logs` table + grants/RLS) and 3 new edge functions. Approve to proceed.
