// TEMPORARY diagnostic (to be deleted right after use). Signs in to the configured
// mail server and quits (no MAIL FROM, nothing sent). Only if sign-in is refused does it
// replay the real send path, which cannot deliver without a successful sign-in, to
// capture the exact library exception. Secrets are never returned.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { resolveSmtp, sanitizeError, classifySmtpError } from "./handler.ts";
import { probeSmtp } from "./probe.ts";

Deno.serve(async () => {
  const cfg = resolveSmtp((n) => Deno.env.get(n));
  if (!cfg) return Response.json({ configured: false });
  const probe = await probeSmtp(cfg);
  const out: Record<string, unknown> = {
    provider: cfg.provider, host: cfg.hostname, port: cfg.port,
    senderDomain: cfg.from.split("@")[1] ?? "(none)", usernameMatchesSender: cfg.username === cfg.from,
    passwordLength: cfg.password.length, passwordHasSpaces: /\s/.test(cfg.password),
    probe,
  };
  if (!probe.ok && probe.stage === "auth" && probe.smtpCode && probe.smtpCode >= 500) {
    const client = new SMTPClient({ connection: { hostname: cfg.hostname, port: cfg.port, tls: cfg.tls, auth: { username: cfg.username, password: cfg.password } } });
    try {
      await client.send({ from: cfg.from, to: [cfg.from], subject: "x", content: "x" });
      out.libraryResult = "UNEXPECTED: accepted";
    } catch (e) {
      out.libraryException = sanitizeError(e, cfg);
      out.libraryErrorIsError = e instanceof Error;
      out.classified = classifySmtpError(e);
    } finally { try { await client.close(); } catch (e) { out.closeException = sanitizeError(e, cfg); } }
  }
  return Response.json(out);
});
