// Pure request logic for the workflow email step. Dependencies are injected so
// tests never contact a real mail server.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface SmtpConfig { hostname: string; port: number; tls: boolean; username: string; password: string; from: string; provider: string }
export interface Mail { from: string; to: string[]; subject: string; content?: string; html?: string }

/** Result of a connection check that signs in and quits. It never sends a message. */
export interface ProbeResult {
  ok: boolean;
  /** Last stage reached: dns_connect, tls, greeting, ehlo, starttls, auth, done */
  stage: string;
  host: string;
  port: number;
  /** SMTP reply code of the last server answer, if any. */
  smtpCode?: number;
  /** Server's answer text (servers never echo credentials). */
  reply?: string;
  /** Underlying exception name/message for network or TLS failures. */
  exception?: string;
}

export interface Deps {
  getUser: (token: string) => Promise<{ id: string } | null>;
  env: (name: string) => string | undefined;
  send: (cfg: SmtpConfig, mail: Mail) => Promise<void>;
  isSuperAdmin?: (userId: string) => Promise<boolean>;
  probe?: (cfg: SmtpConfig) => Promise<ProbeResult>;
  timeoutMs?: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UNKNOWN_STATUS = "Delivery status unknown. Check your inbox before trying again.";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

/** Picks the mail server. Generic SMTP_* settings (e.g. Office 365) win over the older Gmail settings. */
export function resolveSmtp(env: Deps["env"]): SmtpConfig | null {
  const user = env("SMTP_USER"), pass = env("SMTP_PASSWORD");
  if (user && pass) {
    const port = Number(env("SMTP_PORT") || 587);
    return {
      hostname: env("SMTP_HOST") || "smtp.office365.com", port, tls: port === 465,
      username: user, password: pass, from: env("SMTP_FROM") || user, provider: "smtp",
    };
  }
  const gu = env("GMAIL_USER"), gp = env("GMAIL_APP_PASSWORD");
  if (gu && gp) return { hostname: "smtp.gmail.com", port: 465, tls: true, username: gu, password: gp, from: gu, provider: "gmail" };
  return null;
}

/** Exception text safe for logs: credentials and their base64 forms removed, length capped. */
export function sanitizeError(e: unknown, cfg?: Pick<SmtpConfig, "username" | "password">): string {
  const name = e instanceof Error ? e.name : typeof e;
  let msg = e instanceof Error ? e.message : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
  for (const s of [cfg?.password, cfg?.username]) {
    if (!s || s.length < 4) continue; // very short test values would mangle ordinary words
    const b64 = (() => { try { return btoa(s); } catch { return ""; } })();
    msg = msg.split(s).join("[redacted]");
    if (b64) msg = msg.split(b64).join("[redacted]");
  }
  return `${name}: ${msg}`.replace(/\s+/g, " ").slice(0, 400);
}

export type SentState = "not_sent" | "unknown";

/**
 * Turns a mail-server error into a short, safe reason (never includes credentials).
 * "Nothing was sent" is only claimed when the server refused with an SMTP reply code
 * or the connection was never opened.
 */
export function classifySmtpError(e: unknown): { code: string; message: string; sent: SentState } {
  const raw = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  const m = raw.match(/\b([45]\d\d)\b[:\s-]*([45]\.\d{1,3}\.\d{1,3})?/);
  const status = m ? `${m[1]}${m[2] ? ` ${m[2]}` : ""}` : "";
  if (m && (/^53[45]$/.test(m[1]) || /^5\.7\.(8|9|3|139)$/.test(m[2] ?? "") || /WebLoginRequired|Authentication unsuccessful|SmtpClientAuthentication|BadCredentials/i.test(raw)))
    return { code: "provider_auth_rejected", sent: "not_sent", message: `The email provider rejected the sender account's sign-in (${status}). The sending account's settings need fixing. Nothing was sent.` };
  if (m && m[1].startsWith("5")) return { code: "provider_rejected", sent: "not_sent", message: `The email provider refused the message (${status}). Nothing was sent.` };
  if (m && m[1].startsWith("4")) return { code: "provider_temporary", sent: "not_sent", message: `The email provider is temporarily refusing mail (${status}). Nothing was sent; try again later.` };
  if (/NotFound|failed to lookup|dns error|ConnectionRefused|Connection refused|PermissionDenied|NetworkUnreachable|AddrNotAvailable/i.test(raw))
    return { code: "provider_unreachable", sent: "not_sent", message: "Couldn't connect to the email provider. Nothing was sent." };
  if (/InvalidData|certificate|tls|handshake/i.test(raw))
    return { code: "provider_tls_error", sent: "not_sent", message: "A secure connection to the email provider couldn't be set up. Nothing was sent." };
  return { code: "provider_error", sent: "unknown", message: `The email provider connection failed unexpectedly. ${UNKNOWN_STATUS}` };
}

/** Closes an SMTP client whose close() may be sync, async or throwing, without masking the send result. */
export async function closeQuietly(client: { close: () => unknown }): Promise<void> {
  try { await client.close(); } catch { /* connection already closed */ }
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(401, { success: false, error: "Please sign in again." });
    const user = await deps.getUser(auth.slice(7).trim()).catch(() => null);
    if (!user) return json(401, { success: false, error: "Please sign in again." });

    let body: { to?: unknown; subject?: unknown; body?: unknown; html?: unknown; probe?: unknown };
    try { body = await req.json(); } catch { return json(400, { success: false, error: "Invalid request." }); }

    // Connection check for platform admins: signs in to the mail server and quits. Never sends mail.
    if (body.probe === true) {
      const admin = deps.isSuperAdmin ? await deps.isSuperAdmin(user.id).catch(() => false) : false;
      if (!admin) return json(403, { success: false, error: "Only platform admins can run the connection check." });
      const cfg = resolveSmtp(deps.env);
      if (!cfg) return json(503, { success: false, code: "not_configured", error: "Email sending isn't set up on the server yet." });
      if (!deps.probe) return json(501, { success: false, error: "Connection check unavailable." });
      const p = await deps.probe(cfg);
      console.log("workflow-send-email: probe", { provider: cfg.provider, ...p });
      return json(200, { success: p.ok, provider: cfg.provider, probe: p, sent: false });
    }

    const to = (Array.isArray(body.to) ? body.to : String(body.to ?? "").split(","))
      .map((r) => String(r).trim()).filter(Boolean);
    const subject = String(body.subject ?? "").trim(), text = String(body.body ?? "");
    if (!to.length || !subject || !text.trim()) return json(400, { success: false, error: "To, subject and message are required." });
    if (to.length > 10 || !to.every((r) => EMAIL.test(r))) return json(400, { success: false, error: "Check the email addresses (up to 10)." });

    const cfg = resolveSmtp(deps.env);
    if (!cfg) return json(503, { success: false, code: "not_configured", sent: "not_sent", error: "Email sending isn't set up on the server yet. Nothing was sent." });

    const mail: Mail = { from: cfg.from, to, subject: subject.slice(0, 500), ...(body.html === true ? { html: text.slice(0, 100_000) } : { content: text.slice(0, 100_000) }) };
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
        return json(504, { success: false, code: "timeout", sent: "unknown", error: UNKNOWN_STATUS });
      }
      const c = classifySmtpError(e);
      console.error("workflow-send-email: provider error", {
        provider: cfg.provider, host: cfg.hostname, port: cfg.port, code: c.code, sent: c.sent,
        exception: sanitizeError(e, cfg),
      });
      return json(502, { success: false, code: c.code, sent: c.sent, error: c.message });
    } finally { clearTimeout(timer); }

    console.log("workflow-send-email: accepted", { provider: cfg.provider, recipients: to.length });
    return json(200, { success: true, status: "accepted", message: "Accepted by the email provider. Inbox delivery isn't confirmed." });
  };
}
