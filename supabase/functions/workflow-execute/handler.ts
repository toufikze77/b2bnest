// WhatsApp step runner (used by WhatsApp settings → "Send test"; the Workflow Studio WhatsApp step stays switched off).
// Dependencies are injected so tests never call Twilio or the database.
// Phase 19: workflows (and so this runner) are included on the trial, for owners/master accounts and on Business or
// Scale only (_shared/workflow-access.ts). The plan is read on the server; a refusal sends nothing and is logged skipped.
//
// Run logs (public.workflow_run_logs) hold counts and codes only: never the phone number, the message, Twilio's
// free-text reply (it can repeat the number) or raw exception text (it can include the account URL).

import { COMPANY_TRIAL_ENDED_MESSAGE, SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";
import {
  WORKFLOW_PLAN_CHECK_FAILED, WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE, WORKFLOWS_NOT_INCLUDED_MESSAGE, workflowAccess, WorkflowAccessInput,
} from "../_shared/workflow-access.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface WhatsAppAccount { auth_token: string; account_sid: string; from_number: string; channel: string }
export interface ExecuteLogRow {
  user_id: string; workflow_id: string | null; step: "whatsapp.send"; status: "ok" | "error" | "skipped"; provider: "twilio" | "none";
  request_summary: { channel: string; body_length: number } | { steps: number };
  response_summary: { error?: string; status?: number; code?: number | string | null; sid?: string; twilio_status?: string; message?: string };
}
export interface ExecuteDeps {
  getUserId: (authHeader: string) => Promise<string | null>;
  /** The caller's row of public._access_state_for(uid), read with the service role. Required; an error refuses. */
  accessState: (userId: string) => Promise<WorkflowAccessInput | null>;
  rateLimit: (userId: string) => boolean;
  loadWhatsApp: (userId: string, authHeader: string) => Promise<{ ok: true; account: WhatsAppAccount } | { ok: false; error: string }>;
  twilio: (account: WhatsAppAccount, form: URLSearchParams) => Promise<Response>;
  /** Service-role insert. Best effort. */
  log: (row: ExecuteLogRow) => Promise<void>;
}

const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_STEPS = 10;
const MAX_BODY = 1600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RATE_LIMITED = "You've run a lot of steps in the last minute. Nothing was sent. Wait a minute, then try again.";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Per-instance in-memory limiter (best effort; not strict across regions). */
export function memoryRateLimit(limit = 30, windowMs = 60_000, now = () => Date.now()) {
  const bucket = new Map<string, { count: number; reset: number }>();
  return (userId: string) => {
    const t = now(); const b = bucket.get(userId);
    if (!b || b.reset < t) { bucket.set(userId, { count: 1, reset: t + windowMs }); return true; }
    if (b.count >= limit) return false;
    b.count++; return true;
  };
}

export function makeHandler(deps: ExecuteDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userId = await deps.getUserId(auth).catch(() => null);
    if (!userId) return json({ error: "unauthorized" }, 401);

    if (!deps.rateLimit(userId)) return json({ error: "rate_limited", message: RATE_LIMITED }, 429);

    type Step = { type?: unknown; to?: unknown; body?: unknown; mediaUrl?: unknown };
    let body: { steps?: unknown; workflow_id?: unknown };
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const steps = Array.isArray(body?.steps) ? body.steps as Step[] : null;
    if (!steps || steps.length === 0) return json({ error: "no_steps" }, 400);
    if (steps.length > MAX_STEPS) return json({ error: "too_many_steps" }, 400);
    const workflowId = typeof body?.workflow_id === "string" && UUID.test(body.workflow_id) ? body.workflow_id : null;

    // Phase 19: the plan gate. Nothing is sent unless the caller's own plan (read on the server) includes workflows.
    const access = await deps.accessState(userId).then(workflowAccess, (e) => {
      console.error("workflow-execute: plan check failed", e instanceof Error ? e.name : typeof e);
      return null;
    });
    if (!access || !access.included) {
      const [status, error, message] = !access || access.reason === "unknown_state"
        ? [503, "plan_check_failed", WORKFLOW_PLAN_CHECK_FAILED]
        : access.reason === "suspended" ? [403, "account_suspended", SUSPENDED_MESSAGE]
        : access.reason === "trial_ended" ? [402, "trial_ended", access.via === "company" ? COMPANY_TRIAL_ENDED_MESSAGE : TRIAL_ENDED_MESSAGE]
        : [403, "plan_not_included", access.via === "company" ? WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE : WORKFLOWS_NOT_INCLUDED_MESSAGE];
      if (access?.reason === "unknown_plan") console.error("workflow-execute: unknown plan key, workflows refused (fail closed)");
      await deps.log({ user_id: userId, workflow_id: workflowId, step: "whatsapp.send", status: "skipped", provider: "none",
        request_summary: { steps: steps.length }, response_summary: { error, message } }).catch(() => {});
      return json({ ok: false, error, message, sent: "not_sent" }, status as number);
    }

    let wa: WhatsAppAccount | null = null;
    if (steps.some((s) => s?.type === "whatsapp.send")) {
      const r = await deps.loadWhatsApp(userId, auth);
      if (!r.ok) return json({ error: r.error }, 400);
      wa = r.account;
    }

    const log = (status: ExecuteLogRow["status"], bodyLength: number, response: ExecuteLogRow["response_summary"]) =>
      deps.log({ user_id: userId, workflow_id: workflowId, step: "whatsapp.send", status, provider: "twilio",
        request_summary: { channel: wa!.channel, body_length: bodyLength }, response_summary: response }).catch(() => {});

    const results: Record<string, unknown>[] = [];
    for (const step of steps) {
      if (step?.type !== "whatsapp.send") { results.push({ ok: false, error: "unsupported_step" }); continue; }
      const to = String(step.to ?? "");
      const text = String(step.body ?? "");
      const mediaUrl = step.mediaUrl ? String(step.mediaUrl) : null;
      if (!E164.test(to)) { results.push({ ok: false, error: "invalid_to" }); await log("error", text.length, { error: "invalid_to" }); continue; }
      if (!text || text.length > MAX_BODY) { results.push({ ok: false, error: "invalid_body" }); continue; }
      if (mediaUrl && !/^https:\/\//.test(mediaUrl)) { results.push({ ok: false, error: "invalid_media_url" }); continue; }

      const fromAddr = wa!.channel === "whatsapp" ? `whatsapp:${wa!.from_number}` : wa!.from_number;
      const toAddr = wa!.channel === "whatsapp" ? `whatsapp:${to}` : to;
      const form = new URLSearchParams({ To: toAddr, From: fromAddr, Body: text });
      if (mediaUrl) form.append("MediaUrl", mediaUrl);

      let res: Response;
      try { res = await deps.twilio(wa!, form); } catch {
        results.push({ ok: false, error: "network_error" });
        await log("error", text.length, { error: "network_error" });
        continue;
      }
      const tj: { code?: number | string; message?: string; sid?: string; status?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The caller sees Twilio's reply (their own account); the log keeps only the status and code.
        results.push({ ok: false, error: "twilio_error", code: tj.code, message: tj.message });
        await log("error", text.length, { error: "twilio_error", status: res.status, code: tj.code ?? null });
        continue;
      }
      results.push({ ok: true, sid: tj.sid });
      await log("ok", text.length, { sid: tj.sid, twilio_status: tj.status });
    }
    return json({ ok: true, results });
  };
}
