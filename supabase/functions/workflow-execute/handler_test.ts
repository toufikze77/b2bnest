import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ExecuteDeps, ExecuteLogRow, makeHandler, memoryRateLimit, RATE_LIMITED } from "./handler.ts";

const ACCOUNT = { auth_token: "tok_secret", account_sid: "AC123", from_number: "+447700900000", channel: "whatsapp" };
const req = (body: unknown, auth = "Bearer good") =>
  new Request("http://x", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const step = { type: "whatsapp.send", to: "+447700900123", body: "Hello Sam, your order is ready" };
function deps(over: Partial<ExecuteDeps> = {}) {
  const logs: ExecuteLogRow[] = []; const forms: URLSearchParams[] = [];
  const d: ExecuteDeps = {
    getUserId: async (a) => (a === "Bearer good" ? "u1" : null), rateLimit: () => true,
    loadWhatsApp: async () => ({ ok: true, account: ACCOUNT }),
    twilio: async (_a, f) => { forms.push(f); return new Response(JSON.stringify({ sid: "SM1", status: "queued" }), { status: 201 }); },
    log: async (r) => { logs.push(r); }, ...over,
  };
  return { d, logs, forms };
}

Deno.test("success: same response as before; the log has counts only", async () => {
  const { d, logs, forms } = deps();
  const r = await makeHandler(d)(req({ steps: [step], workflow_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }));
  assertEquals(await r.json(), { ok: true, results: [{ ok: true, sid: "SM1" }] });
  assertEquals(forms[0].get("To"), "whatsapp:+447700900123");
  assertEquals(logs, [{ user_id: "u1", workflow_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", step: "whatsapp.send", status: "ok", provider: "twilio",
    request_summary: { channel: "whatsapp", body_length: 30 }, response_summary: { sid: "SM1", twilio_status: "queued" } }]);
});

Deno.test("Twilio error: the caller still sees Twilio's reply; the log never stores it (it can repeat the number)", async () => {
  const { d, logs } = deps({ twilio: async () => new Response(JSON.stringify({ code: 21211, message: "The 'To' number +447700900123 is not valid" }), { status: 400 }) });
  const b = await (await makeHandler(d)(req({ steps: [step] }))).json();
  assertEquals(b.results[0].message, "The 'To' number +447700900123 is not valid");
  assertEquals(logs[0].response_summary, { error: "twilio_error", status: 400, code: 21211 });
  assertEquals(JSON.stringify(logs).includes("+447700900123"), false);
});

Deno.test("network error: the raw exception (account URL, token) is never logged", async () => {
  const { d, logs } = deps({ twilio: async () => { throw new TypeError("error sending request for url (https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json) tok_secret"); } });
  const b = await (await makeHandler(d)(req({ steps: [step] }))).json();
  assertEquals(b.results[0], { ok: false, error: "network_error" });
  const text = JSON.stringify(logs);
  for (const s of ["AC123", "tok_secret", "api.twilio.com", "Hello Sam"]) assertEquals(text.includes(s), false, s);
});

Deno.test("rate limit: 429 with a friendly message, nothing sent", async () => {
  const t = 0; const { d, forms } = deps({ rateLimit: memoryRateLimit(1, 60_000, () => t) });
  const h = makeHandler(d);
  assertEquals((await h(req({ steps: [step] }))).status, 200);
  const r = await h(req({ steps: [step] }));
  assertEquals([r.status, await r.json(), forms.length], [429, { error: "rate_limited", message: RATE_LIMITED }, 1]);
});

Deno.test("unchanged guards: auth, step count, unsupported steps, invalid number, a bad workflow id is not stored", async () => {
  const { d, logs } = deps();
  const h = makeHandler(d);
  assertEquals((await h(req({ steps: [step] }, "Bearer bad"))).status, 401);
  assertEquals((await h(req({ steps: Array(11).fill(step) }))).status, 400);
  assertEquals((await (await h(req({ steps: [{ type: "email.send" }] }))).json()).results, [{ ok: false, error: "unsupported_step" }]);
  await h(req({ steps: [{ ...step, to: "07700900123" }], workflow_id: "not a uuid" }));
  assertEquals([logs.at(-1)!.response_summary, logs.at(-1)!.workflow_id], [{ error: "invalid_to" }, null]);
});

Deno.test("WhatsApp not connected → 400 as before", async () => {
  const { d } = deps({ loadWhatsApp: async () => ({ ok: false, error: "whatsapp_not_connected" }) });
  const r = await makeHandler(d)(req({ steps: [step] }));
  assertEquals([r.status, await r.json()], [400, { error: "whatsapp_not_connected" }]);
});
