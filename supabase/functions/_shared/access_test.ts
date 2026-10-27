import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { checkAccess, COMPANY_TRIAL_ENDED_MESSAGE, TRIAL_ENDED_MESSAGE, type AccessRpcClient } from "./access.ts";

function fake(result: { data?: unknown; error?: { code?: string; message?: string } | null } | Error) {
  const calls: string[] = [];
  const client: AccessRpcClient = {
    rpc: (fn) => {
      calls.push(fn);
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
  return { client, calls };
}
const row = (state: string, via = "self") => [{ state, via, trial_ends_at: null, days_left: 0, plan_key: null, subscription_status: null }];

Deno.test("asks my_access_state() once", async () => {
  const { client, calls } = fake({ data: row("trial") });
  await checkAccess(client);
  assertEquals(calls, ["my_access_state"]);
});

Deno.test("owner, subscribed and trial are allowed", async () => {
  for (const s of ["owner", "subscribed", "trial"]) {
    const r = await checkAccess(fake({ data: row(s) }).client);
    assertEquals(r, { ok: true, state: s });
  }
});

Deno.test("trial_ended is refused with 402 and a clear message (own account)", async () => {
  const r = await checkAccess(fake({ data: row("trial_ended") }).client);
  assertEquals(r.ok, false);
  if (!r.ok) {
    assertEquals(r.status, 402);
    assertEquals(r.body, { error: "trial_ended", message: TRIAL_ENDED_MESSAGE, via: "self" });
  }
});

Deno.test("trial_ended for a company member says to ask the account owner", async () => {
  const r = await checkAccess(fake({ data: row("trial_ended", "company") }).client);
  assert(!r.ok && r.status === 402 && r.body.message === COMPANY_TRIAL_ENDED_MESSAGE && r.body.via === "company");
});

Deno.test("a single object (not an array) is read too", async () => {
  const r = await checkAccess(fake({ data: { state: "trial_ended", via: "self" } }).client);
  assert(!r.ok && r.status === 402);
});

Deno.test("function not installed yet (PGRST202 / 42883): allowed, marked not_installed", async () => {
  for (const error of [{ code: "PGRST202", message: "Could not find the function public.my_access_state" }, { code: "42883", message: "function does not exist" }]) {
    assertEquals(await checkAccess(fake({ error }).client), { ok: true, state: "not_installed" });
  }
});

Deno.test("any other error, a thrown call, or no row: refused with 503 (fail closed, nothing charged)", async () => {
  for (const r of [
    await checkAccess(fake({ error: { code: "42501", message: "sign in required" } }).client),
    await checkAccess(fake(new Error("network")).client),
    await checkAccess(fake({ data: [] }).client),
    await checkAccess(fake({ data: [{ state: "something_else" }] }).client),
  ]) {
    assert(!r.ok && r.status === 503 && r.body.error === "access_check_failed", JSON.stringify(r));
  }
});
