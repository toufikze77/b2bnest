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
  assertEquals(b.error.includes("x"), true); // has message
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
