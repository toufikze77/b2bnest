import { assertEquals, assert } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { makeHandler, buildEmail, BeforeDataError, type Claimed, type Deps } from "./handler.ts";
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
