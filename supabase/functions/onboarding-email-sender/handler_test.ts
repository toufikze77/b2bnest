import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { makeHandler, buildEmail, BeforeDataError, smtpOnly, type Claimed, type Deps } from "./handler.ts";
const row = (o: Partial<Claimed> = {}): Claimed => ({ id: "1", kind: "staff_invitation", recipient_email: "w@new.test", company: "Acme",
  role: "member", organization_id: "org-1", token: "tok", attempts: 1, ...o });
const req = () => new Request("http://x", { method: "POST", headers: { Authorization: "Bearer svc" } });
const deps = (rows: Claimed[], send: Deps["send"], env: Record<string, string> = { ONBOARDING_EMAIL_ENABLED: "true" }) => {
  const finished: [string, string][] = [];
  const d: Deps = { env: (n) => env[n], isServiceCall: (h) => h === "Bearer svc", claim: async () => rows, finish: async (i, o) => { finished.push([i, o]); }, send };
  return { d, finished };
};
Deno.test("inert unless switched on", async () => { const { d } = deps([row()], async () => "250", {}); assertEquals((await (await makeHandler(d)(req())).json()).status, "disabled"); });
Deno.test("rejects non-service callers", async () => { const { d } = deps([], async () => "250"); assertEquals((await makeHandler(d)(new Request("http://x"))).status, 401); });
Deno.test("staff email links to /join; explains new vs existing accounts", () => {
  const m = buildEmail(row(), "https://b2bnest.online")!; assert(m.text.includes("https://b2bnest.online/join?token=tok"));
  assert(m.text.includes("choose your own password")); assert(m.text.includes("no password reset"));
});
Deno.test("customer email returns to that company's portal and carries no token", () => {
  const m = buildEmail(row({ kind: "customer_invitation", token: null }), "https://b2bnest.online")!;
  assert(m.text.includes("/support/portal?org=org-1")); assert(!m.text.includes("token"));
});
Deno.test("before DATA -> failed; after -> uncertain", async () => {
  let a = deps([row()], async () => { throw new BeforeDataError("421"); }); await makeHandler(a.d)(req()); assertEquals(a.finished, [["1", "failed"]]);
  a = deps([row()], async () => { throw new Error("timeout"); }); await makeHandler(a.d)(req()); assertEquals(a.finished, [["1", "uncertain"]]);
});

Deno.test("invitations refuse the Gmail fallback", () => {
  let e: unknown; try { smtpOnly({ provider: "gmail" }); } catch (x) { e = x; }
  assert(e instanceof BeforeDataError);
});

// Phase 10: off by default, service role only, SMTP only, links only, never resent after DATA.
const spy = (env: Record<string, string>, rows: Claimed[] = [row()]) => {
  const calls = { claim: 0, send: 0 };
  const finished: [string, string][] = [];
  const d: Deps = { env: (n) => env[n], isServiceCall: (h) => h === "Bearer svc",
    claim: async () => { calls.claim++; return rows; }, finish: async (i, o) => { finished.push([i, o]); },
    send: async () => { calls.send++; return "250"; } };
  return { d, calls, finished };
};
Deno.test("disabled unless ONBOARDING_EMAIL_ENABLED is exactly 'true': no claim, no SMTP", async () => {
  for (const v of [undefined, "", "TRUE", "True", "1", "yes", " true", "true "]) {
    const { d, calls } = spy(v === undefined ? {} : { ONBOARDING_EMAIL_ENABLED: v });
    const res = await makeHandler(d)(req());
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { status: "disabled", sent: 0 });
    assertEquals(calls, { claim: 0, send: 0 });
  }
});
Deno.test("non-service callers get 401 and nothing is claimed or sent, even when switched on", async () => {
  for (const h of [null, "Bearer anon-key", "Bearer ", "svc"]) {
    const { d, calls } = spy({ ONBOARDING_EMAIL_ENABLED: "true" });
    const r = new Request("http://x", { method: "POST", headers: h === null ? {} : { Authorization: h } });
    assertEquals((await makeHandler(d)(r)).status, 401);
    assertEquals(calls, { claim: 0, send: 0 });
  }
});
Deno.test("missing SMTP settings are refused before sending (no Gmail fallback)", () => {
  let e: unknown; try { smtpOnly(null); } catch (x) { e = x; }
  assert(e instanceof BeforeDataError);
  assertEquals(smtpOnly({ provider: "smtp" }).provider, "smtp");
});
Deno.test("each email body carries exactly one link, the allowed one", () => {
  const urls = (t: string) => t.match(/https?:\/\/\S+/g) ?? [];
  const staff = buildEmail(row({ token: "a b" }), "https://www.b2bnest.online/")!;
  assertEquals(urls(staff.text), ["https://www.b2bnest.online/join?token=a%20b"]);
  const cust = buildEmail(row({ kind: "customer_invitation", token: null, organization_id: "org 1" }), "https://www.b2bnest.online")!;
  assertEquals(urls(cust.text), ["https://www.b2bnest.online/support/portal?org=org%201"]);
  assertEquals(buildEmail(row({ token: null }), "https://www.b2bnest.online"), null);
});
Deno.test("an SMTP failure after DATA marks the row uncertain and it is sent only once", async () => {
  let sends = 0; const finished: [string, string][] = [];
  const d: Deps = { env: () => "true", isServiceCall: () => true, claim: async () => [row()],
    finish: async (i, o) => { finished.push([i, o]); }, send: async () => { sends++; throw new Error("connection lost after DATA"); } };
  const r = await (await makeHandler(d)(req())).json();
  assertEquals(finished, [["1", "uncertain"]]); assertEquals(sends, 1); assertEquals(r.uncertain, 1);
});
Deno.test("company and role are kept on one line (no header injection)", () => {
  const m = buildEmail(row({ company: "Acme\r\nBcc: x@evil.test", role: "admin" }), "https://b")!;
  assert(!m.subject.includes("\n")); assert(!m.subject.includes("\r"));
});
