// Phase 21: the LinkedIn post function applies the workflow plan rule before reading tokens or posting.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { Deps, makeHandler } from "./handler.ts";
import { WORKFLOW_PLAN_CHECK_FAILED, WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE, WORKFLOWS_NOT_INCLUDED_MESSAGE } from "../_shared/workflow-access.ts";
import { SUSPENDED_MESSAGE, TRIAL_ENDED_MESSAGE } from "../_shared/access.ts";

const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { Authorization: "Bearer good", "Content-Type": "application/json" }, body: JSON.stringify(body) });
function deps(accessState: Deps["accessState"], over: Partial<Deps> = {}) {
  const posted: [string, string][] = []; let tokenReads = 0, profileReads = 0;
  const d: Deps = {
    getUser: (t) => Promise.resolve(t === "good" ? { id: "u1" } : null),
    accessState,
    getTokens: () => { tokenReads++; return Promise.resolve([{ access_token: "at" }]); },
    getUserProfile: () => { profileReads++; return Promise.resolve("li-123"); },
    postToLinkedIn: (text, visibility) => { posted.push([text, visibility]); return Promise.resolve({ id: "urn:li:share:1" }); },
    ...over,
  };
  return { d, posted, reads: () => tokenReads + profileReads };
}
const row = (state: string, plan_key: string | null = null, via = "self") => () => Promise.resolve({ state, plan_key, via });

Deno.test("allowed: trial, owner, Business, Scale post exactly as before (PUBLIC by default)", async () => {
  for (const a of [row("trial"), row("owner"), row("subscribed", "professional"), row("subscribed", "enterprise")]) {
    const { d, posted } = deps(a);
    const r = await makeHandler(d)(req({ text: "Hello" }));
    assertEquals(r.status, 200);
    assertEquals(await r.json(), { success: true, data: { id: "urn:li:share:1" }, message: "LinkedIn post created successfully" });
    assertEquals(posted, [["Hello", "PUBLIC"]]);
  }
});

Deno.test("refused: Solo (self and company), trial ended, suspended; lookup failure refuses; nothing read or posted", async () => {
  const cases: [Deps["accessState"], number, string, string][] = [
    [row("subscribed", "starter"), 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_MESSAGE],
    [row("subscribed", "starter", "company"), 403, "plan_not_included", WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE],
    [row("trial_ended"), 402, "trial_ended", TRIAL_ENDED_MESSAGE],
    [row("suspended"), 403, "account_suspended", SUSPENDED_MESSAGE],
    [() => Promise.reject(new Error("db down")), 503, "plan_check_failed", WORKFLOW_PLAN_CHECK_FAILED],
    [row("weird"), 503, "plan_check_failed", WORKFLOW_PLAN_CHECK_FAILED],
  ];
  for (const [a, status, code, message] of cases) {
    const { d, posted, reads } = deps(a);
    const r = await makeHandler(d)(req({ text: "Hello" }));
    assertEquals(r.status, status, code);
    assertEquals(await r.json(), { success: false, code, error: message, message });
    assertEquals([posted.length, reads()], [0, 0], code);
  }
});

Deno.test("unchanged for allowed callers: empty text, not connected (403), LinkedIn errors (500)", async () => {
  const ok = row("subscribed", "professional");
  assertEquals((await (await makeHandler(deps(ok).d)(req({ text: "" }))).json()).error, "Post text is required");
  assertEquals((await makeHandler(deps(ok, { getTokens: () => Promise.resolve(null) }).d)(req({ text: "Hi" }))).status, 403);
  const bad = await makeHandler(deps(ok, { postToLinkedIn: () => Promise.reject(new Error("LinkedIn API error: 422 - x")) }).d)(req({ text: "Hi" }));
  assertEquals([bad.status, (await bad.json()).message], [500, "Failed to create LinkedIn post"]);
});
