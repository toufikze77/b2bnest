// AI assistant (Advisor, document assistant). Phase 20: the request handling lives here with its dependencies
// injected, so tests never call OpenAI or the database.
//
// Credits: reserve, then refund. The credit is taken BEFORE the model call with public.check_and_deduct_ai_credit,
// which locks the subscriber row, so concurrent requests can never go past the monthly limit. If the answer is not
// delivered (OpenAI error, non-OK status, timeout, unreadable or empty answer) the credit is given back exactly once
// with public.refund_ai_credit (docs/phase20). A delivered answer is never refunded, so a credit is never taken twice
// or returned twice for one request.
//
// Logs never hold the question, the answer or the model's raw output: only lengths, status codes and error codes.
import type { AccessCheck } from "../_shared/access.ts";
import { AI_CONTEXT_FIELD_MAX_LENGTH, AI_QUESTION_MAX_LENGTH } from "../_shared/ai-limits.ts";
import { platformKnowledge } from "./knowledge.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const MODEL = "gpt-4o-mini";
export const MAX_TOKENS = 1000;
export const AI_TIMEOUT_MS = 30_000;

export interface CreditResult {
  success: boolean; credits_remaining?: number; credits_limit?: number; reset_date?: string; subscription_tier?: string; error?: string;
}

export interface Deps {
  openAIKey: string | undefined;
  getUserId: (token: string) => Promise<string | null>;
  /** Phase 12 access check, asked as the caller (their JWT). */
  checkAccess: (authHeader: string) => Promise<AccessCheck>;
  /** public.check_and_deduct_ai_credit(user, 1): the reservation. */
  deduct: (userId: string) => Promise<{ data: CreditResult | null; error: unknown }>;
  /** public.refund_ai_credit(user, 1): gives the reserved credit back. Throws if it couldn't. */
  refund: (userId: string) => Promise<{ credits_remaining?: number; refunded?: number }>;
  /** POST to OpenAI chat completions with this body. */
  openai: (body: Record<string, unknown>, signal: AbortSignal) => Promise<Response>;
  /** Saves the conversation (best effort; a failure never changes the answer or the credit). */
  save: (row: { userId: string; conversationId: string | null; conversationType: string; message: string; answer: string; context: Record<string, unknown> }) => Promise<void>;
  timeoutMs?: number;
}

const CONVERSATION_TYPES = ["business_advisor", "document_assistant", "cost_forecasting", "general"] as const;
type ConversationType = typeof CONVERSATION_TYPES[number];

export const AI_FAILED_REFUNDED = "The AI service didn't give an answer, so no credit was used. Please try again in a moment.";
export const AI_FAILED_NOT_REFUNDED =
  "The AI service didn't give an answer. We couldn't give the credit back automatically; contact us and we'll put it right.";
export const AI_NOT_CONFIGURED = "The AI assistant isn't set up on the server yet. No credit was used.";
export const CREDIT_CHECK_FAILED = "We couldn't check your AI credits just now. No credit was used. Please try again.";
export const QUESTION_TOO_LONG = `Your question is too long. The limit is ${AI_QUESTION_MAX_LENGTH.toLocaleString("en-GB")} characters.`;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, AI_CONTEXT_FIELD_MAX_LENGTH) : "");

export function systemPrompt(type: ConversationType, industry: string, stage: string): string {
  const knowledge = platformKnowledge();
  const ind = industry || "any", st = stage || "any";
  switch (type) {
    case "document_assistant":
      return `You are an expert business document assistant for B2BNest. Help users create, customize, and optimize business documents. Consider their industry: ${ind}, business stage: ${st}. Provide specific, actionable advice.\n\n${knowledge}`;
    case "business_advisor":
      return `You are a strategic business advisor with expertise in ${ind} industry. You have deep knowledge of the B2BNest platform. Provide insights on business growth, cost optimization, and strategic decisions for ${st} businesses. Guide users on how to use B2BNest features to achieve their goals. You don't have access to the user's own business data; say so if they ask about their own figures.\n\n${knowledge}`;
    case "cost_forecasting":
      return `You are a financial analyst specializing in business cost forecasting for B2BNest users. Analyze patterns and provide predictions based on the figures the user gives you and industry trends for ${ind}. Help users leverage B2BNest's financial tools for accurate forecasting.\n\n${knowledge}`;
    default:
      return `You are B2BNest AI Assistant, a helpful AI assistant for business operations and management. You have comprehensive knowledge of all B2BNest features including Project Management, Integration Hub, HMRC, Workflow Studio, CRM, Payroll, Financial Tools, and more. Help users understand and make the most of the platform.\n\n${knowledge}\n\nWhen users ask about features:\n- Explain how to access and use them\n- Provide step-by-step guidance\n- Suggest best practices\n- Offer tips for optimization\n- Help troubleshoot issues\n\nBe friendly, professional, and concise. Always prioritize user success.`;
  }
}

/** The answer text, or null when the reply isn't a usable chat completion. */
export async function readAnswer(res: Response): Promise<string | null> {
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

export function makeHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized", message: "Please sign in again." });
    const userId = await deps.getUserId(auth.slice(7).trim()).catch(() => null);
    if (!userId) return json(401, { error: "unauthorized", message: "Please sign in again." });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json(400, { error: "invalid_request", message: "Invalid request." }); }
    const message = typeof body?.message === "string" ? body.message : "";
    if (!message.trim()) return json(400, { error: "invalid_request", message: "Please type a question." });
    if (message.length > AI_QUESTION_MAX_LENGTH) return json(400, { error: "question_too_long", message: QUESTION_TOO_LONG, max_length: AI_QUESTION_MAX_LENGTH });
    const conversationType: ConversationType = (CONVERSATION_TYPES as readonly string[]).includes(body.conversationType as string)
      ? body.conversationType as ConversationType : "general";
    const industry = clean(body.userIndustry), stage = clean(body.businessStage);
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    const context = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context as Record<string, unknown> : {};

    if (!deps.openAIKey) return json(503, { error: "ai_not_configured", message: AI_NOT_CONFIGURED });

    // Phase 12: no AI after the trial ends without a plan; suspended accounts get nothing. Before any credit.
    const access = await deps.checkAccess(auth);
    if (!access.ok) return json(access.status, access.body);

    // Reserve one credit (atomic, row-locked).
    const { data: credit, error: creditError } = await deps.deduct(userId).catch((e) => ({ data: null, error: e }));
    if (creditError || !credit) {
      console.error("ai-assistant: credit check failed");
      return json(503, { error: "credit_check_failed", message: CREDIT_CHECK_FAILED });
    }
    if (!credit.success) {
      return json(402, {
        error: "insufficient_credits",
        message: `You've used all your AI credits for this month (${credit.credits_limit ?? 0} a month on your plan). They reset on ${credit.reset_date ? new Date(credit.reset_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "your next reset date"}.`,
        credits_remaining: credit.credits_remaining, credits_limit: credit.credits_limit, reset_date: credit.reset_date,
      });
    }

    // Call the model. Anything but a usable answer gives the credit back (once) and says so.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? AI_TIMEOUT_MS);
    let answer: string | null = null; let status = 0; let reason = "";
    try {
      const res = await deps.openai({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt(conversationType, industry, stage) }, { role: "user", content: message }],
        temperature: 0.7, max_tokens: MAX_TOKENS,
      }, ctl.signal);
      status = res.status;
      answer = await readAnswer(res);
      if (!answer) reason = res.ok ? "empty_answer" : "openai_status";
    } catch (e) {
      reason = e instanceof DOMException && e.name === "AbortError" ? "timeout" : "network";
    } finally { clearTimeout(timer); }

    if (!answer) {
      console.error("ai-assistant: no answer", { reason, status, question_length: message.length });
      try {
        const r = await deps.refund(userId);
        return json(502, { error: "ai_failed", message: AI_FAILED_REFUNDED, credit_refunded: true, credits_remaining: r.credits_remaining, credits_limit: credit.credits_limit });
      } catch {
        console.error("ai-assistant: refund failed", { reason });
        return json(502, { error: "ai_failed", message: AI_FAILED_NOT_REFUNDED, credit_refunded: false });
      }
    }

    await deps.save({ userId, conversationId, conversationType, message, answer, context: { userIndustry: industry, businessStage: stage, ...context } })
      .catch(() => console.error("ai-assistant: conversation not saved"));

    console.log("ai-assistant: answered", { type: conversationType, question_length: message.length, answer_length: answer.length });
    return json(200, {
      response: answer, conversationType, timestamp: new Date().toISOString(),
      credits_remaining: credit.credits_remaining, credits_limit: credit.credits_limit, reset_date: credit.reset_date,
    });
  };
}
