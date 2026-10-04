import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { makeHandler, Deps } from "./handler.ts";

const ENV: Record<string, string> = { GMAIL_USER: "sender@example.com", GMAIL_APP_PASSWORD: "x" };
const req = (body: unknown, auth = "Bearer good") =>
  new Request("http://x", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ok = { to: "me@example.com", subject: "Hi", body: "Hello" };
const deps = (over: Partial<Deps> = {}): Deps & { sent: number } => {
  const d = {
    sent: 0,
    env: (n: string) => ENV[n],
    getUser: async (t: string) => (t === "good" ? { id: "u1" } : null),
    send: async () => { d.sent++; },
    timeoutMs: 50,
    ...over,
  };
  return d;
};

Deno.test("accepted by provider → success, labelled as accepted not delivered", async () => {
  const d = deps(); const r = await makeHandler(d)(req(ok)); const b = await r.json();
  assertEquals(r.status, 200); assertEquals(b.success, true); assertEquals(b.status, "accepted"); assertEquals(d.sent, 1);
});

Deno.test("provider rejects sign-in (Gmail 534 WebLoginRequired) → failure with safe reason, sent once", async () => {
  let calls = 0;
  const d = deps({ send: async () => { calls++; throw new Error("534: 5.7.9 Please log in with your web browser WebLoginRequired"); } });
  const r = await makeHandler(d)(req(ok)); const b = await r.json();
  assertEquals(r.status, 502); assertEquals(b.success, false); assertEquals(b.code, "provider_auth_rejected"); assertEquals(calls, 1);
  assertEquals(JSON.stringify(b).includes("WebLoginRequired"), false);
});

Deno.test("provider refuses message (550) → failure", async () => {
  const r = await makeHandler(deps({ send: async () => { throw new Error("550 5.1.1 mailbox unavailable"); } }))(req(ok));
  assertEquals(r.status, 502); assertEquals((await r.json()).code, "provider_rejected");
});

Deno.test("missing configuration → 503, nothing sent", async () => {
  const d = deps({ env: () => undefined }); const r = await makeHandler(d)(req(ok)); const b = await r.json();
  assertEquals(r.status, 503); assertEquals(b.code, "not_configured"); assertEquals(d.sent, 0);
});

Deno.test("provider timeout → 504, no retry", async () => {
  let calls = 0;
  const d = deps({ send: () => { calls++; return new Promise((res) => setTimeout(res, 200)); } });
  const r = await makeHandler(d)(req(ok)); const b = await r.json();
  assertEquals(r.status, 504); assertEquals(b.code, "timeout"); assertEquals(calls, 1);
  await new Promise((res) => setTimeout(res, 220));
});

Deno.test("signed-out or bad token → 401, nothing sent", async () => {
  const d = deps();
  assertEquals((await makeHandler(d)(req(ok, "Bearer bad"))).status, 401);
  assertEquals((await makeHandler(d)(req(ok, ""))).status, 401);
  assertEquals(d.sent, 0);
});

Deno.test("SMTP_* (Office 365) settings take priority over Gmail", async () => {
  let host = "";
  const env: Record<string, string> = { ...ENV, SMTP_USER: "notifications@b2bnest.online", SMTP_PASSWORD: "p" };
  await makeHandler(deps({ env: (n) => env[n], send: async (c) => { host = c.hostname; } }))(req(ok));
  assertEquals(host, "smtp.office365.com");
});

import { closeQuietly, classifySmtpError, sanitizeError, UNKNOWN_STATUS } from "./handler.ts";

Deno.test("timeout → 'Delivery status unknown', never 'Nothing was sent'", async () => {
  const d = deps({ send: () => new Promise((res) => setTimeout(res, 200)) });
  const b = await (await makeHandler(d)(req(ok))).json();
  assertEquals(b.error, UNKNOWN_STATUS); assertEquals(b.sent, "unknown");
  await new Promise((res) => setTimeout(res, 220));
});

Deno.test("unexplained exception → status unknown, not 'Nothing was sent'", async () => {
  const r = await makeHandler(deps({ send: async () => { throw new TypeError("Cannot read properties of undefined (reading 'catch')"); } }))(req(ok));
  const b = await r.json();
  assertEquals(r.status, 502); assertEquals(b.sent, "unknown"); assertEquals(b.error.includes("Nothing was sent"), false);
  assertEquals(b.error.includes(UNKNOWN_STATUS), true);
});

Deno.test("DNS / connection refused / TLS → confirmed not sent", () => {
  assertEquals(classifySmtpError(Object.assign(new Error("failed to lookup address"), { name: "NotFound" })).code, "provider_unreachable");
  assertEquals(classifySmtpError(Object.assign(new Error("Connection refused (os error 111)"), { name: "ConnectionRefused" })).sent, "not_sent");
  assertEquals(classifySmtpError(Object.assign(new Error("invalid peer certificate"), { name: "InvalidData" })).code, "provider_tls_error");
});

Deno.test("real Gmail 534 text from the live server → auth rejected, not sent", () => {
  const c = classifySmtpError(new Error("534: 5.7.9 Please log in with your web browser and then try again. For more,5.7.9 information, go to,5.7.9 https://support.google.com/mail/?p=WebLoginRequired x - gsmtp"));
  assertEquals(c.code, "provider_auth_rejected"); assertEquals(c.sent, "not_sent");
});

Deno.test("sanitizeError removes the password and username, plain and base64", () => {
  const s = sanitizeError(new Error(`bad pw hunter2 ${btoa("hunter2")} user me@x.co`), { username: "me@x.co", password: "hunter2" });
  assertEquals(s.includes("hunter2"), false); assertEquals(s.includes(btoa("hunter2")), false); assertEquals(s.includes("me@x.co"), false);
});

Deno.test("closeQuietly copes with a synchronous close() (the live bug) and a throwing one", async () => {
  await closeQuietly({ close: () => undefined });
  await closeQuietly({ close: () => { throw new Error("closed"); } });
  await closeQuietly({ close: async () => { throw new Error("closed"); } });
});

Deno.test("connection check: admins only, never sends mail", async () => {
  let probed = 0;
  const base = { probe: async () => { probed++; return { ok: false, stage: "auth", host: "h", port: 465, smtpCode: 534 }; } };
  const noAdmin = deps({ ...base, isSuperAdmin: async () => false });
  assertEquals((await makeHandler(noAdmin)(req({ probe: true }))).status, 403);
  const admin = deps({ ...base, isSuperAdmin: async () => true });
  const b = await (await makeHandler(admin)(req({ probe: true }))).json();
  assertEquals(b.probe.smtpCode, 534); assertEquals(b.sent, false); assertEquals(probed, 1);
  assertEquals(noAdmin.sent + admin.sent, 0);
});

import { redactEmails } from "./handler.ts";
Deno.test("email addresses are redacted from provider replies and logged errors", () => {
  assertEquals(redactEmails("550 5.1.1 <bob.smith+x@example.co.uk> unknown"), "550 5.1.1 <[email]> unknown");
  assertEquals(sanitizeError(new Error("stage=rcpt_to 550 jane@corp.com rejected")).includes("jane@corp.com"), false);
});
