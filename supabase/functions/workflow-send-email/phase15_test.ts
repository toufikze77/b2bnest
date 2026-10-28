// Phase 15: placeholders filled on the server, run history rows, rate limit.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import type { Mail } from "./handler.ts";
import { Deps, makeHandler, memoryRateLimit, RATE_LIMITED, RunLogRow } from "./request.ts";

const ENV: Record<string, string> = { GMAIL_USER: "sender@example.com", GMAIL_APP_PASSWORD: "x" };
const RUN = "11111111-2222-4333-8444-555555555555", WF = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { Authorization: "Bearer good", "Content-Type": "application/json" }, body: JSON.stringify(body) });
function deps(over: Partial<Deps> = {}) {
  const mails: Mail[] = []; const logs: RunLogRow[] = [];
  const d: Deps = {
    env: (n) => ENV[n], getUser: async (t) => (t === "good" ? { id: "u1" } : null),
    send: async (_c, m) => { mails.push(m); }, timeoutMs: 50, logRun: async (r) => { logs.push(r); }, ...over,
  };
  return { d, mails, logs };
}
const tpl = { subject: "Invoice {{invoice_number}}", body: "Hi {{name}},\n{{amount}} is due." };
const values = { invoice_number: "INV-7", name: "Sam", amount: "£40.00" };
const rendered = { subject: "Invoice INV-7", body: "Hi Sam,\n£40.00 is due." };

Deno.test("template + values: the server fills them with the shared function and sends exactly the preview", async () => {
  const { d, mails, logs } = deps();
  const r = await makeHandler(d)(req({ to: "a@x.test, b@x.test", ...rendered, template: tpl, values, runId: RUN, stepIndex: 2, workflowId: WF }));
  assertEquals(r.status, 200);
  assertEquals(mails.map((m) => [m.subject, m.content, m.html]), [["Invoice INV-7", "Hi Sam,\n£40.00 is due.", undefined]]);
  assertEquals(logs, [{
    user_id: "u1", workflow_id: WF, run_id: RUN, step_index: 2, step: "email.send", status: "ok", provider: "gmail",
    request_summary: { recipients: 2, subject_length: 13, body_length: 22, placeholders: 3 },
    response_summary: { code: "accepted", message: "Accepted by the email provider. Inbox delivery isn't confirmed." },
  }]);
});

Deno.test("the run history row never holds addresses, the subject or the message", async () => {
  const { d, logs } = deps({ send: async () => { throw new Error("550 5.1.1 <a@x.test>: mailbox unavailable"); } });
  await makeHandler(d)(req({ to: "a@x.test", ...rendered, template: tpl, values, runId: RUN }));
  const text = JSON.stringify(logs);
  for (const secret of ["a@x.test", "Invoice INV-7", "Hi Sam", "Sam", "£40.00", "sender@example.com"]) assertEquals(text.includes(secret), false, secret);
  assertEquals(logs[0].status, "error");
});

Deno.test("a missing value → 400 'needs a value', nothing sent, logged as failed with the reason", async () => {
  const { d, mails, logs } = deps();
  const r = await makeHandler(d)(req({ to: "a@x.test", subject: "Invoice {{invoice_number}}", body: "x", template: tpl, values: { name: "Sam" }, runId: RUN }));
  const b = await r.json();
  assertEquals([r.status, b.code, b.sent, mails.length], [400, "invalid_details", "not_sent", 0]);
  assert(b.error.includes("Invoice number ({{invoice_number}}) needs a value."));
  assertEquals([logs[0].status, logs[0].response_summary.code], ["error", "invalid_details"]);
});

Deno.test("an old client sending a literal {{name}} without values is refused, never sent as typed", async () => {
  const { d, mails } = deps();
  const r = await makeHandler(d)(req({ to: "a@x.test", subject: "Hello {{name}}", body: "Hi" }));
  assertEquals([r.status, mails.length], [400, 0]);
});

Deno.test("the subject/message must equal the preview the user confirmed (409 otherwise, nothing sent)", async () => {
  const { d, mails } = deps();
  const r = await makeHandler(d)(req({ to: "a@x.test", subject: "Invoice INV-8", body: rendered.body, template: tpl, values }));
  assertEquals([r.status, (await r.json()).code, mails.length], [409, "preview_mismatch", 0]);
});

Deno.test("header injection through a value is refused", async () => {
  const { d, mails } = deps();
  const r = await makeHandler(d)(req({ to: "a@x.test", subject: "x", body: "y", template: { subject: "Hi {{name}}", body: "b" }, values: { name: "Sam\r\nBcc: z@evil.test" } }));
  assertEquals([r.status, mails.length], [400, 0]);
});

Deno.test("plain workflows without placeholders behave as before", async () => {
  const { d, mails, logs } = deps();
  const r = await makeHandler(d)(req({ to: "me@example.com", subject: " Hi ", body: "Hello" }));
  assertEquals(r.status, 200);
  assertEquals([mails[0].subject, mails[0].content], ["Hi", "Hello"]);
  assertEquals(logs, []); // no runId → no history row
});

Deno.test("timeout is logged as 'unknown', never as sent or failed", async () => {
  const { d, logs } = deps({ send: () => new Promise(() => {}) });
  const r = await makeHandler(d)(req({ to: "a@x.test", subject: "S", body: "B", runId: RUN }));
  await r.body?.cancel();
  assertEquals([r.status, logs[0].status], [504, "unknown"]);
});

Deno.test("a run-log failure never changes the send result", async () => {
  const { d, mails } = deps({ logRun: async () => { throw new Error("db down"); } });
  const r = await makeHandler(d)(req({ to: "a@x.test", subject: "S", body: "B", runId: RUN }));
  assertEquals([r.status, mails.length], [200, 1]);
});

Deno.test("a bad runId / workflowId is ignored, not stored", async () => {
  const { d, logs } = deps();
  await makeHandler(d)(req({ to: "a@x.test", subject: "S", body: "B", runId: "not-a-uuid", workflowId: WF }));
  assertEquals(logs, []);
  await makeHandler(d)(req({ to: "a@x.test", subject: "S", body: "B", runId: RUN, workflowId: "x'; drop table", stepIndex: 99 }));
  assertEquals([logs[0].workflow_id, logs[0].step_index], [null, 0]);
});

Deno.test("rate limit: 429 with a friendly message and nothing sent; the window resets", async () => {
  let t = 0; const limit = memoryRateLimit(2, 60_000, () => t);
  const { d, mails } = deps({ rateLimit: limit });
  const h = makeHandler(d);
  for (let i = 0; i < 2; i++) assertEquals((await h(req({ to: "a@x.test", subject: "S", body: "B" }))).status, 200);
  const r = await h(req({ to: "a@x.test", subject: "S", body: "B" })); const b = await r.json();
  assertEquals([r.status, b.code, b.error, mails.length], [429, "rate_limited", RATE_LIMITED, 2]);
  t = 61_000;
  assertEquals((await h(req({ to: "a@x.test", subject: "S", body: "B" }))).status, 200);
});
