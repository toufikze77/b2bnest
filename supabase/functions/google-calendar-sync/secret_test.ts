import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { CRON_HEADER, cronSecretOk, sameSecret, syncAllRefusal } from "./secret.ts";

const SECRET = "s3cr3t-value-for-tests-0123456789-abcdef";
const req = (headers: Record<string, string>) => new Request("https://example.test/functions/v1/google-calendar-sync", { method: "POST", headers, body: '{"action":"sync_all"}' });

Deno.test("sync_all: the right secret header is accepted", () => {
  assertEquals(syncAllRefusal(req({ [CRON_HEADER]: SECRET }), SECRET), null);
});

Deno.test("sync_all: a missing, wrong, shorter or longer secret is refused with 401 and says nothing more", async () => {
  for (const h of [{} as Record<string, string>, { [CRON_HEADER]: "" }, { [CRON_HEADER]: SECRET.slice(0, -1) }, { [CRON_HEADER]: SECRET + "x" }, { [CRON_HEADER]: SECRET.toUpperCase() }]) {
    const r = syncAllRefusal(req(h), SECRET, { "Access-Control-Allow-Origin": "https://www.b2bnest.online" });
    assert(r, JSON.stringify(h));
    assertEquals(r.status, 401);
    assertEquals(await r.json(), { error: "Unauthorized" });
    assertEquals(r.headers.get("Access-Control-Allow-Origin"), "https://www.b2bnest.online");
  }
});

Deno.test("sync_all: a person's sign-in (a valid-looking user JWT) never opens it", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.sig";
  const r = syncAllRefusal(req({ Authorization: `Bearer ${jwt}`, apikey: "anon" }), SECRET);
  assertEquals(r?.status, 401);
});

Deno.test("sync_all: refused for everyone while CALENDAR_SYNC_CRON_SECRET is unset or shorter than 32 characters", () => {
  assertEquals(syncAllRefusal(req({ [CRON_HEADER]: "" }), undefined)?.status, 401);
  assertEquals(syncAllRefusal(req({ [CRON_HEADER]: "short" }), "short")?.status, 401);
  assertEquals(cronSecretOk(null, SECRET), false);
});

Deno.test("sameSecret compares whole strings (constant time), including different lengths and non-ASCII", () => {
  assert(sameSecret("abc", "abc"));
  assert(!sameSecret("abc", "abd"));
  assert(!sameSecret("abc", "abcd"));
  assert(!sameSecret("", ""));
  assert(sameSecret("café-ü", "café-ü"));
  assert(!sameSecret("café-ü", "cafe-u"));
});
