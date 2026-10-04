// SMTP connection check: connect, greet, sign in, quit. It never issues MAIL FROM,
// so no message can be sent. Credentials are only written to the socket.
import type { ProbeResult, SmtpConfig } from "./handler.ts";
import { sanitizeError } from "./handler.ts";

const enc = new TextEncoder(), dec = new TextDecoder();

class Lines {
  private buf = "";
  constructor(private conn: Deno.Conn) {}
  async reply(): Promise<{ code: number; text: string }> {
    const lines: string[] = [];
    while (true) {
      const i = this.buf.indexOf("\r\n");
      if (i >= 0) {
        const line = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2);
        lines.push(line);
        if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) return { code: Number(line.slice(0, 3)), text: lines.join(" | ").slice(0, 400) };
        continue;
      }
      const chunk = new Uint8Array(4096);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("Connection closed by server");
      this.buf += dec.decode(chunk.subarray(0, n));
    }
  }
}

export async function probeSmtp(cfg: SmtpConfig, timeoutMs = 15_000): Promise<ProbeResult> {
  const base = { host: cfg.hostname, port: cfg.port };
  let stage = "dns_connect";
  let conn: Deno.Conn | null = null;
  let timer: number | undefined;
  const work = (async (): Promise<ProbeResult> => {
    conn = cfg.tls
      ? await Deno.connectTls({ hostname: cfg.hostname, port: cfg.port })
      : await Deno.connect({ hostname: cfg.hostname, port: cfg.port });
    let r = new Lines(conn);
    const cmd = async (s: string) => { await conn!.write(enc.encode(s + "\r\n")); return r.reply(); };
    stage = "greeting"; let a = await r.reply();
    if (a.code !== 220) return { ok: false, stage, ...base, smtpCode: a.code, reply: a.text };
    stage = "ehlo"; a = await cmd("EHLO b2bnest.online");
    if (a.code !== 250) return { ok: false, stage, ...base, smtpCode: a.code, reply: a.text };
    if (!cfg.tls) {
      stage = "starttls"; a = await cmd("STARTTLS");
      if (a.code !== 220) return { ok: false, stage, ...base, smtpCode: a.code, reply: a.text };
      stage = "tls";
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: cfg.hostname });
      r = new Lines(conn);
      stage = "ehlo"; a = await cmd("EHLO b2bnest.online");
      if (a.code !== 250) return { ok: false, stage, ...base, smtpCode: a.code, reply: a.text };
    }
    stage = "auth"; a = await cmd("AUTH LOGIN");
    if (a.code !== 334) return { ok: false, stage, ...base, smtpCode: a.code, reply: a.text };
    a = await cmd(btoa(cfg.username));
    if (a.code !== 334) return { ok: false, stage, ...base, smtpCode: a.code, reply: a.text };
    a = await cmd(btoa(cfg.password));
    const ok = a.code === 235;
    await cmd("QUIT").catch(() => null);
    return { ok, stage: ok ? "done" : "auth", ...base, smtpCode: a.code, reply: a.text };
  })();
  try {
    return await Promise.race([
      work,
      new Promise<ProbeResult>((res) => { timer = setTimeout(() => res({ ok: false, stage, ...base, exception: `Timed out after ${timeoutMs} ms` }), timeoutMs) as unknown as number; }),
    ]);
  } catch (e) {
    return { ok: false, stage, ...base, exception: sanitizeError(e, cfg) };
  } finally {
    clearTimeout(timer);
    try { (conn as Deno.Conn | null)?.close(); } catch { /* already closed */ }
  }
}
