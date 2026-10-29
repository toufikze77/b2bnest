// Phase 20: JSON mode, checked replies, validated shapes, no fabricated fallback, no raw logging, no credits involved.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { AI_FAILED, Deps, makeHandler, validAnalysis } from "./handler.ts";

const COST = {
  cost_trends: { average_monthly_expense: 12500, trend: "stable", pattern: "flat" },
  cost_savings_opportunities: { recommendations: [{ area: "Software", suggestion: "Drop unused seats" }] },
  budget_recommendations: { forecast: { Apr: 12000, May: 12100, Jun: 12200 }, rationale: "Flat costs" },
  risk_factors: { potential_risks: [{ risk: "Energy prices", impact: "medium" }] },
};
const DOCS = {
  usage_analysis: { top_categories: { contracts: 45, invoices: 123, hr_forms: 28, marketing: 67 }, total_downloads: 3850 },
  insights: { most_popular: "invoices", least_used: "hr_forms", trend: "up" },
  recommendations: ["Template the invoice footer"],
};
const TRENDS = {
  market_opportunities: [{ opportunity: "Subscriptions", potential_impact: "high" }],
  regulatory_changes: [{ change: "E-invoicing", timeline: "2027", impact: "medium" }],
  technology_trends: [{ trend: "AI assistants", adoption_rate: "fast", business_impact: "high" }],
  strategic_recommendations: ["Pilot one AI tool"],
};
const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { Authorization: "Bearer good", "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ask = (analysisType: string, extra: Record<string, unknown> = {}) => ({ analysisType, data: { costs: [1, 2, 3] }, industry: "retail", businessStage: "startup", ...extra });
const chat = (content: unknown, status = 200, finish = "stop") =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finish }] }), { status });

function deps(over: Partial<Deps> = {}) {
  const calls: Record<string, unknown>[] = []; const saved: Record<string, unknown>[] = [];
  const d: Deps = {
    openAIKey: "sk-test",
    getUserId: (t) => Promise.resolve(t === "good" ? "u1" : null),
    checkAccess: () => Promise.resolve({ ok: true, state: "trial" }),
    openai: (body) => { calls.push(body); return Promise.resolve(chat(JSON.stringify(COST))); },
    saveInsight: (row) => { saved.push(row); return Promise.resolve({ id: "i1", ...row }); },
    timeoutMs: 50, ...over,
  };
  return { d, calls, saved };
}

Deno.test("uses OpenAI's JSON mode and saves a validated analysis labelled as example figures", async () => {
  const { d, calls, saved } = deps();
  const r = await makeHandler(d)(req(ask("cost_forecast")));
  assertEquals(r.status, 200);
  assertEquals((calls[0] as { response_format: unknown }).response_format, { type: "json_object" });
  assertEquals(saved.length, 1);
  assertEquals(saved[0].insight_type, "cost_forecast");
  assertEquals((saved[0].data as Record<string, unknown>).basis, "example_figures");
  assertEquals((saved[0].data as Record<string, unknown>).cost_trends, COST.cost_trends);
});

Deno.test("each analysis type is validated against its own structure", () => {
  assert(validAnalysis("cost_forecast", COST) && validAnalysis("document_usage", DOCS) && validAnalysis("industry_trends", TRENDS));
  assertEquals(validAnalysis("cost_forecast", DOCS), false);
  assertEquals(validAnalysis("document_usage", COST), false);
  assertEquals(validAnalysis("industry_trends", { ...TRENDS, technology_trends: [] }), false);
  assertEquals(validAnalysis("cost_forecast", { ...COST, budget_recommendations: { forecast: { Apr: "12k", May: 1, Jun: 1 }, rationale: "x" } }), false);
  assertEquals(validAnalysis("document_usage", { ...DOCS, recommendations: "do things" }), false);
});

Deno.test("industry trends are labelled 'general', documents 'example_figures'", async () => {
  for (const [type, body, basis, insight] of [["industry_trends", TRENDS, "general", "industry_trend"], ["document_usage", DOCS, "example_figures", "document_usage"]] as const) {
    const { d, saved } = deps({ openai: () => Promise.resolve(chat(JSON.stringify(body))) });
    assertEquals((await makeHandler(d)(req(ask(type)))).status, 200);
    assertEquals([(saved[0].data as Record<string, unknown>).basis, saved[0].insight_type], [basis, insight]);
  }
});

Deno.test("OpenAI error, non-OK, empty, cut off, not JSON, wrong shape, timeout: clear error, nothing saved, no fallback", async () => {
  const cases: [Deps["openai"], string][] = [
    [() => Promise.reject(new TypeError("down")), "network"],
    [() => Promise.resolve(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 })), "openai_status"],
    [() => Promise.resolve(chat("")), "empty_answer"],
    [() => Promise.resolve(new Response(JSON.stringify({ choices: [] }), { status: 200 })), "empty_answer"],
    [() => Promise.resolve(new Response("not json at all", { status: 200 })), "empty_answer"],
    [() => Promise.resolve(chat('{"cost_trends": {"average', 200, "length")), "cut_off"],
    [() => Promise.resolve(chat("```json\n{}\n```")), "not_json"],
    [() => Promise.resolve(chat(JSON.stringify({ analysis: "free text" }))), "wrong_shape"],
    [(_b, s) => new Promise((_r, rej) => s.addEventListener("abort", () => rej(new DOMException("x", "AbortError")))), "timeout"],
  ];
  for (const [openai, reason] of cases) {
    const { d, saved } = deps({ openai });
    const r = await makeHandler(d)(req(ask("cost_forecast")));
    assertEquals(r.status, 502, reason);
    assertEquals(await r.json(), { error: "ai_failed", reason, message: AI_FAILED });
    assertEquals(saved.length, 0, reason);
  }
});

Deno.test("industry and stage are required (no silent 'technology' / 'growth'); bad type refused; no model call", async () => {
  for (const [body, error] of [[ask("cost_forecast", { industry: "" }), "missing_context"], [ask("cost_forecast", { businessStage: undefined }), "missing_context"], [ask("weather"), "invalid_request"]] as const) {
    const { d, calls } = deps();
    const r = await makeHandler(d)(req(body));
    assertEquals([r.status, (await r.json()).error, calls.length], [400, error, 0]);
  }
});

Deno.test("trial ended / suspended / plan check failed are passed through; no model call", async () => {
  for (const [status, error] of [[402, "trial_ended"], [403, "account_suspended"], [503, "access_check_failed"]] as const) {
    const { d, calls } = deps({ checkAccess: () => Promise.resolve({ ok: false, status, body: { error, message: "m" } as never }) });
    const r = await makeHandler(d)(req(ask("cost_forecast")));
    assertEquals([r.status, (await r.json()).error, calls.length], [status, error, 0]);
  }
});

Deno.test("logs hold no user data and no raw model output", async () => {
  const lines: string[] = []; const orig = { log: console.log, error: console.error };
  console.log = (...a: unknown[]) => lines.push(JSON.stringify(a)); console.error = (...a: unknown[]) => lines.push(JSON.stringify(a));
  try {
    await makeHandler(deps().d)(req(ask("cost_forecast", { data: { secret: "USER-DATA-123" } })));
    await makeHandler(deps({ openai: () => Promise.resolve(chat("RAW-MODEL-TEXT")) }).d)(req(ask("cost_forecast", { data: { secret: "USER-DATA-123" } })));
  } finally { console.log = orig.log; console.error = orig.error; }
  const all = lines.join("\n");
  assert(lines.length >= 2);
  for (const s of ["USER-DATA-123", "RAW-MODEL-TEXT", "Drop unused seats"]) assertEquals(all.includes(s), false, s);
});

Deno.test("the source has no fence-stripping regex and no fabricated fallback any more", async () => {
  const src = await Deno.readTextFile(new URL("./handler.ts", import.meta.url));
  assertEquals(/replace\(\/```/.test(src), false);
  assertEquals(src.includes("Failed to parse AI response"), false);
  const index = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  // Every log line is a fixed message plus, at most, the analysis type, a reason code and the HTTP status.
  const logs = (index + src).match(/console\.(log|error)\(.*\);/g) ?? [];
  assert(logs.length >= 2);
  for (const l of logs) {
    const m = l.match(/^console\.(log|error)\("[^"]*"(?:, \{ ([^}]*) \})?\);$/);
    assert(m, l);
    for (const k of (m![2] ?? "").split(",").map((x) => x.trim()).filter(Boolean)) assert(["type", "reason: result.reason", "status"].includes(k), l);
  }
});
