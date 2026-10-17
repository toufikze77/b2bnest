// Minimal SMTP sender that records the exact stage and server reply of any failure.
// Replaces denomailer, whose "invalid cmd" error hid which command failed and what
// the server answered. Same connect/auth sequence as the proven probe.
import type { Mail, SmtpConfig } from "./handler.ts";

const enc = new TextEncoder(), dec = new TextDecoder();

const b64utf8 = (s: string) => {
  const bytes = enc.encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`);
const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim();

export class SmtpStageError extends Error {
  constructor(public stage: string, public smtpCode: number | undefined, reply: string, public afterData = false) {
    super(`stage=${stage}${smtpCode ? ` ${smtpCode}` : ""} ${reply}`.trim());
    this.name = "SmtpStageError";
  }
}

export function buildMessage(mail: Mail, domain = "b2bnest.online"): string {
  const html = mail.html !== undefined;
  const body = html ? mail.html! : (mail.content ?? "");
  return [
    `From: ${mail.from}`,
    `To: ${mail.to.join(", ")}`,
    `Subject: ${encWord(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: text/${html ? "html" : "plain"}; charset=UTF-8`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64utf8(body)),
  ].join("\r\n");
}

/** A message with a plain-text and HTML body (multipart/alternative) plus one attachment. */
export interface MixedMail {
  /** Full From header value, e.g. `"B2BNEST on behalf of Acme" <info@b2bnest.online>`. */
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachment: { filename: string; contentType: string; bytes: Uint8Array };
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const bytesB64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * multipart/mixed message: text + HTML alternatives and one attachment. A new builder so
 * `buildMessage` (single body, used by the existing senders) stays exactly as it was.
 * Every header value is folded to one line, so a stray CR/LF can never add a header.
 */
export function buildMixedMessage(mail: MixedMail, domain = "b2bnest.online"): string {
  const id = crypto.randomUUID().replace(/-/g, "");
  const mixed = `mixed_${id}`, alt = `alt_${id}`;
  const file = oneLine(mail.attachment.filename).replace(/["\\]/g, "");
  return [
    `From: ${oneLine(mail.from)}`,
    `To: ${oneLine(mail.to)}`,
    ...(mail.replyTo ? [`Reply-To: ${oneLine(mail.replyTo)}`] : []),
    `Subject: ${encWord(oneLine(mail.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64utf8(mail.text)),
    `--${alt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64utf8(mail.html)),
    `--${alt}--`,
    "",
    `--${mixed}`,
    `Content-Type: ${oneLine(mail.attachment.contentType)}; name="${file}"`,
    `Content-Disposition: attachment; filename="${file}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(bytesB64(mail.attachment.bytes)),
    `--${mixed}--`,
    "",
  ].join("\r\n");
}

/**
 * Sends `mail` over SMTP. `raw`, when given, is the complete message to send (e.g. from
 * buildMixedMessage); the envelope still comes from `mail.from` / `mail.to`. Without it the
 * message is buildMessage(mail), exactly as before.
 */
export async function sendSmtp(cfg: SmtpConfig, mail: Mail, raw?: string): Promise<{ reply: string }> {
  let stage = "dns_connect";
  let conn: Deno.Conn | null = null;
  let buf = "";
  const reply = async () => {
    const lines: string[] = [];
    while (true) {
      const i = buf.indexOf("\r\n");
      if (i >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2); lines.push(line);
        if (/^\d{3}( |$)/.test(line)) return { code: Number(line.slice(0, 3)), text: lines.join(" | ").slice(0, 400) };
        continue;
      }
      const chunk = new Uint8Array(4096);
      const n = await conn!.read(chunk);
      if (n === null) throw new SmtpStageError(stage, undefined, "Connection closed by server", stage === "data_end");
      buf += dec.decode(chunk.subarray(0, n));
    }
  };
  const cmd = async (s: string, ok: number[]) => {
    await conn!.write(enc.encode(s + "\r\n"));
    const a = await reply();
    if (!ok.includes(a.code)) throw new SmtpStageError(stage, a.code, a.text, stage === "data_end");
    return a;
  };
  try {
    conn = cfg.tls ? await Deno.connectTls({ hostname: cfg.hostname, port: cfg.port }) : await Deno.connect({ hostname: cfg.hostname, port: cfg.port });
    stage = "greeting"; const g = await reply();
    if (g.code !== 220) throw new SmtpStageError(stage, g.code, g.text);
    stage = "ehlo"; await cmd("EHLO b2bnest.online", [250]);
    if (!cfg.tls) {
      stage = "starttls"; await cmd("STARTTLS", [220]);
      stage = "tls"; conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: cfg.hostname }); buf = "";
      stage = "ehlo"; await cmd("EHLO b2bnest.online", [250]);
    }
    stage = "auth"; await cmd("AUTH LOGIN", [334]); await cmd(btoa(cfg.username), [334]); await cmd(btoa(cfg.password), [235]);
    stage = "mail_from"; await cmd(`MAIL FROM:<${addr(mail.from)}>`, [250]);
    stage = "rcpt_to"; for (const r of mail.to) await cmd(`RCPT TO:<${addr(r)}>`, [250, 251]);
    stage = "data"; await cmd("DATA", [354]);
    stage = "data_end";
    const msg = (raw ?? buildMessage(mail)).split("\r\n").map((l) => (l.startsWith(".") ? "." + l : l)).join("\r\n");
    const done = await cmd(`${msg}\r\n.`, [250]);
    stage = "quit"; await cmd("QUIT", [221]).catch(() => null);
    return { reply: done.text };
  } catch (e) {
    if (e instanceof SmtpStageError) throw e;
    const m = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    throw new SmtpStageError(stage, undefined, m, stage === "data_end");
  } finally {
    try { conn?.close(); } catch { /* already closed */ }
  }
}
