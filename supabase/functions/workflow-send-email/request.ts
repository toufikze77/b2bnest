// The workflow email step's request handling (Workflow Studio → "Send an email"). Dependencies are injected so tests
// never contact a real mail server. Shared mail helpers stay in handler.ts, which the email senders also import.
import { renderTemplate } from "../_shared/placeholders.ts";
import { NO_REPLY_ADDRESS, replyToAddress } from "../_shared/reply-to.ts";
import { COMPANY_TRIAL_ENDED_MESSAGE, SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";
import {
  WORKFLOW_PLAN_CHECK_FAILED, WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE, WORKFLOWS_NOT_INCLUDED_MESSAGE, workflowAccess, WorkflowAccessInput,
} from "../_shared/workflow-access.ts";
import {
  classifySmtpError, corsHeaders, Deps as BaseDeps, Mail, redactEmails, resolveSmtp, sanitizeError, UNKNOWN_STATUS,
} from "./handler.ts";

export interface Deps extends BaseDeps {
  /**
   * The caller's row of public._access_state_for(uid), read with the service role (Phase 19). Workflows are included
   * on the trial, for owners/master accounts and on Business or Scale (_shared/workflow-access.ts). Required: there is
   * no way to skip the check, and a failed lookup refuses (nothing sent).
   */
  accessState: (userId: string) => Promise<WorkflowAccessInput | null>;
  /** false = this user has sent too many emails in the last minute. Omitted = no limit (tests). */
  rateLimit?: (userId: string) => boolean;
  /** Writes one public.workflow_run_logs row (service role). Best effort: a failure never changes the send result. */
  logRun?: (row: RunLogRow) => Promise<void>;
}

/** What Run history stores per email step: counts and the server's own reason. Never addresses or message text. */
export interface RunLogRow {
  user_id: string; workflow_id: string | null; run_id: string; step_index: number; step: "email.send";
  status: "ok" | "error" | "unknown" | "skipped"; provider: string;
  request_summary: { recipients: number; subject_length: number; body_length: number; placeholders: number };
  response_summary: { code: string; message: string };
}

/** Per-instance limiter (best effort, like workflow-execute's): `limit` sends per user per window. */
export function memoryRateLimit(limit = 30, windowMs = 60_000, now = () => Date.now()) {
  const bucket = new Map<string, { count: number; reset: number }>();
  return (userId: string) => {
    const t = now(); const b = bucket.get(userId);
    if (!b || b.reset < t) { bucket.set(userId, { count: 1, reset: t + windowMs }); return true; }
    if (b.count >= limit) return false;
    b.count++; return true;
  };
}

export const RATE_LIMITED = "You've sent a lot of emails in the last minute. Nothing was sent. Wait a minute, then try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(401, { success: false, error: "Please sign in again." });
    const user = await deps.getUser(auth.slice(7).trim()).catch(() => null);
    if (!user) return json(401, { success: false, error: "Please sign in again." });

    let body: {
      to?: unknown; subject?: unknown; body?: unknown; html?: unknown; probe?: unknown;
      template?: { subject?: unknown; body?: unknown }; values?: unknown; runId?: unknown; stepIndex?: unknown; workflowId?: unknown;
    };
    try { body = await req.json(); } catch { return json(400, { success: false, error: "Invalid request." }); }

    // Connection check for platform admins: signs in to the mail server and quits. Never sends mail.
    if (body.probe === true) {
      const admin = deps.isSuperAdmin ? await deps.isSuperAdmin(user.id).catch(() => false) : false;
      if (!admin) return json(403, { success: false, error: "Only platform admins can run the connection check." });
      const cfg = resolveSmtp(deps.env);
      if (!cfg) return json(503, { success: false, code: "not_configured", error: "Email sending isn't set up on the server yet." });
      if (!deps.probe) return json(501, { success: false, error: "Connection check unavailable." });
      const raw = await deps.probe(cfg);
      const p = { ...raw, ...(raw.reply ? { reply: redactEmails(raw.reply) } : {}), ...(raw.exception ? { exception: redactEmails(raw.exception) } : {}) };
      console.log("workflow-send-email: probe", { provider: cfg.provider, ...p });
      return json(200, { success: p.ok, provider: cfg.provider, probe: p, sent: false });
    }

    const to = (Array.isArray(body.to) ? body.to : String(body.to ?? "").split(","))
      .map((r) => String(r).trim()).filter(Boolean);
    const subject = String(body.subject ?? "").trim(), text = String(body.body ?? "");

    // Run history (Workflow Studio): one row per email step, written only when the call names a run.
    const runId = typeof body.runId === "string" && UUID.test(body.runId) ? body.runId : null;
    const stepIndex = Number.isInteger(body.stepIndex) && (body.stepIndex as number) >= 0 && (body.stepIndex as number) < 10 ? body.stepIndex as number : 0;
    const workflowId = typeof body.workflowId === "string" && UUID.test(body.workflowId) ? body.workflowId : null;
    let summary = { recipients: to.length, subject_length: subject.length, body_length: text.length, placeholders: 0 };
    const respond = async (status: number, payload: Record<string, unknown>, log: RunLogRow["status"], provider = "none") => {
      if (runId && deps.logRun) {
        const message = redactEmails(String(payload.error ?? payload.message ?? "")).slice(0, 300);
        await deps.logRun({
          user_id: user.id, workflow_id: workflowId, run_id: runId, step_index: stepIndex, step: "email.send", status: log, provider,
          request_summary: summary, response_summary: { code: String(payload.code ?? payload.status ?? ""), message },
        }).catch((e) => console.error("workflow-send-email: run log not written", { error: sanitizeError(e) }));
      }
      return json(status, payload);
    };

    // Phase 19: Workflow Studio is a Business and Scale feature (plus the trial and owners). This is the real gate: the
    // plan is read on the server from the caller's account, never from the request. Refused or unchecked = nothing sent,
    // recorded in Run history as skipped.
    const access = await deps.accessState(user.id).then(workflowAccess, (e) => {
      console.error("workflow-send-email: plan check failed", { error: sanitizeError(e) });
      return null;
    });
    if (!access || !access.included) {
      const skip = (status: number, code: string, error: string) =>
        respond(status, { success: false, code, sent: "not_sent", error }, "skipped");
      if (!access || access.reason === "unknown_state") return skip(503, "plan_check_failed", WORKFLOW_PLAN_CHECK_FAILED);
      if (access.reason === "suspended") return skip(403, "account_suspended", SUSPENDED_MESSAGE);
      if (access.reason === "trial_ended") return skip(402, "trial_ended", access.via === "company" ? COMPANY_TRIAL_ENDED_MESSAGE : TRIAL_ENDED_MESSAGE);
      if (access.reason === "unknown_plan") console.error("workflow-send-email: unknown plan key, workflows refused (fail closed)");
      return skip(403, "plan_not_included", access.via === "company" ? WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE : WORKFLOWS_NOT_INCLUDED_MESSAGE);
    }

    if (deps.rateLimit && !deps.rateLimit(user.id)) {
      return json(429, { success: false, code: "rate_limited", sent: "not_sent", error: RATE_LIMITED });
    }

    if (!to.length || !subject || !text.trim()) return respond(400, { success: false, code: "invalid_request", sent: "not_sent", error: "To, subject and message are required." }, "error");
    if (to.length > 10 || !to.every((r) => EMAIL.test(r))) return respond(400, { success: false, code: "invalid_request", sent: "not_sent", error: "Check the email addresses (up to 10)." }, "error");

    // Placeholders are filled HERE with the same function the preview uses (_shared/placeholders.ts). With a template,
    // the subject and message sent must equal the preview the user confirmed; without one, any {{...}} is refused.
    const tpl = body.template && typeof body.template === "object"
      ? { subject: String(body.template.subject ?? ""), body: String(body.template.body ?? "") }
      : { subject, body: text };
    const values = body.values && typeof body.values === "object" && !Array.isArray(body.values) ? body.values as Record<string, string> : {};
    const rendered = renderTemplate(tpl, values, { html: body.html === true });
    summary = { ...summary, placeholders: rendered.used.length };
    if (!rendered.ok) {
      return respond(400, { success: false, code: "invalid_details", sent: "not_sent", error: `${rendered.errors.join(" ")} Nothing was sent.`, errors: rendered.errors }, "error");
    }
    if (body.template && (rendered.subject !== subject || rendered.body !== text)) {
      return respond(409, { success: false, code: "preview_mismatch", sent: "not_sent", error: "The email changed after the preview. Nothing was sent. Check the preview and run it again." }, "error");
    }

    const cfg = resolveSmtp(deps.env);
    if (!cfg) return respond(503, { success: false, code: "not_configured", sent: "not_sent", error: "Email sending isn't set up on the server yet. Nothing was sent." }, "error");

    // Replies go to the sender's own verified account email (from the auth server, never the request body). The From
    // address stays B2BNEST's. Without a verified, safe address no Reply-To is set and the response says so.
    const replyTo = replyToAddress(user);
    const mail: Mail = {
      from: cfg.from, to, subject: rendered.subject, ...(body.html === true ? { html: rendered.body } : { content: rendered.body }),
      ...(replyTo ? { replyTo } : {}),
    };
    const reply = replyTo ? { replyTo } : { replyTo: null, replyNote: NO_REPLY_ADDRESS };
    const ms = deps.timeoutMs ?? 20_000;
    let timer: number | undefined;
    try {
      await Promise.race([
        deps.send(cfg, mail),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("__timeout__")), ms) as unknown as number; }),
      ]);
    } catch (e) {
      if (e instanceof Error && e.message === "__timeout__") {
        console.error("workflow-send-email: provider timeout", { provider: cfg.provider, host: cfg.hostname, port: cfg.port, ms });
        return respond(504, { success: false, code: "timeout", sent: "unknown", error: UNKNOWN_STATUS }, "unknown", cfg.provider);
      }
      const c = classifySmtpError(e);
      console.error("workflow-send-email: provider error", {
        provider: cfg.provider, host: cfg.hostname, port: cfg.port, code: c.code, sent: c.sent,
        exception: sanitizeError(e, cfg),
      });
      return respond(502, { success: false, code: c.code, sent: c.sent, error: c.message }, c.sent === "unknown" ? "unknown" : "error", cfg.provider);
    } finally { clearTimeout(timer); }

    console.log("workflow-send-email: accepted", { provider: cfg.provider, recipients: to.length });
    return respond(200, { success: true, status: "accepted", message: "Accepted by the email provider. Inbox delivery isn't confirmed.", ...reply }, "ok", cfg.provider);
  };
}
