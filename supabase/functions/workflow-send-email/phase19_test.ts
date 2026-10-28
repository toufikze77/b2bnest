// Phase 19: workflows are a Business and Scale feature (plus the trial and owners). The server is the gate.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import type { Mail } from "./handler.ts";
import { Deps, makeHandler, RunLogRow } from "./request.ts";
import { WORKFLOW_PLAN_CHECK_FAILED, WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE, WORKFLOWS_NOT_INCLUDED_MESSAGE } from "../_shared/workflow-access.ts";
import { SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";

const ENV: Record<string, string> = { SMTP_USER: "notifications@b2bnest.online", SMTP_PASSWORD: "pw-secret" };
const RUN = "11111111-2222-4333-8444-555555555555";
const email = { to: "customer@client.example", subject: "Hello", body: "Hi there", runId: RUN, stepIndex: 0 };
const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { Authorization: "Bearer good", "Content-Type": "application/json" }, body: JSON.stringify(body) });
type Row = Awaited<ReturnType<Deps["accessState"]>>;
function deps(accessState: Deps["accessState"], over: Partial<Deps> = {}) {
  const mails: Mail[] = []; const logs: RunLogRow[] = []; const asked: string[] = []; let limited = 0;
  const d: Deps = {
    env: (n) => ENV[n], getUser: (t) => Promise.resolve(t === "good" ? { id: "u1", email: "o@acme.example", email_confirmed_at: "2026-10-01" } : null),
    accessState: (id) => { asked.push(id); return accessState(id); },
    send: (_c, m) => { mails.push(m); return Promise.resolve(); }, logRun: (r) => { logs.push(r); return Promise.resolve(); },
    rateLimit: () => { limited++; return true; }, timeoutMs: 50, ...over,
  };
  return { d, mails, logs, asked, limited: () => limited };
}
const row = (r: Row) => () => Promise.resolve(r);

Deno.test("allowed: trial, Business, Scale, owner (and company members on Business) send as before", async () => {
  for (const r of [
    { state: "trial", plan_key: null, via: "self" }, { state: "subscribed", plan_key: "professional", via: "self" },
    { state: "subscribed", plan_key: "enterprise", via: "self" }, { state: "owner", plan_key: null, via: "self" },
    { state: "subscribed", plan_key: "professional", via: "company" }, { state: "trial", plan_key: null, via: "company" },
  ]) {
    const { d, mails, logs, asked } = deps(row(r));
    const res = await makeHandler(d)(req(email));
    assertEquals(res.status, 200, JSON.stringify(r));
    assertEquals(mails.length, 1);
    assertEquals(mails[0].replyTo, "o@acme.example"); // Phase 18 Reply-To unchanged
    assertEquals(logs.map((l) => l.status), ["ok"]);
    assertEquals(asked, ["u1"]); // the plan of the AUTHENTICATED user, read on the server
  }
});

Deno.test("refused: Solo, trial ended, suspended, unknown plan → nothing sent, Run history says skipped", async () => {
  const cases: [Row, number, string, string][] = [
    [{ state: "subscribed", plan_key: "starter", via: "self" }, 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_MESSAGE],
    [{ state: "subscribed", plan_key: "starter", via: "company" }, 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE],
    [{ state: "subscribed", plan_key: "platinum", via: "self" }, 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_MESSAGE],
    [{ state: "subscribed", plan_key: null, via: "self" }, 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_MESSAGE],
    [{ state: "trial_ended", plan_key: null, via: "self" }, 402, "trial_ended", TRIAL_ENDED_MESSAGE],
    [{ state: "suspended", plan_key: null, via: "self" }, 403, "account_suspended", SUSPENDED_MESSAGE],
  ];
  for (const [r, status, code, message] of cases) {
    const { d, mails, logs } = deps(row(r));
    const res = await makeHandler(d)(req(email));
    assertEquals(res.status, status, JSON.stringify(r));
    assertEquals(await res.json(), { success: false, code, sent: "not_sent", error: message });
    assertEquals(mails.length, 0);
    assertEquals(logs.map((l) => [l.status, l.provider, l.response_summary.code, l.response_summary.message]), [["skipped", "none", code, message]]);
  }
  assertEquals(WORKFLOWS_NOT_INCLUDED_MESSAGE, "Workflows are included in the Business and Scale plans.");
});

Deno.test("plan lookup fails (error, no row, odd state) → refuse with 'try again', nothing sent: never fails open", async () => {
  for (const accessState of [() => Promise.reject(new Error("db down")), row(null), row({ state: "weird" })]) {
    const { d, mails, logs } = deps(accessState as Deps["accessState"]);
    const res = await makeHandler(d)(req(email));
    assertEquals(res.status, 503);
    assertEquals(await res.json(), { success: false, code: "plan_check_failed", sent: "not_sent", error: WORKFLOW_PLAN_CHECK_FAILED });
    assertEquals(mails.length, 0);
    assertEquals(logs.map((l) => l.status), ["skipped"]);
  }
});

Deno.test("nothing in the request body can claim a plan", async () => {
  const { d, mails } = deps(row({ state: "subscribed", plan_key: "starter", via: "self" }));
  const res = await makeHandler(d)(req({ ...email, state: "owner", plan_key: "enterprise", plan: "enterprise", access: { state: "trial" } }));
  assertEquals(res.status, 403);
  assertEquals(mails.length, 0);
});

Deno.test("a refused call doesn't use up the rate limit; an allowed one still does", async () => {
  const solo = deps(row({ state: "subscribed", plan_key: "starter", via: "self" }));
  await makeHandler(solo.d)(req(email));
  assertEquals(solo.limited(), 0);
  const biz = deps(row({ state: "subscribed", plan_key: "professional", via: "self" }));
  await makeHandler(biz.d)(req(email));
  assertEquals(biz.limited(), 1);
});

Deno.test("the admin connection check (no mail) isn't a workflow and doesn't ask for the plan", async () => {
  const { d, asked } = deps(row({ state: "subscribed", plan_key: "starter", via: "self" }), {
    isSuperAdmin: () => Promise.resolve(true),
    probe: () => Promise.resolve({ ok: true, stage: "done", host: "h", port: 587 }),
  });
  const res = await makeHandler(d)(req({ probe: true }));
  assertEquals(res.status, 200);
  assertEquals(asked, []);
});
