import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { type BanDeps, mapStatusError, type RpcError, setUserBan } from "./handler.ts";

const ID = "6f1c2a1e-1b2c-4d3e-8f90-123456789abc";
const TOKEN = "caller.jwt.token";

function fake(opts: { user?: { id: string } | null; status?: RpcError[]; ban?: RpcError[] } = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const statusQueue = [...(opts.status ?? [])];
  const banQueue = [...(opts.ban ?? [])];
  const deps: BanDeps = {
    getUser: async (t) => { calls.push(`getUser:${t === TOKEN}`); return opts.user === undefined ? { id: "caller-id" } : opts.user; },
    setStatus: async (t, id, active) => { calls.push(`status:${active}:${id === ID}:${t === TOKEN}`); return { error: statusQueue.shift() ?? null }; },
    setBan: async (id, banned) => { calls.push(`ban:${banned}:${id === ID}`); return { error: banQueue.shift() ?? null }; },
    log: (m) => logs.push(m),
  };
  return { deps, calls, logs };
}

Deno.test("no token: 401, nothing called", async () => {
  const f = fake();
  assertEquals((await setUserBan("", { user_id: ID, suspend: true }, f.deps)).status, 401);
  assertEquals(f.calls, []);
});

Deno.test("bad payload: 400, nothing called", async () => {
  for (const p of [{}, { user_id: "x", suspend: true }, { user_id: ID }, { user_id: ID, suspend: "yes" }, null]) {
    const f = fake();
    const r = await setUserBan(TOKEN, p, f.deps);
    assertEquals(r.status, 400, JSON.stringify(p));
    assertEquals(f.calls, []);
  }
});

Deno.test("invalid token: 401, no RPC and no ban", async () => {
  const f = fake({ user: null });
  assertEquals((await setUserBan(TOKEN, { user_id: ID, suspend: true }, f.deps)).status, 401);
  assertEquals(f.calls, ["getUser:true"]);
});

Deno.test("suspend: the flag is set AS THE CALLER first, then the Auth ban", async () => {
  const f = fake();
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: true }, f.deps);
  assertEquals(r, { status: 200, body: { ok: true, user_id: ID, suspended: true } });
  assertEquals(f.calls, ["getUser:true", "status:false:true:true", "ban:true:true"]);
});

Deno.test("reactivate: the ban is lifted first, then the flag", async () => {
  const f = fake();
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: false }, f.deps);
  assertEquals(r, { status: 200, body: { ok: true, user_id: ID, suspended: false } });
  assertEquals(f.calls, ["getUser:true", "ban:false:true", "status:true:true:true"]);
});

Deno.test("the database refuses: no ban is touched, clear error code", async () => {
  const cases: [RpcError, number, string][] = [
    [{ code: "P0001", message: "cannot_suspend_master: switch off unlimited access first" }, 409, "cannot_suspend_master"],
    [{ code: "P0001", message: "cannot_suspend_super_admin: a super admin can't be suspended" }, 409, "cannot_suspend_super_admin"],
    [{ code: "P0001", message: "cannot_suspend_admin: remove the admin role first" }, 409, "cannot_suspend_admin"],
    [{ code: "42501", message: "You cannot change your own status" }, 403, "own_account"],
    [{ code: "42501", message: "Not authorized" }, 403, "not_authorized"],
    [{ code: "P0002", message: "no such user" }, 404, "no_such_user"],
    [{ code: "XX000", message: "boom" }, 502, "status_failed"],
  ];
  for (const [err, status, code] of cases) {
    const f = fake({ status: [err] });
    const r = await setUserBan(TOKEN, { user_id: ID, suspend: true }, f.deps);
    assertEquals([r.status, r.body.error], [status, code], err?.message);
    assert(!f.calls.some((c) => c.startsWith("ban:")), "no ban after a refusal");
  }
});

Deno.test("suspend: ban fails -> the flag is put back, nothing disagrees, no retry", async () => {
  const f = fake({ ban: [{ code: "500", message: "auth down" }] });
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: true }, f.deps);
  assertEquals([r.status, r.body.error], [502, "ban_failed"]);
  assertEquals(f.calls, ["getUser:true", "status:false:true:true", "ban:true:true", "status:true:true:true"]);
});

Deno.test("suspend: ban fails and the revert fails too -> 500 that says exactly what state it is in", async () => {
  const f = fake({ ban: [{ code: "500" }], status: [null, { code: "XX000", message: "x" }] });
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: true }, f.deps);
  assertEquals([r.status, r.body.error], [500, "ban_failed_flag_kept"]);
  assertEquals(f.calls.filter((c) => c.startsWith("ban:")).length, 1);
});

Deno.test("reactivate: unban fails -> nothing else is called", async () => {
  const f = fake({ ban: [{ code: "500" }] });
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: false }, f.deps);
  assertEquals([r.status, r.body.error], [502, "unban_failed"]);
  assertEquals(f.calls, ["getUser:true", "ban:false:true"]);
});

Deno.test("reactivate: the database refuses after the unban -> the ban is put back", async () => {
  const f = fake({ status: [{ code: "42501", message: "Not authorized" }] });
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: false }, f.deps);
  assertEquals([r.status, r.body.error], [403, "not_authorized"]);
  assertEquals(f.calls, ["getUser:true", "ban:false:true", "status:true:true:true", "ban:true:true"]);
});

Deno.test("reactivate: flag and re-ban both fail -> 500 that says exactly what state it is in", async () => {
  const f = fake({ status: [{ code: "XX000" }], ban: [null, { code: "500" }] });
  const r = await setUserBan(TOKEN, { user_id: ID, suspend: false }, f.deps);
  assertEquals([r.status, r.body.error], [500, "unbanned_flag_kept"]);
});

Deno.test("logs never contain the token, the user id or an email", async () => {
  const f = fake({ ban: [{ code: "500", message: "user someone@example.com" }], status: [null, { code: "XX000", message: "x" }] });
  await setUserBan(TOKEN, { user_id: ID, suspend: true }, f.deps);
  assert(f.logs.length > 0);
  for (const l of f.logs) assert(!l.includes(TOKEN) && !l.includes(ID) && !l.includes("@"), l);
});

Deno.test("mapStatusError: unknown errors are a plain 502", () => {
  assertEquals(mapStatusError(null), { status: 502, body: { error: "status_failed" } });
});
