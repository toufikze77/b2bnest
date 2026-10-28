import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { BATCH, BeforeDataError, type Claimed, type Deps, makeHandler, type OutMail, type Outcome } from "./handler.ts";
import { buildAlternativeMessage } from "./mime.ts";

const KEY = "Bearer service-role";
const TOKEN = "a".repeat(64);
const row = (over: Partial<Claimed> = {}): Claimed => ({ id: crypto.randomUUID(), kind: "ending_soon", recipient_email: "person@example.test",
  first_name: "Sam", trial_ends_at: "2026-11-01T09:00:00Z", days_left: 3, unsubscribe_token: TOKEN, attempts: 1, ...over });

function fake(rows: Claimed[], send: (m: OutMail) => Promise<string> = async () => "250 2.0.0 OK") {
  const finished: [string, Outcome, string][] = [];
  const sent: OutMail[] = [];
  let claimedWith = 0;
  const deps: Deps = {
    isServiceCall: (h) => h === KEY,
    claim: async (n) => { claimedWith = n; return rows.slice(0, n); },
    finish: async (id, o, reply) => { finished.push([id, o, reply]); },
    send: async (m) => { sent.push(m); return send(m); },
  };
  return { deps, finished, sent, claimed: () => claimedWith };
}
const call = (d: Deps, auth: string | null = KEY) =>
  makeHandler(d)(new Request("http://x/", { method: "POST", headers: auth ? { Authorization: auth } : {} }));

Deno.test("only the service role: anything else is 401 and nothing is claimed", async () => {
  const f = fake([row()]);
  assertEquals((await call(f.deps, null)).status, 401);
  assertEquals((await call(f.deps, "Bearer anon-key")).status, 401);
  assertEquals([f.claimed(), f.sent.length], [0, 0]);
});

Deno.test("a bounded batch: never more than 20 per run", async () => {
  const f = fake(Array.from({ length: 30 }, () => row()));
  const body = await (await call(f.deps)).json();
  assertEquals([f.claimed(), BATCH, body.claimed, f.sent.length], [20, 20, 20, 20]);
});

Deno.test("accepted by the provider: finished with the reply; text + HTML + List-Unsubscribe with the token", async () => {
  const r = row();
  const f = fake([r]);
  const body = await (await call(f.deps)).json();
  assertEquals(body, { status: "ran", claimed: 1, accepted: 1, failed: 0, uncertain: 0, cancelled: 0 });
  assertEquals(f.finished, [[r.id, "accepted_by_provider", "250 2.0.0 OK"]]);
  const m = f.sent[0];
  assertEquals([m.to, m.subject], ["person@example.test", "Your B2BNEST trial ends in 3 days"]);
  assertEquals(m.listUnsubscribe, `https://www.b2bnest.online/unsubscribe?token=${TOKEN}`);
  assert(m.text.includes(m.listUnsubscribe) && m.html.includes(m.listUnsubscribe));
});

Deno.test("a failed send (before DATA) is 'failed', never marked sent; the database retries it later", async () => {
  const r = row();
  const f = fake([r], async () => { throw new BeforeDataError("stage=auth 535 5.7.3 Authentication unsuccessful"); });
  const body = await (await call(f.deps)).json();
  assertEquals([body.accepted, body.failed], [0, 1]);
  assertEquals(f.finished.map(([, o]) => o), ["failed"]);
});

Deno.test("a crash during or after DATA is 'uncertain' and is not resent in the same run", async () => {
  const r = row();
  const f = fake([r], async () => { throw new Error("stage=data_end Connection closed by server"); });
  const body = await (await call(f.deps)).json();
  assertEquals([body.uncertain, f.sent.length], [1, 1]);
  assertEquals(f.finished.map(([, o]) => o), ["uncertain"]);
});

Deno.test("a row it cannot build (bad token, unknown kind, no address) is cancelled, never sent", async () => {
  const f = fake([row({ unsubscribe_token: "short" }), row({ kind: "promo" as never }), row({ recipient_email: "" })]);
  const body = await (await call(f.deps)).json();
  assertEquals([body.cancelled, f.sent.length], [3, 0]);
});

Deno.test("error text stored in the database never contains an email address", async () => {
  const f = fake([row()], async () => { throw new BeforeDataError("550 5.1.1 person@example.test rejected"); });
  await call(f.deps);
  assert(!f.finished[0][2].includes("@"), f.finished[0][2]);
});

Deno.test("each kind sends its own subject", async () => {
  const f = fake([row({ kind: "ending_soon", days_left: 3 }), row({ kind: "ended", days_left: 0 }), row({ kind: "follow_up", days_left: 0 })]);
  await call(f.deps);
  assertEquals(f.sent.map((m) => m.subject), ["Your B2BNEST trial ends in 3 days", "Your B2BNEST trial has ended", "Your B2BNEST information is still here"]);
});

Deno.test("MIME: text and HTML alternatives, List-Unsubscribe, and no header injection", () => {
  const raw = buildAlternativeMessage({ from: "B2BNEST <notifications@b2bnest.online>", to: "a@example.test\r\nBcc: x@evil.test", subject: "Hi\r\nBcc: y@evil.test",
    text: "plain", html: "<p>html</p>", listUnsubscribe: "https://www.b2bnest.online/unsubscribe?token=" + TOKEN });
  const headers = raw.split("\r\n\r\n")[0];
  assert(!/^Bcc:/m.test(headers), headers);
  assert(headers.includes(`List-Unsubscribe: <https://www.b2bnest.online/unsubscribe?token=${TOKEN}>`));
  assert(raw.includes("Content-Type: multipart/alternative") && raw.includes("Content-Type: text/plain; charset=UTF-8") && raw.includes("Content-Type: text/html; charset=UTF-8"));
});

Deno.test("dates read the British way under Deno too: 'Sunday 1 November 2026'", async () => {
  const f = fake([row({ trial_ends_at: "2026-11-01T09:00:00Z" })]);
  await call(f.deps);
  assert(f.sent[0].text.includes("ends on Sunday 1 November 2026, in 3 days."), f.sent[0].text.split("\n")[2]);
});
