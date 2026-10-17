// Email one invoice or quote to the customer on that document — NOT DEPLOYED (Phase 4b).
// Pure request logic; every dependency is injected so tests never contact a mail server or database.
//
// Honesty rules:
// - The recipient is always the document's client_email, read with the caller's own identity (RLS).
//   Anything the browser sends as `to` is ignored. One recipient, no CC/BCC.
// - Success is returned only when the mail server accepted the message ("accepted_by_provider").
//   That is not proof of inbox delivery, and nothing here claims delivery.
// - A failure before the message was handed over is "failed" (nothing sent). A connection lost after
//   the message was handed over, or a timeout, is "uncertain": the user is told to check before retrying.
// - The document status is never changed here. The browser records "sent" only after a success reply.
import { classifySmtpError, corsHeaders, redactEmails, resolveSmtp, sanitizeError, type SmtpConfig } from "../workflow-send-email/handler.ts";
import { buildMixedMessage, type MixedMail } from "../workflow-send-email/smtp.ts";

export type Kind = "invoice" | "quote";
export interface DocRow {
  id: string; user_id: string; kind: Kind; number: string | null; status: string | null; archived_at: string | null;
  client_email: string | null; client_name: string | null; company_name: string | null;
  total_amount: number | string | null; currency: string | null;
  /** Invoice due date or quote valid-until date (YYYY-MM-DD). */
  date: string | null;
}
export type LogStatus = "accepted_by_provider" | "failed" | "uncertain";
export interface LogRow {
  user_id: string; document_kind: Kind; document_id: string; recipient_domain: string; status: LogStatus;
  error_stage: string | null; provider_reply: string | null;
}
export interface Deps {
  env: (name: string) => string | undefined;
  getUser: (token: string) => Promise<{ id: string; email: string | null } | null>;
  /** Reads the document as the signed-in user (row-level security applies). null when not visible. */
  loadDocument: (token: string, kind: Kind, id: string) => Promise<DocRow | null>;
  /** Emails accepted (or possibly sent) in the last 24 hours, for the user and for this document. */
  recentCounts: (userId: string, documentId: string, sinceIso: string) => Promise<{ user: number; document: number }>;
  log: (row: LogRow) => Promise<void>;
  /** Sends the prebuilt message; resolves with the server's final reply text. */
  send: (cfg: SmtpConfig, envelope: { from: string; to: string }, raw: string) => Promise<{ reply: string }>;
  now?: () => Date;
  timeoutMs?: number;
}

export const LIMITS = { perUserPerDay: 20, perDocumentPerDay: 3, pdfBytes: 5 * 1024 * 1024, message: 2000, subject: 200 };
const ALLOWED_KEYS = new Set(["kind", "id", "subject", "message", "pdf_base64", "to"]); // `to` is accepted and ignored
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One plain address: no spaces, commas, angle brackets, quotes or line breaks. */
const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const UNCERTAIN = "The connection to the email provider was lost after the message was handed over, so it may or may not have been sent. Check with your customer (or your Sent items) before trying again.";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

/** Email sending for documents needs the Microsoft 365 SMTP_* settings and the on switch. */
export function documentEmailConfig(env: Deps["env"]): SmtpConfig | null {
  const cfg = resolveSmtp(env);
  if (!cfg || cfg.provider !== "smtp") return null; // never the old Gmail fallback
  if (env("DOCUMENT_EMAIL_ENABLED") !== "true") return null;
  return cfg;
}

/** Text safe for a header display name: no line breaks, angle brackets, quotes or backslashes. */
export function cleanName(s: string | null | undefined, max = 70): string {
  return String(s ?? "").replace(/[\r\n<>"\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}
const cleanLine = (s: string, max: number) => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const isEmail = (s: string | null | undefined): s is string => !!s && s.length <= 254 && EMAIL.test(s);
const addrOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim();
const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
const encodeName = (s: string) => {
  if (/^[\x20-\x7e]*$/.test(s)) return `"${s}"`;
  const bytes = new TextEncoder().encode(s); let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
};

export const kindLabel = (k: Kind) => (k === "invoice" ? "invoice" : "quote");
export function fileNameFor(d: Pick<DocRow, "kind" | "number">): string {
  const base = String(d.number ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80);
  return `${base || d.kind}.pdf`;
}
const amountText = (d: DocRow) => {
  const n = Number(d.total_amount) || 0;
  const a = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return d.currency ? `${a} ${String(d.currency).toUpperCase()}` : a;
};
const dateText = (iso: string | null) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const t = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

/** Default subject and message. The browser shows the same wording in the dialog. */
export function defaultSubject(d: DocRow): string {
  const label = d.kind === "invoice" ? "Invoice" : "Quote";
  const biz = cleanName(d.company_name);
  return cleanLine(`${label} ${d.number ?? ""}${biz ? ` from ${biz}` : ""}`, LIMITS.subject);
}
export function defaultMessage(d: DocRow): string {
  const biz = cleanName(d.company_name) || "your supplier";
  const when = dateText(d.date);
  const due = when ? (d.kind === "invoice" ? `, due ${when}` : `, valid until ${when}`) : "";
  return `Hello ${cleanName(d.client_name) || "there"},\n\nPlease find ${kindLabel(d.kind)} ${d.number ?? ""} attached, total ${amountText(d)}${due}.\n\nSent by ${biz} using B2BNEST.`;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** Plain text and HTML bodies. The owner's text is escaped; no links, images, pixels or tracking are added. */
export function buildBodies(message: string, business: string): { text: string; html: string } {
  const footer = `This email was sent via B2BNEST on behalf of ${business || "the business named above"}. Reply to this email to contact them.`;
  const text = `${message}\n\n--\n${footer}`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937">`
    + `<div>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</div>`
    + `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">`
    + `<p style="font-size:12px;color:#6b7280">${escapeHtml(footer)}</p></body></html>`;
  return { text, html };
}

/** Decodes base64 and checks it is a PDF of at most 5 MB. */
export function decodePdf(b64: unknown): { bytes: Uint8Array } | { error: string } {
  if (typeof b64 !== "string" || !b64) return { error: "The PDF is missing." };
  const clean = b64.replace(/^data:application\/pdf;base64,/, "").replace(/\s+/g, "");
  if (clean.length > Math.ceil(LIMITS.pdfBytes / 3) * 4 + 4) return { error: "The PDF is larger than 5 MB." };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return { error: "The PDF couldn't be read." };
  let bin: string;
  try { bin = atob(clean); } catch { return { error: "The PDF couldn't be read." }; }
  if (bin.length > LIMITS.pdfBytes) return { error: "The PDF is larger than 5 MB." };
  if (!bin.startsWith("%PDF")) return { error: "The attachment is not a PDF." };
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes };
}

/** Plain reason for an SMTP failure, and whether the message may have been sent. */
export function describeFailure(e: unknown): { stage: string; code: string; message: string; uncertain: boolean } {
  const err = e as { stage?: string; afterData?: boolean; message?: string };
  const stage = typeof err?.stage === "string" ? err.stage : (String(err?.message ?? "").match(/stage=(\w+)/)?.[1] ?? "unknown");
  const c = classifySmtpError(e);
  const uncertain = err?.afterData === true || c.sent === "unknown";
  if (uncertain) return { stage, code: "uncertain", message: UNCERTAIN, uncertain };
  if (stage === "rcpt_to" && c.code === "provider_rejected")
    return { stage, code: "recipient_rejected", uncertain, message: `The mail server refused the customer's email address. Check the address on this document and try again. Nothing was sent.` };
  if (c.code === "provider_auth_rejected")
    return { stage, code: c.code, uncertain, message: "The B2BNEST sending account couldn't sign in to the mail server (wrong password or sign-in blocked). Nothing was sent. This needs fixing by B2BNEST, not by you." };
  return { stage, code: c.code, uncertain, message: c.message };
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "GET" && req.method !== "POST") return json(405, { success: false, error: "Method not allowed." });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(401, { success: false, error: "Please sign in again." });
    const token = auth.slice(7).trim();
    const user = await deps.getUser(token).catch(() => null);
    if (!user) return json(401, { success: false, error: "Please sign in again." });

    // Lightweight check for the browser: is sending switched on? Never connects to the mail server.
    if (req.method === "GET") return json(200, { configured: !!documentEmailConfig(deps.env) });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json(400, { success: false, error: "Invalid request." }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { success: false, error: "Invalid request." });
    const unknown = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
    if (unknown.length) return json(400, { success: false, error: "Invalid request." });
    const kind = body.kind, id = body.id;
    if (kind !== "invoice" && kind !== "quote") return json(400, { success: false, error: "Invalid request." });
    if (typeof id !== "string" || !UUID.test(id)) return json(400, { success: false, error: "Invalid request." });
    if (body.subject !== undefined && typeof body.subject !== "string") return json(400, { success: false, error: "Invalid request." });
    if (body.message !== undefined && typeof body.message !== "string") return json(400, { success: false, error: "Invalid request." });
    if (typeof body.message === "string" && body.message.length > LIMITS.message)
      return json(400, { success: false, code: "message_too_long", error: `The message can be at most ${LIMITS.message} characters.` });
    const pdf = decodePdf(body.pdf_base64);
    if ("error" in pdf) return json(400, { success: false, code: "bad_attachment", error: pdf.error });

    const cfg = documentEmailConfig(deps.env);
    if (!cfg) return json(503, { success: false, code: "not_configured", sent: "not_sent", error: "Email sending is not configured yet. Nothing was sent. Download the PDF and send it yourself." });

    const doc = await deps.loadDocument(token, kind, id).catch(() => null);
    const label = kindLabel(kind);
    if (!doc || doc.kind !== kind) return json(404, { success: false, code: "not_found", error: `This ${label} couldn't be found.` });
    if (doc.user_id !== user.id) return json(403, { success: false, code: "not_owner", error: `You can only email your own ${label}s.` });
    if (doc.archived_at) return json(409, { success: false, code: "archived", error: `Archived ${label}s can't be emailed. Restore it first.` });
    if (kind === "invoice" && String(doc.status ?? "").toLowerCase() === "paid")
      return json(409, { success: false, code: "paid", error: "This invoice is already paid, so it isn't emailed." });
    const to = (doc.client_email ?? "").trim();
    if (!to) return json(422, { success: false, code: "no_client_email", error: `This ${label} has no customer email address. Add one, then try again.` });
    if (!isEmail(to)) return json(422, { success: false, code: "invalid_client_email", error: `The customer email address on this ${label} isn't valid. Fix it, then try again.` });

    const now = (deps.now ?? (() => new Date()))();
    let counts: { user: number; document: number };
    try { counts = await deps.recentCounts(user.id, doc.id, new Date(now.getTime() - 864e5).toISOString()); }
    catch { return json(503, { success: false, code: "limit_check_failed", sent: "not_sent", error: "The sending limit couldn't be checked, so nothing was sent. Please try again later." }); }
    if (counts.user >= LIMITS.perUserPerDay)
      return json(429, { success: false, code: "user_limit", sent: "not_sent", error: `You can email up to ${LIMITS.perUserPerDay} documents in 24 hours. Nothing was sent. Try again later, or download the PDF and send it yourself.` });
    if (counts.document >= LIMITS.perDocumentPerDay)
      return json(429, { success: false, code: "document_limit", sent: "not_sent", error: `This ${label} has already been emailed ${LIMITS.perDocumentPerDay} times in 24 hours. Nothing was sent.` });

    const business = cleanName(doc.company_name);
    const fromAddr = addrOf(cfg.from);
    const replyTo = isEmail(user.email) ? user.email : undefined;
    const subject = cleanLine(typeof body.subject === "string" && body.subject.trim() ? body.subject : defaultSubject(doc), LIMITS.subject);
    const message = (typeof body.message === "string" && body.message.trim() ? body.message : defaultMessage(doc)).replace(/\r\n/g, "\n");
    const { text, html } = buildBodies(message, business);
    const mail: MixedMail = {
      from: `${encodeName(business ? `B2BNEST on behalf of ${business}` : "B2BNEST")} <${fromAddr}>`,
      to, ...(replyTo ? { replyTo } : {}), subject, text, html,
      attachment: { filename: fileNameFor(doc), contentType: "application/pdf", bytes: pdf.bytes },
    };
    const raw = buildMixedMessage(mail);
    const base = { user_id: user.id, document_kind: kind, document_id: doc.id, recipient_domain: domainOf(to) } as const;
    const record = async (status: LogStatus, stage: string | null, reply: string | null) => {
      try { await deps.log({ ...base, status, error_stage: stage, provider_reply: reply ? redactEmails(reply).replace(/\s+/g, " ").slice(0, 300) : null }); }
      catch { console.error("send-document-email: log write failed", { kind, id: doc.id, status }); }
    };

    const ms = deps.timeoutMs ?? 20_000;
    let timer: number | undefined;
    try {
      const r = await Promise.race([
        deps.send(cfg, { from: fromAddr, to }, raw),
        new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("__timeout__")), ms) as unknown as number; }),
      ]);
      await record("accepted_by_provider", null, r.reply);
      console.log("send-document-email: accepted", { kind, id: doc.id, recipient_domain: base.recipient_domain });
      return json(200, {
        success: true, status: "accepted_by_provider", sent: "accepted", recipient: to,
        message: "Accepted by the email provider. Inbox delivery isn't confirmed.",
      });
    } catch (e) {
      if (e instanceof Error && e.message === "__timeout__") {
        await record("uncertain", "timeout", "No answer from the mail server in time");
        console.error("send-document-email: timeout", { kind, id: doc.id, ms });
        return json(504, { success: false, code: "uncertain", stage: "timeout", sent: "unknown", error: UNCERTAIN });
      }
      const f = describeFailure(e);
      const safe = sanitizeError(e, cfg);
      await record(f.uncertain ? "uncertain" : "failed", f.stage, safe);
      console.error("send-document-email: provider error", { kind, id: doc.id, stage: f.stage, code: f.code, exception: safe });
      return json(f.uncertain ? 504 : 502, { success: false, code: f.code, stage: f.stage, sent: f.uncertain ? "unknown" : "not_sent", error: f.message });
    } finally { clearTimeout(timer); }
  };
}
