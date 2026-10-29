// AI Studio → Intelligent Analytics (Phase 20). Request handling with injected dependencies, so tests never call
// OpenAI or the database.
//
// * The model is asked for JSON with OpenAI's JSON mode (response_format json_object); the reply is checked
//   (HTTP status, choices[0].message.content) and the parsed object is validated against the structure each analysis
//   type promises. Anything else is a clear error: nothing is saved and no "fallback" analysis is made up.
// * This function has never taken AI credits (it doesn't call check_and_deduct_ai_credit), so no credit can be lost
//   here. That is unchanged: charging for it would change what users pay.
// * Logs hold only lengths, status codes and error codes: never the user's data or the model's raw output.
// * The figures it analyses are the example figures the screen sends (not the user's business data); every saved
//   result carries basis: "example_figures" (cost, documents) or "general" (industry trends) so the screen labels it.
import type { AccessCheck } from "../_shared/access.ts";
import { AI_CONTEXT_FIELD_MAX_LENGTH } from "../_shared/ai-limits.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export const MODEL = "gpt-4o-mini";
export const AI_TIMEOUT_MS = 45_000;

export type AnalysisType = "cost_forecast" | "document_usage" | "industry_trends";
const INSIGHT_TYPE: Record<AnalysisType, string> = { cost_forecast: "cost_forecast", document_usage: "document_usage", industry_trends: "industry_trend" };
export const BASIS: Record<AnalysisType, "example_figures" | "general"> = { cost_forecast: "example_figures", document_usage: "example_figures", industry_trends: "general" };

export interface Deps {
  openAIKey: string | undefined;
  getUserId: (token: string) => Promise<string | null>;
  checkAccess: (authHeader: string) => Promise<AccessCheck>;
  openai: (body: Record<string, unknown>, signal: AbortSignal) => Promise<Response>;
  /** Inserts one public.business_insights row and returns it. */
  saveInsight: (row: { user_id: string; insight_type: string; data: Record<string, unknown>; confidence_score: number; expires_at: string }) => Promise<Record<string, unknown>>;
  timeoutMs?: number;
}

export const AI_FAILED = "The AI service didn't return a usable analysis, so nothing was saved. No credit was used. Please try again.";
export const AI_NOT_CONFIGURED = "AI analysis isn't set up on the server yet.";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, AI_CONTEXT_FIELD_MAX_LENGTH) : "");

export function buildPrompt(type: AnalysisType, data: unknown, industry: string, stage: string): string {
  switch (type) {
    case "cost_forecast":
      return `Analyze the following example business cost data for a ${stage} ${industry} business and provide a detailed analysis:
${JSON.stringify(data)}

Return a JSON object with exactly these keys:
1. cost_trends: {average_monthly_expense: number, trend: string, pattern: string}
2. cost_savings_opportunities: {recommendations: [{area: string, suggestion: string}]}
3. budget_recommendations: {forecast: {Apr: number, May: number, Jun: number}, rationale: string}
4. risk_factors: {potential_risks: [{risk: string, impact: string}]}`;
    case "document_usage":
      return `Analyze these example document usage figures for a ${industry} business:
${JSON.stringify(data)}

Return a JSON object with exactly these keys:
1. usage_analysis: {top_categories: {contracts: number, invoices: number, hr_forms: number, marketing: number}, total_downloads: number}
2. insights: {most_popular: string, least_used: string, trend: string}
3. recommendations: [string array of optimization suggestions]`;
    case "industry_trends":
      return `Provide current industry trends analysis for ${industry} businesses at ${stage} stage.

Return a JSON object with exactly these keys:
1. market_opportunities: [{opportunity: string, potential_impact: string}]
2. regulatory_changes: [{change: string, timeline: string, impact: string}]
3. technology_trends: [{trend: string, adoption_rate: string, business_impact: string}]
4. strategic_recommendations: [string array of actionable recommendations]`;
  }
}

// ---- Shape checks: the structure each analysis type promises (and the screen renders). ----
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const arrOf = (v: unknown, item: (x: unknown) => boolean) => Array.isArray(v) && v.length > 0 && v.every(item);
const has = (o: unknown, keys: Record<string, (v: unknown) => boolean>) => isObj(o) && Object.entries(keys).every(([k, f]) => f(o[k]));

const SHAPES: Record<AnalysisType, (o: unknown) => boolean> = {
  cost_forecast: (o) => has(o, {
    cost_trends: (v) => has(v, { average_monthly_expense: num, trend: str, pattern: str }),
    cost_savings_opportunities: (v) => has(v, { recommendations: (r) => arrOf(r, (x) => has(x, { area: str, suggestion: str })) }),
    budget_recommendations: (v) => has(v, { forecast: (f) => has(f, { Apr: num, May: num, Jun: num }), rationale: str }),
    risk_factors: (v) => has(v, { potential_risks: (r) => arrOf(r, (x) => has(x, { risk: str, impact: str })) }),
  }),
  document_usage: (o) => has(o, {
    usage_analysis: (v) => has(v, {
      top_categories: (c) => has(c, { contracts: num, invoices: num, hr_forms: num, marketing: num }), total_downloads: num,
    }),
    insights: (v) => has(v, { most_popular: str, least_used: str, trend: str }),
    recommendations: (r) => arrOf(r, str),
  }),
  industry_trends: (o) => has(o, {
    market_opportunities: (r) => arrOf(r, (x) => has(x, { opportunity: str, potential_impact: str })),
    regulatory_changes: (r) => arrOf(r, (x) => has(x, { change: str, timeline: str, impact: str })),
    technology_trends: (r) => arrOf(r, (x) => has(x, { trend: str, adoption_rate: str, business_impact: str })),
    strategic_recommendations: (r) => arrOf(r, str),
  }),
};
export const validAnalysis = (type: AnalysisType, o: unknown) => SHAPES[type](o);

/** The parsed, validated analysis, or a reason code. Never throws. */
export async function readAnalysis(res: Response, type: AnalysisType): Promise<{ ok: true; analysis: Obj } | { ok: false; reason: string }> {
  if (!res.ok) return { ok: false, reason: "openai_status" };
  const body = await res.json().catch(() => null) as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] } | null;
  const choice = body?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) return { ok: false, reason: "empty_answer" };
  if (choice?.finish_reason === "length") return { ok: false, reason: "cut_off" };
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return { ok: false, reason: "not_json" }; }
  if (!validAnalysis(type, parsed)) return { ok: false, reason: "wrong_shape" };
  return { ok: true, analysis: parsed as Obj };
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized", message: "Please sign in again." });
    const userId = await deps.getUserId(auth.slice(7).trim()).catch(() => null);
    if (!userId) return json(401, { error: "unauthorized", message: "Please sign in again." });

    let body: Obj;
    try { body = await req.json(); } catch { return json(400, { error: "invalid_request", message: "Invalid request." }); }
    const type = body?.analysisType as AnalysisType;
    if (!(type in SHAPES)) return json(400, { error: "invalid_request", message: "Choose an analysis type." });
    const industry = clean(body.industry), stage = clean(body.businessStage);
    if (!industry || !stage) return json(400, { error: "missing_context", message: "Choose your industry and business stage first." });
    if (JSON.stringify(body.data ?? {}).length > 20_000) return json(400, { error: "invalid_request", message: "Too much data in one request." });

    if (!deps.openAIKey) return json(503, { error: "ai_not_configured", message: AI_NOT_CONFIGURED });

    // Phase 12: no AI after the trial ends without a plan; suspended accounts get nothing.
    const access = await deps.checkAccess(auth);
    if (!access.ok) return json(access.status, access.body);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? AI_TIMEOUT_MS);
    let result: Awaited<ReturnType<typeof readAnalysis>>; let status = 0;
    try {
      const res = await deps.openai({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a business analyst with expertise in cost forecasting, document management, and industry trends. Always reply with a single JSON object in the structure requested." },
          { role: "user", content: buildPrompt(type, body.data ?? {}, industry, stage) },
        ],
        temperature: 0.3, max_tokens: 1500,
      }, ctl.signal);
      status = res.status;
      result = await readAnalysis(res, type);
    } catch (e) {
      result = { ok: false, reason: e instanceof DOMException && e.name === "AbortError" ? "timeout" : "network" };
    } finally { clearTimeout(timer); }

    if (!result.ok) {
      console.error("business-insights: no usable analysis", { type, reason: result.reason, status });
      return json(502, { error: "ai_failed", reason: result.reason, message: AI_FAILED });
    }

    const score = result.analysis.confidence_score;
    const confidence = typeof score === "number" && score >= 0 && score <= 1 ? score : 0.8;
    const { confidence_score: _drop, ...analysis } = result.analysis;
    let saved: Record<string, unknown>;
    try {
      saved = await deps.saveInsight({
        user_id: userId, insight_type: INSIGHT_TYPE[type],
        data: { ...analysis, basis: BASIS[type], industry, business_stage: stage },
        confidence_score: confidence,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch {
      console.error("business-insights: insight not saved", { type });
      return json(503, { error: "save_failed", message: "The analysis couldn't be saved. Please try again." });
    }
    console.log("business-insights: saved", { type, status });
    return json(200, { insight: saved, generatedAt: new Date().toISOString() });
  };
}
