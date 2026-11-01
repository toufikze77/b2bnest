import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { AUDIT_ACTION, RATE_LIMIT, type ResetDeps, resetMfa, tokenAal } from "./handler.ts";

const TARGET = "6f1c2a1e-1b2c-4d3e-8f90-123456789abc";
const CALLER = "11111111-2222-4333-8444-555555555555";
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (aal: string) => `${b64({ alg: "HS256" })}.${b64({ sub: CALLER, aal, role: "authenticated" })}.sig`;
const AAL2 = jwt("aal2");
const body = (over: Record<string, unknown> = {}) => ({ user_id: TARGET, reason: "Called them back on their known number", ...over });

function fake(opts: { user?: { id: string } | null; superAdmin?: boolean; recent?: number; ids?: string[]; listErr?: boolean; auditErr?: boolean; deleteErrAt?: number } = {}) {
  const calls: string[] = [];
  const audits: Record<string, unknown>[] = [];
  const logs: string[] = [];
  const deps: ResetDeps = {
    getUser: async () => { calls.push("getUser"); return opts.user === undefined ? { id: CALLER } : opts.user; },
    isSuperAdmin: async () => { calls.push("isSuperAdmin"); return opts.superAdmin ?? true; },
    recentResets: async () => { calls.push("recent"); return opts.recent ?? 0; },
    listFactorIds: async () => { calls.push("list"); return { ids: opts.ids ?? ["f1", "f2"], error: opts.listErr ? { code: "x" } : null }; },
    deleteFactor: async (_u, id) => { calls.push(`delete:${id}`); return { error: opts.deleteErrAt !== undefined && calls.filter((c) => c.startsWith("delete")).length - 1 === opts.deleteErrAt ? { code: "boom" } : null }; },
    audit: async (row) => { calls.push("audit"); audits.push(row); return { error: opts.auditErr ? { code: "42501" } : null }; },
    now: () => new Date("2026-11-01T12:00:00Z"),
    log: (m) => logs.push(m),
  };
  return { deps, calls, audits, logs };
}

Deno.test("tokenAal reads the aal claim; garbage gives null", () => {
  assertEquals(tokenAal(AAL2), "aal2");
  assertEquals(tokenAal(jwt("aal1")), "aal1");
  assertEquals(tokenAal("nope"), null);
  assertEquals(tokenAal(""), null);
});

Deno.test("no token: 401, nothing called", async () => {
  const f = fake();
  assertEquals((await resetMfa("", body(), f.deps)).status, 401);
  assertEquals(f.calls, []);
});

Deno.test("bad payload or missing reason: 400, nothing called", async () => {
  for (const p of [{}, null, { user_id: "x", reason: "long enough" }, body({ reason: "" }), body({ reason: "   " }), body({ reason: "abc" }), body({ reason: 5 }), body({ reason: "x".repeat(501) })]) {
    const f = fake();
    const r = await resetMfa(AAL2, p, f.deps);
    assertEquals(r.status, 400, JSON.stringify(p));
    assertEquals(f.calls, []);
  }
});

Deno.test("invalid token: 401", async () => {
  const f = fake({ user: null });
  assertEquals((await resetMfa(AAL2, body(), f.deps)).status, 401);
  assertEquals(f.calls, ["getUser"]);
});

Deno.test("caller at aal1 (password only): 403 mfa_required, nothing checked or removed", async () => {
  const f = fake();
  const r = await resetMfa(jwt("aal1"), body(), f.deps);
  assertEquals([r.status, r.body.error], [403, "mfa_required"]);
  assertEquals(f.calls, ["getUser"]);
});

Deno.test("not a super admin: 403", async () => {
  const f = fake({ superAdmin: false });
  assertEquals((await resetMfa(AAL2, body(), f.deps)).body.error, "not_authorized");
  assertEquals(f.calls.includes("list") || f.calls.includes("audit"), false);
});

Deno.test("own account: refused", async () => {
  const f = fake();
  const r = await resetMfa(AAL2, body({ user_id: CALLER }), f.deps);
  assertEquals([r.status, r.body.error], [403, "own_account"]);
  assertEquals(f.calls.some((c) => c.startsWith("delete")), false);
});

Deno.test(`rate limited at ${RATE_LIMIT} an hour: 429, nothing removed`, async () => {
  const f = fake({ recent: RATE_LIMIT });
  assertEquals((await resetMfa(AAL2, body(), f.deps)).status, 429);
  assertEquals(f.calls.some((c) => c === "audit" || c.startsWith("delete")), false);
});

Deno.test("success: audit row first (who, whom, reason, time, no secrets), then every factor removed", async () => {
  const f = fake();
  const r = await resetMfa(AAL2, body(), f.deps);
  assertEquals(r, { status: 200, body: { ok: true, user_id: TARGET, removed: 2 } });
  assertEquals(f.calls, ["getUser", "isSuperAdmin", "recent", "list", "audit", "delete:f1", "delete:f2"]);
  assertEquals(f.audits, [{
    user_id: TARGET, action: AUDIT_ACTION, resource_type: "user", resource_id: TARGET,
    details: { admin_id: CALLER, reason: "Called them back on their known number", factors: 2, at: "2026-11-01T12:00:00.000Z" },
  }]);
  assert(!JSON.stringify(f.audits).includes(AAL2));
});

Deno.test("audit fails: nothing is removed", async () => {
  const f = fake({ auditErr: true });
  const r = await resetMfa(AAL2, body(), f.deps);
  assertEquals([r.status, r.body.error], [500, "audit_failed"]);
  assertEquals(f.calls.some((c) => c.startsWith("delete")), false);
});

Deno.test("list fails: 502, nothing audited or removed", async () => {
  const f = fake({ listErr: true });
  assertEquals((await resetMfa(AAL2, body(), f.deps)).status, 502);
  assertEquals(f.calls.includes("audit"), false);
});

Deno.test("a delete fails part-way: 502 with the count removed; logs carry no reason, token or ids", async () => {
  const f = fake({ deleteErrAt: 1 });
  const r = await resetMfa(AAL2, body(), f.deps);
  assertEquals([r.status, r.body.removed], [502, 1]);
  const logged = f.logs.join(" ");
  for (const secret of [AAL2, "Called them back", TARGET, CALLER]) assertEquals(logged.includes(secret), false, secret);
});

Deno.test("a user with no factors: recorded, nothing to remove", async () => {
  const f = fake({ ids: [] });
  assertEquals((await resetMfa(AAL2, body(), f.deps)).body, { ok: true, user_id: TARGET, removed: 0 });
  assertEquals(f.audits.length, 1);
});
