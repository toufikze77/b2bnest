import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { makeHandler, buildEmail, BeforeDataError, smtpOnly, ticketLink, type Claimed, type Deps } from "./handler.ts";

const row = (o: Partial<Claimed> = {}): Claimed => ({ id: "1", kind: "public_reply", recipient_user_id: "u", attempts: 1,
  support_name: "Acme Support", reference: "T-00001", subject: "Printer", reply_body: "We fixed it", ...o });
const req = () => new Request("http://x", { method: "POST", headers: { Authorization: "Bearer svc" } });
function deps(rows: Claimed[], send: Deps["send"], env: Record<string, string> = { SUPPORT_EMAIL_ENABLED: "true" }) {
  const finished: [string, string][] = []; const sent: string[] = [];
  const d: Deps = { env: (n) => env[n], isServiceCall: (h) => h === "Bearer svc", claim: async () => rows,
    finish: async (id, o) => { finished.push([id, o]); }, recipientEmail: async () => "k@client.test",
    send: async (to, s, t) => { sent.push(t); return await send(to, s, t); } };
  return { d, finished, sent };
}

Deno.test("inert unless SUPPORT_EMAIL_ENABLED=true: claims and sends nothing", async () => {
  let claimed = false; const { d } = deps([row()], async () => "250");
  d.env = () => undefined; d.claim = async () => { claimed = true; return []; };
  const r = await (await makeHandler(d)(req())).json();
  assertEquals(r.status, "disabled"); assertEquals(claimed, false);
});
Deno.test("rejects non-service callers", async () => {
  const { d } = deps([], async () => "250");
  assertEquals((await makeHandler(d)(new Request("http://x"))).status, 401);
});
Deno.test("accepted -> accepted_by_provider", async () => {
  const { d, finished } = deps([row()], async () => "250 2.0.0 queued");
  await makeHandler(d)(req()); assertEquals(finished, [["1", "accepted_by_provider"]]);
});
Deno.test("failure before DATA -> failed (retryable)", async () => {
  const { d, finished } = deps([row()], async () => { throw new BeforeDataError("421"); });
  await makeHandler(d)(req()); assertEquals(finished, [["1", "failed"]]);
});
Deno.test("timeout/after DATA -> uncertain (never auto-resent)", async () => {
  const { d, finished } = deps([row()], async () => { throw new Error("timed out after DATA"); });
  await makeHandler(d)(req()); assertEquals(finished, [["1", "uncertain"]]);
});
Deno.test("reply without public body is cancelled, not sent", async () => {
  const { d, finished, sent } = deps([row({ reply_body: null })], async () => "250");
  await makeHandler(d)(req()); assertEquals(finished, [["1", "cancelled"]]); assertEquals(sent.length, 0);
});
Deno.test("email is plain text, has no attachments, and points to the portal", () => {
  const m = buildEmail(row({ subject: "Line1\r\nBcc: evil@x" }), "https://p/portal");
  assert(!m.subject.includes("\n")); assert(m.text.includes("https://p/portal")); assert(m.text.includes("only available in the portal"));
});
Deno.test("reply email carries no reply text, only the portal link", () => {
  const m = buildEmail(row({ reply_body: "CONFIDENTIAL quote 1234" }), "https://p/portal");
  assert(!m.text.includes("CONFIDENTIAL")); assert(!m.subject.includes("CONFIDENTIAL")); assert(m.text.includes("https://p/portal"));
});

Deno.test("status email: status only, no message text; feedback line only when closed and switched on", () => {
  const m = buildEmail(row({ kind: "status_change", reply_body: "SECRET", ticket_status: "closed", feedback_enabled: true }), "https://p");
  assert(m.subject.includes("Closed")); assert(!m.text.includes("SECRET")); assert(m.text.includes("rate"));
  assert(!buildEmail(row({ kind: "status_change", ticket_status: "open", feedback_enabled: true }), "https://p").text.includes("rate"));
});

Deno.test("link opens the right company and ticket; carries no ticket text", async () => {
  const { d, sent } = deps([row({ organization_id: "org-1", ticket_id: "t-9", reply_body: "SECRET" })], async () => "250");
  await makeHandler(d)(req());
  assert(sent[0].includes("https://www.b2bnest.online/support/portal?org=org-1&ticket=t-9")); assert(!sent[0].includes("SECRET"));
  assertEquals(ticketLink("https://p/portal", {}), "https://p/portal");
});
Deno.test("only SMTP_* (Microsoft 365) settings are accepted; Gmail fallback and missing settings refused before sending", () => {
  assertEquals(smtpOnly({ provider: "smtp" }).provider, "smtp");
  let e1: unknown, e2: unknown;
  try { smtpOnly({ provider: "gmail" }); } catch (e) { e1 = e; }
  try { smtpOnly(null); } catch (e) { e2 = e; }
  assert(e1 instanceof BeforeDataError); assert(e2 instanceof BeforeDataError);
});

// Phase 10: off by default, service role only, links only.
Deno.test("disabled unless SUPPORT_EMAIL_ENABLED is exactly 'true': no claim, no SMTP", async () => {
  for (const v of [undefined, "", "TRUE", "1", "yes", " true"]) {
    let claimed = 0; let sends = 0;
    const { d } = deps([row()], async () => { sends++; return "250"; }, v === undefined ? {} : { SUPPORT_EMAIL_ENABLED: v });
    d.claim = async () => { claimed++; return [row()]; };
    const res = await makeHandler(d)(req());
    assertEquals(await res.json(), { status: "disabled", sent: 0 });
    assertEquals([claimed, sends], [0, 0]);
  }
});
Deno.test("non-service callers get 401 and nothing is claimed, even when switched on", async () => {
  for (const h of [null, "Bearer anon-key", "svc"]) {
    let claimed = 0;
    const { d } = deps([row()], async () => "250");
    d.claim = async () => { claimed++; return []; };
    const r = new Request("http://x", { method: "POST", headers: h === null ? {} : { Authorization: h } });
    assertEquals((await makeHandler(d)(r)).status, 401); assertEquals(claimed, 0);
  }
});
Deno.test("each email body carries exactly one link, the portal link", () => {
  const urls = (t: string) => t.match(/https?:\/\/\S+/g) ?? [];
  for (const kind of ["acknowledgement", "public_reply", "status_change"] as const) {
    const m = buildEmail(row({ kind, ticket_status: "open", reply_body: "visit https://evil.test now" }), "https://www.b2bnest.online/support/portal?org=o&ticket=t");
    assertEquals(urls(m.text), ["https://www.b2bnest.online/support/portal?org=o&ticket=t"]);
  }
});
Deno.test("an SMTP failure after DATA is never resent in the same run", async () => {
  let sends = 0;
  const { d, finished } = deps([row()], async () => { sends++; throw new Error("reset after DATA"); });
  await makeHandler(d)(req()); assertEquals(finished, [["1", "uncertain"]]); assertEquals(sends, 1);
});
