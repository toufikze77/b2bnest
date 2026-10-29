// Phase 21: the X post function applies the workflow plan rule before reading tokens or posting.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { Deps, makeHandler } from "./handler.ts";
import { WORKFLOW_PLAN_CHECK_FAILED, WORKFLOWS_NOT_INCLUDED_MESSAGE } from "../_shared/workflow-access.ts";
import { SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";

const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { Authorization: "Bearer good", "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ENV: Record<string, string> = { TWITTER_CONSUMER_KEY: "ck", TWITTER_CONSUMER_SECRET: "cs" };
function deps(accessState: Deps["accessState"], over: Partial<Deps> = {}) {
  const posted: string[] = []; let tokenReads = 0;
  const d: Deps = {
    getUser: (t) => Promise.resolve(t === "good" ? { id: "u1" } : null),
    accessState,
    getTokens: () => { tokenReads++; return Promise.resolve([{ access_token: "at", refresh_token: "ats" }]); },
    env: (n) => ENV[n],
    sendTweet: (text) => { posted.push(text); return Promise.resolve({ data: { id: "1" } }); },
    ...over,
  };
  return { d, posted, reads: () => tokenReads };
}
const row = (state: string, plan_key: string | null = null, via = "self") => () => Promise.resolve({ state, plan_key, via });

Deno.test("allowed: trial, owner, Business, Scale (and company Business) post exactly as before", async () => {
  for (const a of [row("trial"), row("owner"), row("subscribed", "professional"), row("subscribed", "enterprise"), row("subscribed", "professional", "company")]) {
    const { d, posted } = deps(a);
    const r = await makeHandler(d)(req({ text: "Hello" }));
    assertEquals(r.status, 200);
    assertEquals(await r.json(), { success: true, data: { data: { id: "1" } }, message: "Tweet posted successfully" });
    assertEquals(posted, ["Hello"]);
  }
});

Deno.test("refused: Solo, trial ended, suspended, unknown plan; lookup failure refuses; nothing read or posted", async () => {
  const cases: [Deps["accessState"], number, string, string][] = [
    [row("subscribed", "starter"), 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_MESSAGE],
    [row("subscribed", "gold"), 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_MESSAGE],
    [row("trial_ended"), 402, "trial_ended", TRIAL_ENDED_MESSAGE],
    [row("suspended"), 403, "account_suspended", SUSPENDED_MESSAGE],
    [() => Promise.reject(new Error("db down")), 503, "plan_check_failed", WORKFLOW_PLAN_CHECK_FAILED],
    [() => Promise.resolve(null), 503, "plan_check_failed", WORKFLOW_PLAN_CHECK_FAILED],
  ];
  for (const [a, status, code, message] of cases) {
    const { d, posted, reads } = deps(a);
    const r = await makeHandler(d)(req({ text: "Hello", plan_key: "enterprise", state: "owner" }));
    assertEquals(r.status, status, code);
    assertEquals(await r.json(), { success: false, code, error: message, message });
    assertEquals([posted.length, reads()], [0, 0], code);
  }
});

Deno.test("unchanged for allowed callers: validation, not connected (403), X errors (500), unauthorized", async () => {
  const ok = row("trial");
  assertEquals((await (await makeHandler(deps(ok).d)(req({ text: "" }))).json()).error, "Tweet text is required");
  assertEquals((await (await makeHandler(deps(ok).d)(req({ text: "x".repeat(281) }))).json()).error, "Tweet text exceeds 280 characters");
  const nc = await makeHandler(deps(ok, { getTokens: () => Promise.resolve([]) }).d)(req({ text: "Hi" }));
  assertEquals(nc.status, 403);
  const bad = await makeHandler(deps(ok, { sendTweet: () => Promise.reject(new Error("Twitter API error: 401 - x")) }).d)(req({ text: "Hi" }));
  assertEquals([bad.status, (await bad.json()).message], [500, "Failed to post tweet"]);
  const unauth = await makeHandler(deps(ok).d)(new Request("http://x", { method: "POST", headers: { Authorization: "Bearer nope" }, body: "{}" }));
  assertEquals([unauth.status, (await unauth.json()).error], [500, "Unauthorized"]);
});
