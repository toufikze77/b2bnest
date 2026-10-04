// Pure request logic for the workflow email step. Dependencies are injected so
// tests never contact a real mail server.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface SmtpConfig { hostname: string; port: number; tls: boolean; username: string; password: string; from: string; provider: string }
export interface Mail { from: string; to: string[]; subject: string; content?: string; html?: string }

export interface Deps {
  getUser: (token: string) => Promise<{ id: string } | null>;
  env: (name: string) => string | undefined;
  send: (cfg: SmtpConfig, mail: Mail) => Promise<void>;
  timeoutMs?: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Turns a mail-server error into a short, safe reason (never includes credentials). */
export function classifySmtpError(e: unknown): { code: string; message: string } {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.match(/\b(5\d\d|4\d\d)\b[:\s]*([\d.]*)/);
  const status = m ? `${m[1]}${m[2] ? ` ${m[2]}` : ""}` : "";
  if (/^53[45]|5\.7\.(8|9|3|139)|WebLoginRequired|Authentication unsuccessful|SmtpClientAuthentication/i.test(raw) || /^53[45]/.test(m?.[1] ?? ""))
    return { code: "provider_auth_rejected", message: `The email provider rejected the sender account's sign-in (${status || "auth error"}). The sending account's settings need fixing; nothing was sent.` };
  if (m && m[1].startsWith("5")) return { code: "provider_rejected", message: `The email provider refused the message (${status}). Nothing was sent.` };
  if (m && m[1].startsWith("4")) return { code: "provider_temporary", message: `The email provider is temporarily refusing mail (${status}). Nothing was sent; try again later.` };
  return { code: "provider_error", message: "Couldn't reach the email provider. Nothing was sent." };
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json(401, { success: false, error: "Please sign in again." });
    const user = await deps.getUser(auth.slice(7).trim()).catch(() => null);
    if (!user) return json(401, { success: false, error: "Please sign in again." });

    let body: { to?: unknown; subject?: unknown; body?: unknown; html?: unknown };
    try { body = await req.json(); } catch { return json(400, { success: false, error: "Invalid request." }); }
    const to = (Array.isArray(body.to) ? body.to : String(body.to ?? "").split(","))
      .map((r) => String(r).trim()).filter(Boolean);
    const subject = String(body.subject ?? "").trim(), text = String(body.body ?? "");
    if (!to.length || !subject || !text.trim()) return json(400, { success: false, error: "To, subject and message are required." });
    if (to.length > 10 || !to.every((r) => EMAIL.test(r))) return json(400, { success: false, error: "Check the email addresses (up to 10)." });

    const cfg = resolveSmtp(deps.env);
    if (!cfg) return json(503, { success: false, code: "not_configured", error: "Email sending isn't set up on the server yet. Nothing was sent." });

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
        console.error("workflow-send-email: provider timeout", { provider: cfg.provider });
        return json(504, { success: false, code: "timeout", error: "The email provider didn't answer in time. It may or may not have been sent — check before running again." });
      }
      const c = classifySmtpError(e);
      console.error("workflow-send-email: provider error", { provider: cfg.provider, code: c.code, reason: c.message });
      return json(502, { success: false, code: c.code, error: c.message });
    } finally { clearTimeout(timer); }

    console.log("workflow-send-email: accepted", { provider: cfg.provider, recipients: to.length });
    return json(200, { success: true, status: "accepted", message: "Accepted by the email provider. Inbox delivery isn't confirmed." });
  };
}
