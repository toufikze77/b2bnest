import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { defaultMessage, defaultSubject, type Deps, type DocRow, LIMITS, type LogRow, makeHandler, UNCERTAIN, userDailyLimit } from "./handler.ts";
import { SmtpStageError } from "../workflow-send-email/smtp.ts";

// Every dependency is a fake: no mail server, no database, no network.
// The sending mailbox is whatever SMTP_FROM / SMTP_USER say (the owner's: notifications@b2bnest.online).
const ENV: Record<string, string> = {
  SMTP_USER: "notifications@b2bnest.online", SMTP_PASSWORD: "pw-not-real", SMTP_FROM: "B2BNEST Notifications <notifications@b2bnest.online>",
  SMTP_HOST: "smtp.office365.com", DOCUMENT_EMAIL_ENABLED: "true", DOCUMENT_EMAIL_ALLOWED_USERS: "u1",
};
const VERIFIED = "2026-10-01T09:00:00Z";
const ID = "0f0e0d0c-0b0a-4908-8706-050403020100";
const PDF = btoa("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const doc = (o: Partial<DocRow> = {}): DocRow => ({
  id: ID, user_id: "u1", kind: "invoice", number: "INV-1001", status: "draft", archived_at: null,
  client_email: "accounts@client.example", client_name: "Priya Shah", company_name: "Acme Trading Ltd",
  total_amount: 1250, currency: "GBP", date: "2026-11-01", ...o,
});
const req = (body: unknown, auth = "Bearer good", method = "POST") =>
  new Request("http://x", { method, headers: { Authorization: auth, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
const ok = (o: Record<string, unknown> = {}) => ({ kind: "invoice", id: ID, pdf_base64: PDF, ...o });

type Fake = Deps & { sent: { to: string; from: string; raw: string }[]; logs: LogRow[]; loads: number };
const deps = (over: Partial<Omit<Deps, "env">> & { row?: DocRow | null; vars?: Record<string, string> } = {}): Fake => {
  const d: Fake = {
    sent: [], logs: [], loads: 0,
    env: (n) => (over.vars ?? ENV)[n],
    getUser: async (t) => (t === "good" ? { id: "u1", email: "owner@acme.example", email_confirmed_at: VERIFIED } : null),
    loadDocument: async () => { d.loads++; return over.row === undefined ? doc() : over.row; },
    recentCounts: async () => ({ user: 0, document: 0 }),
    log: async (r) => { d.logs.push(r); },
    send: async (_cfg, env, raw) => { d.sent.push({ ...env, raw }); return { reply: "250 2.0.0 OK <abc@client.example> queued as 123" }; },
    timeoutMs: 50,
    ...over,
  };
  return d;
};
const call = async (d: Deps, r: Request) => { const res = await makeHandler(d)(r); return { status: res.status, body: await res.json() }; };
const decodeParts = (raw: string) => raw.split("\r\n\r\n").slice(1).map((p) => p.split("\r\n--")[0].replace(/\r\n/g, "")).filter((p) => /^[A-Za-z0-9+/=]+$/.test(p) && p.length > 8)
  .map((p) => { try { return new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0))); } catch { return ""; } });
const headers = (raw: string) => raw.split("\r\n\r\n")[0].split("\r\n");

Deno.test("no auth or bad token → 401, nothing loaded, sent or logged", async () => {
  const d = deps();
  assertEquals((await call(d, req(ok(), ""))).status, 401);
  assertEquals((await call(d, req(ok(), "Bearer bad"))).status, 401);
  assertEquals([d.loads, d.sent.length, d.logs.length], [0, 0, 0]);
});

Deno.test("GET says whether this user may send, without connecting to the mail server", async () => {
  const on = deps(); assertEquals((await call(on, req(null, "Bearer good", "GET"))).body, { configured: true, sender: "notifications@b2bnest.online" });
  const off = deps({ vars: { ...ENV, DOCUMENT_EMAIL_ENABLED: "" } }); assertEquals((await call(off, req(null, "Bearer good", "GET"))).body, { configured: false, reason: "not_configured" });
  const none = deps({ vars: {} }); assertEquals((await call(none, req(null, "Bearer good", "GET"))).body, { configured: false, reason: "not_configured" });
  const gmail = deps({ vars: { GMAIL_USER: "x@gmail.com", GMAIL_APP_PASSWORD: "p", DOCUMENT_EMAIL_ENABLED: "true", DOCUMENT_EMAIL_ALLOWED_USERS: "*" } });
  assertEquals((await call(gmail, req(null, "Bearer good", "GET"))).body, { configured: false, reason: "not_configured" });
  assertEquals((await call(on, req(null, "", "GET"))).status, 401);
  assertEquals([on.sent.length, on.loads], [0, 0]);
});

Deno.test("missing config (no SMTP_*, Gmail only, or switch off) → 503 not_configured, nothing loaded or sent", async () => {
  const envs: Record<string, string>[] = [{}, { GMAIL_USER: "x@gmail.com", GMAIL_APP_PASSWORD: "p", DOCUMENT_EMAIL_ENABLED: "true" }, { ...ENV, DOCUMENT_EMAIL_ENABLED: "false" }];
  for (const vars of envs) {
    const d = deps({ vars }); const r = await call(d, req(ok()));
    assertEquals([r.status, r.body.code, r.body.sent], [503, "not_configured", "not_sent"]);
    assert(/not configured/.test(r.body.error));
    assertEquals([d.loads, d.sent.length, d.logs.length], [0, 0, 0]);
  }
});

Deno.test("only kind, id, subject, message, pdf_base64 (and an ignored `to`) are accepted", async () => {
  for (const b of [ok({ kind: "receipt" }), ok({ id: "1" }), ok({ cc: "x@evil.example" }), ok({ bcc: ["x@evil.example"] }), ok({ subject: 5 }), [1], "x"]) {
    const d = deps(); assertEquals((await call(d, req(b))).status, 400); assertEquals(d.sent.length, 0);
  }
});

Deno.test("the recipient is the document's client_email from the database, never the `to` in the request", async () => {
  const d = deps(); const r = await call(d, req(ok({ to: "attacker@evil.example" })));
  assertEquals(r.status, 200);
  assertEquals(d.sent.length, 1);
  assertEquals(d.sent[0].to, "accounts@client.example");
  assert(headers(d.sent[0].raw).includes("To: accounts@client.example"));
  assertEquals(d.sent[0].raw.includes("evil.example"), false);
  assertEquals(r.body.recipient, "accounts@client.example");
});

Deno.test("someone else's document → 403; not visible under RLS → 404; nothing sent", async () => {
  let d = deps({ row: doc({ user_id: "someone-else" }) }); let r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [403, "not_owner", 0]);
  d = deps({ row: null }); r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [404, "not_found", 0]);
  d = deps({ row: doc({ kind: "quote" }) }); r = await call(d, req(ok()));
  assertEquals([r.status, d.sent.length], [404, 0]);
});

Deno.test("archived documents and paid invoices are never emailed", async () => {
  let d = deps({ row: doc({ archived_at: "2026-10-16T09:00:00Z" }) }); let r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length, d.logs.length], [409, "archived", 0, 0]);
  d = deps({ row: doc({ status: "paid" }) }); r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [409, "paid", 0]);
});

Deno.test("no client email or an invalid / multi-address / header-injecting one → 422, nothing sent", async () => {
  const bad = [null, "", "   ", "not-an-email", "a@b", "a@b.com, c@d.com", "a@b.com\r\nBcc: x@evil.example", "Name <a@b.com>", "a b@c.com"];
  for (const client_email of bad) {
    const d = deps({ row: doc({ client_email }) }); const r = await call(d, req(ok()));
    assertEquals(r.status, 422, String(client_email)); assertEquals(d.sent.length, 0);
    assert(["no_client_email", "invalid_client_email"].includes(r.body.code));
  }
});

Deno.test("header injection in business name, subject and client name cannot add headers", async () => {
  const d = deps({ row: doc({ company_name: "Acme\r\nBcc: evil@evil.example <x>\"", client_name: "Priya\r\nX-Evil: 1" }) });
  const r = await call(d, req(ok({ subject: "Hello\r\nBcc: evil@evil.example\nCc: evil2@evil.example" })));
  assertEquals(r.status, 200);
  const h = headers(d.sent[0].raw);
  assertEquals(h.filter((l) => /^(Bcc|Cc|X-Evil):/i.test(l)).length, 0);
  const from = h.find((l) => l.startsWith("From: "))!;
  assertEquals(from, `From: "B2BNEST on behalf of Acme Bcc: evil@evil.example x" <notifications@b2bnest.online>`);
  assertEquals((from.match(/</g) || []).length, 1);
  assert(h.includes("Subject: Hello Bcc: evil@evil.example Cc: evil2@evil.example"));
  assertEquals(h.filter((l) => l.startsWith("To: ")), ["To: accounts@client.example"]);
});

Deno.test("Reply-To is the signed-in owner's email; From is the SMTP_FROM address with the business as display name", async () => {
  const d = deps(); await call(d, req(ok()));
  const h = headers(d.sent[0].raw);
  assert(h.includes("Reply-To: owner@acme.example"));
  assert(h.includes(`From: "B2BNEST on behalf of Acme Trading Ltd" <notifications@b2bnest.online>`));
  assertEquals(d.sent[0].from, "notifications@b2bnest.online");
  const noMail = deps({ getUser: async () => ({ id: "u1", email: "bad\r\naddress", email_confirmed_at: VERIFIED }) }); await call(noMail, req(ok()));
  assertEquals(headers(noMail.sent[0].raw).some((l) => l.startsWith("Reply-To:")), false);
});

Deno.test("attachment: must be a PDF of at most 5 MB", async () => {
  const cases = [
    [undefined, "The PDF is missing."], [btoa("hello, not a pdf"), "The attachment is not a PDF."], ["!!!not base64!!!", "The PDF couldn't be read."],
    [btoa("%PDF" + "x".repeat(LIMITS.pdfBytes)), "The PDF is larger than 5 MB."],
  ] as const;
  for (const [pdf_base64, error] of cases) {
    const d = deps(); const r = await call(d, req(ok({ pdf_base64 })));
    assertEquals([r.status, r.body.code, r.body.error], [400, "bad_attachment", error]); assertEquals(d.sent.length, 0);
  }
  const d = deps(); await call(d, req(ok()));
  assert(d.sent[0].raw.includes(`Content-Disposition: attachment; filename="INV-1001.pdf"`));
  const odd = deps({ row: doc({ number: "../../etc/pass wd\r\n\"x" }) }); await call(odd, req(ok()));
  assert(odd.sent[0].raw.includes(`filename="etc-pass-wd-x.pdf"`));
});

Deno.test("message: at most 2,000 characters, escaped in HTML, no links or tracking added", async () => {
  const long = deps(); const r = await call(long, req(ok({ message: "x".repeat(2001) })));
  assertEquals([r.status, r.body.code, long.sent.length], [400, "message_too_long", 0]);
  const d = deps(); await call(d, req(ok({ message: "Hi <b>there</b> & see https://pay.example/x <img src=x>" })));
  const parts = decodeParts(d.sent[0].raw);
  const html = parts.find((p) => p.startsWith("<!doctype html>"))!;
  assert(html.includes("Hi &lt;b&gt;there&lt;/b&gt; &amp; see https://pay.example/x &lt;img src=x&gt;"));
  assertEquals(/<a\s|<img|href=/i.test(html), false);
  assert(html.includes("This email was sent via B2BNEST on behalf of Acme Trading Ltd."));
  const text = parts.find((p) => p.startsWith("Hi <b>"))!;
  assert(text.endsWith("This email was sent via B2BNEST on behalf of Acme Trading Ltd. Reply to this email to contact them."));
});

Deno.test("default subject and message are plain and say who sent it", () => {
  assertEquals(defaultSubject(doc()), "Invoice INV-1001 from Acme Trading Ltd");
  assertEquals(defaultMessage(doc()), "Hello Priya Shah,\n\nPlease find invoice INV-1001 attached, total 1,250.00 GBP, due 1 Nov 2026.\n\nSent by Acme Trading Ltd using B2BNEST.");
  assertEquals(defaultMessage(doc({ kind: "quote", number: "Q-501", date: "2026-11-15", client_name: null })),
    "Hello there,\n\nPlease find quote Q-501 attached, total 1,250.00 GBP, valid until 15 Nov 2026.\n\nSent by Acme Trading Ltd using B2BNEST.");
  assertEquals(defaultSubject(doc({ kind: "quote", number: "Q-501", company_name: null })), "Quote Q-501");
});

Deno.test("limits: 10 per user by default and 3 per document in 24 hours; a failed check sends nothing", async () => {
  let d = deps({ recentCounts: async () => ({ user: 10, document: 0 }) }); let r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [429, "user_limit", 0]);
  assert(r.body.error.startsWith("You can email up to 10 documents in 24 hours."));
  d = deps({ recentCounts: async () => ({ user: 5, document: 3 }) }); r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [429, "document_limit", 0]);
  let since = "";
  d = deps({ recentCounts: async (_u, _d, s) => { since = s; return { user: 9, document: 2 }; }, now: () => new Date("2026-10-17T12:00:00Z") });
  r = await call(d, req(ok())); assertEquals([r.status, d.sent.length, since], [200, 1, "2026-10-16T12:00:00.000Z"]);
  d = deps({ recentCounts: async () => { throw new Error("relation does not exist"); } }); r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [503, "limit_check_failed", 0]);
});

Deno.test("success: accepted_by_provider is logged with ids, domain and a redacted reply only; never 'delivered'", async () => {
  const d = deps(); const r = await call(d, req(ok({ message: "Secret body text 12345", subject: "Private subject" })));
  assertEquals([r.status, r.body.success, r.body.status, r.body.sent], [200, true, "accepted_by_provider", "accepted"]);
  assertEquals(/delivered/i.test(JSON.stringify(r.body)), false);
  assertEquals(d.logs, [{ user_id: "u1", document_kind: "invoice", document_id: ID, recipient_domain: "client.example", status: "accepted_by_provider", error_stage: null, provider_reply: "250 2.0.0 OK <[email]> queued as 123" }]);
  const logged = JSON.stringify(d.logs);
  for (const s of ["Secret body", "Private subject", "accounts@", "owner@acme"]) assertEquals(logged.includes(s), false, s);
});

Deno.test("a log write failing after the server accepted still reports the truth: sent", async () => {
  const d = deps({ log: async () => { throw new Error("db down"); } }); const r = await call(d, req(ok()));
  assertEquals([r.status, r.body.success, d.sent.length], [200, true, 1]);
});

Deno.test("SMTP failures before the message is handed over → failed, nothing sent, plain reason, status untouched", async () => {
  const cases: [Error, string, string, RegExp][] = [
    [new SmtpStageError("auth", 535, "535 5.7.139 Authentication unsuccessful"), "auth", "provider_auth_rejected", /couldn't sign in/],
    [new SmtpStageError("dns_connect", undefined, "ConnectionRefused: Connection refused"), "dns_connect", "provider_unreachable", /Couldn't connect/],
    [new SmtpStageError("rcpt_to", 550, "550 5.1.1 <accounts@client.example> recipient rejected"), "rcpt_to", "recipient_rejected", /refused the customer's email address/],
    [new SmtpStageError("mail_from", 451, "451 4.7.500 Server busy"), "mail_from", "provider_temporary", /temporarily/],
  ];
  for (const [err, stage, code, msg] of cases) {
    const d = deps({ send: async () => { throw err; } }); const r = await call(d, req(ok()));
    assertEquals([r.status, r.body.success, r.body.code, r.body.stage, r.body.sent], [502, false, code, stage, "not_sent"]);
    assert(msg.test(r.body.error), r.body.error);
    assertEquals(d.logs.map((l) => [l.status, l.error_stage]), [["failed", stage]]);
    assertEquals(JSON.stringify([r.body, d.logs]).includes("accounts@client.example"), false);
    assertEquals(JSON.stringify([r.body, d.logs]).includes("pw-not-real"), false);
  }
});

Deno.test("connection lost after DATA, or a timeout → uncertain: logged, user told to check before retrying", async () => {
  let d = deps({ send: async () => { throw new SmtpStageError("data_end", undefined, "Connection closed by server", true); } });
  let r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, r.body.sent, r.body.error], [504, "uncertain", "unknown", UNCERTAIN]);
  assertEquals(d.logs[0].status, "uncertain");
  d = deps({ send: () => new Promise((res) => setTimeout(() => res({ reply: "late" }), 120)) });
  r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, r.body.stage], [504, "uncertain", "timeout"]);
  assertEquals(d.logs.map((l) => l.status), ["uncertain"]);
  await new Promise((res) => setTimeout(res, 150));
});

// ---------- Phase 4b-2: allowlist (fail closed), verified accounts, daily limit setting ----------
const user = (id: string, confirmed: string | null = VERIFIED) => async (t: string) => (t === "good" ? { id, email: "owner@acme.example", email_confirmed_at: confirmed } : null);
const get = async (d: Deps) => (await call(d, req(null, "Bearer good", "GET"))).body;

Deno.test("allowlist unset or empty: nobody may send (GET not configured, POST 403 not_allowed, nothing loaded)", async () => {
  for (const list of [undefined, "", " , ,  "]) {
    const vars: Record<string, string> = { ...ENV }; if (list === undefined) delete vars.DOCUMENT_EMAIL_ALLOWED_USERS; else vars.DOCUMENT_EMAIL_ALLOWED_USERS = list;
    const d = deps({ vars });
    assertEquals(await get(d), { configured: false, reason: "not_allowed" });
    const r = await call(d, req(ok()));
    assertEquals([r.status, r.body.code, r.body.sent], [403, "not_allowed", "not_sent"]);
    assertEquals(r.body.error, "Email sending isn't switched on for your account yet. Nothing was sent. Download the PDF and send it yourself.");
    assertEquals([d.loads, d.sent.length, d.logs.length], [0, 0, 0]);
  }
});

Deno.test("allowlist `*` lets every verified user send", async () => {
  const d = deps({ vars: { ...ENV, DOCUMENT_EMAIL_ALLOWED_USERS: "*" }, getUser: user("someone-else-entirely") , row: doc({ user_id: "someone-else-entirely" }) });
  assertEquals((await get(d)).configured, true);
  assertEquals((await call(d, req(ok()))).status, 200);
  const unverified = deps({ vars: { ...ENV, DOCUMENT_EMAIL_ALLOWED_USERS: "*" }, getUser: user("u9", null) });
  assertEquals(await get(unverified), { configured: false, reason: "email_not_verified" });
});

Deno.test("listed ids may send (spaces trimmed, blanks ignored, case-insensitive); unlisted ids are blocked on GET and POST", async () => {
  const vars = { ...ENV, DOCUMENT_EMAIL_ALLOWED_USERS: " , AAAA-1111 ,, u1 , " };
  const listed = deps({ vars, getUser: user("aaaa-1111"), row: doc({ user_id: "aaaa-1111" }) });
  assertEquals((await get(listed)).configured, true);
  assertEquals((await call(listed, req(ok()))).status, 200);
  const other = deps({ vars, getUser: user("bbbb-2222"), row: doc({ user_id: "bbbb-2222" }) });
  assertEquals(await get(other), { configured: false, reason: "not_allowed" });
  const r = await call(other, req(ok()));
  assertEquals([r.status, r.body.code, other.sent.length, other.loads], [403, "not_allowed", 0, 0]);
});

Deno.test("unverified email address: 403 email_not_verified on POST, not available on GET, nothing sent", async () => {
  for (const confirmed of [null, undefined, ""]) {
    const d = deps({ getUser: async (t) => (t === "good" ? { id: "u1", email: "owner@acme.example", email_confirmed_at: confirmed as string | null } : null) });
    assertEquals(await get(d), { configured: false, reason: "email_not_verified" });
    const r = await call(d, req(ok()));
    assertEquals([r.status, r.body.code, d.sent.length, d.loads], [403, "email_not_verified", 0, 0]);
    assert(r.body.error.startsWith("Verify your email address to use this."));
  }
});

Deno.test("DOCUMENT_EMAIL_USER_DAILY_LIMIT: default 10, override, invalid falls back, capped at 50", () => {
  const lim = (v?: string) => userDailyLimit((n) => (n === "DOCUMENT_EMAIL_USER_DAILY_LIMIT" ? v : undefined));
  assertEquals([lim(), lim(""), lim("  ")], [10, 10, 10]);
  assertEquals([lim("1"), lim("25"), lim(" 7 ")], [1, 25, 7]);
  assertEquals([lim("0"), lim("-5"), lim("2.5"), lim("ten"), lim("1e3"), lim("12abc")], [10, 10, 10, 10, 10, 10]);
  assertEquals([lim("50"), lim("51"), lim("9999999999999999999")], [50, 50, 10]);
});

Deno.test("the per-user limit setting is used in the check and in the message", async () => {
  const vars = { ...ENV, DOCUMENT_EMAIL_USER_DAILY_LIMIT: "3" };
  let d = deps({ vars, recentCounts: async () => ({ user: 3, document: 0 }) }); let r = await call(d, req(ok()));
  assertEquals([r.status, r.body.code, d.sent.length], [429, "user_limit", 0]);
  assert(r.body.error.startsWith("You can email up to 3 documents in 24 hours."));
  d = deps({ vars, recentCounts: async () => ({ user: 2, document: 0 }) }); r = await call(d, req(ok()));
  assertEquals(r.status, 200);
  d = deps({ vars: { ...ENV, DOCUMENT_EMAIL_USER_DAILY_LIMIT: "500" }, recentCounts: async () => ({ user: 50, document: 0 }) }); r = await call(d, req(ok()));
  assert(r.body.error.startsWith("You can email up to 50 documents in 24 hours."));
});

Deno.test("GET reveals only the sender address: no display name, host, port, user name or secret", async () => {
  const vars = { ...ENV, SMTP_USER: "smtp-login-name@b2bnest.online", SMTP_PASSWORD: "S3cr3t-pass-123", SMTP_FROM: "Platform Display Name <notifications@b2bnest.online>", SMTP_PORT: "587" };
  const body = await get(deps({ vars }));
  assertEquals(body, { configured: true, sender: "notifications@b2bnest.online" });
  const text = JSON.stringify(body);
  for (const leak of ["Platform Display Name", "smtp.office365.com", "587", "smtp-login-name", "S3cr3t", "pw-not-real"]) assertEquals(text.includes(leak), false, leak);
  // SMTP_FROM unset: the address falls back to SMTP_USER.
  const fallback = { ...ENV, SMTP_FROM: "" }; delete (fallback as Record<string, string>).SMTP_FROM;
  assertEquals(await get(deps({ vars: fallback })), { configured: true, sender: "notifications@b2bnest.online" });
  // A From without a usable address counts as not configured: nothing echoed, nothing sent.
  const broken = deps({ vars: { ...ENV, SMTP_FROM: "Just a name" } });
  assertEquals(await get(broken), { configured: false, reason: "not_configured" });
  assertEquals([(await call(broken, req(ok()))).status, broken.sent.length], [503, 0]);
  // Not allowed: no sender at all.
  assertEquals(await get(deps({ vars: { ...ENV, DOCUMENT_EMAIL_ALLOWED_USERS: "" } })), { configured: false, reason: "not_allowed" });
});
