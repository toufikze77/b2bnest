import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ledgerRpcs, readUsage, recordUsageBestEffort, refundWithRetry, type UsageRow } from "./ai-ledger.ts";

const row: UsageRow = { userId: "u1", requestId: "r1", feature: "legal_document", docType: "nda_mutual", model: "gpt-4.1", promptTokens: 10, completionTokens: 20 };

Deno.test("readUsage: only sane integer token counts", () => {
  assertEquals(readUsage({ usage: { prompt_tokens: 12, completion_tokens: 34 } }), { promptTokens: 12, completionTokens: 34 });
  for (const bad of [null, {}, { usage: {} }, { usage: { prompt_tokens: -1, completion_tokens: 1 } }, { usage: { prompt_tokens: 1.5, completion_tokens: 1 } },
    { usage: { prompt_tokens: "12", completion_tokens: 1 } }, { usage: { prompt_tokens: 3_000_000, completion_tokens: 1 } }]) {
    assertEquals(readUsage(bad), null, JSON.stringify(bad));
  }
});

Deno.test("recordUsageBestEffort: never throws, gives up after the timeout, logs no content", async () => {
  const logs: string[] = [];
  const log = (m: string, meta: Record<string, unknown>) => logs.push(m + JSON.stringify(meta));
  await recordUsageBestEffort(() => Promise.reject(new Error("PGRST202")), row, log);
  const t = Date.now();
  await recordUsageBestEffort(() => new Promise(() => {}), row, log, 30);
  assert(Date.now() - t < 500);
  await recordUsageBestEffort(undefined, row, log);
  assertEquals(logs.length, 2);
  assert(logs.every((l) => !l.includes("nda_mutual") && !l.includes("u1")), "logs hold no ids or doc types");
});

Deno.test("refundWithRetry: retries a thrown refund once, then gives up", async () => {
  let n = 0;
  assertEquals(await refundWithRetry(() => (++n === 1 ? Promise.reject(new Error("net")) : Promise.resolve("ok"))), "ok");
  assertEquals(n, 2);
  n = 0;
  let threw = false;
  try { await refundWithRetry(() => { n++; return Promise.reject(new Error("down")); }); } catch { threw = true; }
  assertEquals([threw, n], [true, 2]);
});

Deno.test("ledgerRpcs: argument names match docs/phase35/proposal.sql", async () => {
  const calls: [string, Record<string, unknown>][] = [];
  const rpc = (fn: string, args: Record<string, unknown>) => {
    calls.push([fn, args]);
    return Promise.resolve({ data: fn === "refund_ai_credit" ? { success: true, refunded: 10 } : { success: true }, error: null });
  };
  const l = ledgerRpcs({ rpc });
  await l.deduct("u1", 10, { feature: "legal_document", requestId: "r1" });
  await l.refund("u1", 10, { feature: "legal_document", requestId: "r1" });
  await l.recordUsage(row);
  assertEquals(calls, [
    ["check_and_deduct_ai_credit", { p_user_id: "u1", p_credits_to_deduct: 10, p_feature: "legal_document", p_request_id: "r1" }],
    ["refund_ai_credit", { p_user_id: "u1", p_credits: 10, p_feature: "legal_document", p_request_id: "r1" }],
    ["record_ai_usage", { p_user_id: "u1", p_request_id: "r1", p_feature: "legal_document", p_doc_type: "nda_mutual", p_model: "gpt-4.1", p_prompt_tokens: 10, p_completion_tokens: 20 }],
  ]);
  const sql = await Deno.readTextFile(new URL("../../../docs/phase35/proposal.sql", import.meta.url));
  for (const p of ["p_feature text DEFAULT 'ai_assistant', p_request_id uuid DEFAULT NULL", "p_feature text DEFAULT NULL, p_request_id uuid DEFAULT NULL",
    "record_ai_usage(p_user_id uuid, p_request_id uuid, p_feature text, p_doc_type text,\n                                       p_model text, p_prompt_tokens integer, p_completion_tokens integer)"]) {
    assert(sql.includes(p), p);
  }
});

Deno.test("ledgerRpcs.refund throws when the refund did not happen", async () => {
  const l = ledgerRpcs({ rpc: () => Promise.resolve({ data: { success: false, error: "no_subscriber" }, error: null }) });
  let msg = "";
  try { await l.refund("u1", 1, { feature: "ai_assistant", requestId: "r" }); } catch (e) { msg = (e as Error).message; }
  assertEquals(msg, "no_subscriber");
});
