// Mail helpers for the workflow email step (request handling is in request.ts). Also imported by the email
// senders (onboarding-email-sender, support-email-sender, send-document-email). Dependencies are injected so
// tests never contact a real mail server.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface SmtpConfig { hostname: string; port: number; tls: boolean; username: string; password: string; from: string; provider: string }
export interface Mail {
  from: string; to: string[]; subject: string; content?: string; html?: string;
  /** Optional Reply-To (workflow emails only). Omitted, the message is exactly as before for every other sender. */
  replyTo?: string;
}

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
  /** The signed-in user. `email` and `email_confirmed_at` come from the auth server, never from the request. */
  getUser: (token: string) => Promise<{ id: string; email?: string | null; email_confirmed_at?: string | null } | null>;
  env: (name: string) => string | undefined;
  send: (cfg: SmtpConfig, mail: Mail) => Promise<void>;
  isSuperAdmin?: (userId: string) => Promise<boolean>;
  probe?: (cfg: SmtpConfig) => Promise<ProbeResult>;
  timeoutMs?: number;
}

export const UNKNOWN_STATUS = "Delivery status unknown. Check your inbox before trying again.";

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

/** Replaces anything that looks like an email address (provider replies can echo recipients). */
export function redactEmails(s: string): string {
  return s.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[email]");
}

/** Exception text safe for logs: credentials, their base64 forms and email addresses removed, length capped. */
export function sanitizeError(e: unknown, cfg?: Pick<SmtpConfig, "username" | "password">): string {
  const name = e instanceof Error ? e.name : typeof e;
  let msg = e instanceof Error ? e.message : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
  for (const s of [cfg?.password, cfg?.username]) {
    if (!s || s.length < 4) continue; // very short test values would mangle ordinary words
    const b64 = (() => { try { return btoa(s); } catch { return ""; } })();
    msg = msg.split(s).join("[redacted]");
    if (b64) msg = msg.split(b64).join("[redacted]");
  }
  return redactEmails(`${name}: ${msg}`).replace(/\s+/g, " ").slice(0, 400);
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
  const st = raw.match(/stage=(\w+)/)?.[1];
  if (st && !["data_end", "quit"].includes(st))
    return { code: "provider_error", sent: "not_sent", message: `The email provider connection broke before the message was handed over (${st}). Nothing was sent.` };
  return { code: "provider_error", sent: "unknown", message: `The email provider connection failed unexpectedly. ${UNKNOWN_STATUS}` };
}

/** Closes an SMTP client whose close() may be sync, async or throwing, without masking the send result. */
export async function closeQuietly(client: { close: () => unknown }): Promise<void> {
  try { await client.close(); } catch { /* connection already closed */ }
}
