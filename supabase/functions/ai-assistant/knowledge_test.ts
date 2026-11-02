// Phase 20: the assistant's platform knowledge can't state a price, credit amount or workflow plan that disagrees with
// the plan catalogue (_shared/plans.ts) or the workflow rule (_shared/workflow-access.ts).
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { LEGAL_DOCUMENT_CREDITS, platformKnowledge, TRIAL_AI_CREDITS, NON_WORKFLOW_PLAN_NAMES, WORKFLOW_PLAN_NAMES } from "./knowledge.ts";
import { CREDITS_PER_DOCUMENT } from "../generate-legal-document/handler.ts";
import { DOC_TYPES, JURISDICTIONS } from "../generate-legal-document/catalogue.ts";
import { PLAN_CATALOG } from "../_shared/plans.ts";
import { workflowsIncluded } from "../_shared/workflow-access.ts";

const text = platformKnowledge();
const plans = Object.values(PLAN_CATALOG);
const pounds = (p: number) => `£${p / 100}`;

Deno.test("every price in the text is a catalogue price for that plan (or a top-up pack price), and every plan's prices are there", async () => {
  const { TOPUP_PACKS } = await import("../_shared/topup-packs.ts");
  const allowed = new Set([...plans.flatMap((p) => [pounds(p.prices.month.amount), pounds(p.prices.year.amount)]), ...TOPUP_PACKS.map((t) => pounds(t.amountPence))]);
  const found = text.match(/£[\d,.]+/g) ?? [];
  assert(found.length >= plans.length * 2);
  for (const f of found) assert(allowed.has(f.replace(/,/g, "")), `price not in the catalogue: ${f}`);
  for (const p of plans) {
    const line = text.split("\n").find((l) => l.startsWith(`- ${p.name}:`));
    assert(line, p.name);
    assert(line!.includes(`${pounds(p.prices.month.amount)} a month`) && line!.includes(`${pounds(p.prices.year.amount)} a year`), line);
    assert(line!.includes(`${p.aiCreditLimit.toLocaleString("en-GB")} AI credits a month`), line);
  }
});

Deno.test("every 'N AI credits' figure is a catalogue credit allowance, or the cost of one legal document", () => {
  const allowed = new Set(plans.map((p) => p.aiCreditLimit));
  for (const m of text.matchAll(/([\d,]+) AI credits( a month)?/g)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (m[2]) assert(allowed.has(n), m[0]);
    else assert(allowed.has(n) || n === CREDITS_PER_DOCUMENT || n === TRIAL_AI_CREDITS, m[0]);
  }
});

Deno.test("workflow plans agree with the server rule", () => {
  for (const p of plans) assertEquals(WORKFLOW_PLAN_NAMES.includes(p.name), workflowsIncluded({ state: "subscribed", plan_key: p.key }), p.name);
  assert(text.includes("Included in the Business and Scale plans, and during the 14-day trial. Not included in Solo."));
  assertEquals(NON_WORKFLOW_PLAN_NAMES, ["Solo"]);
  // No sentence may say Solo (or every plan) includes workflows.
  assertEquals(/Solo[^.\n]*includes? (Workflow|workflows)|workflows? (are |is )?(included )?in (all|every) plans?/i.test(text), false);
});

Deno.test("the facts proven false in Phase 20 are gone, and the honest ones stay", () => {
  for (const gone of ["Recurring tasks", "Task dependencies", "P60 and P45", "Pension auto-enrollment", "Statutory payments", "TrueLayer",
    "Document version control", "Sentiment analysis", "Predictive analytics", "Scheduled reports", "company's email settings", "Steps that don't run yet are hidden",
    "Two-step sign-in is not active yet"]) {
    assertEquals(text.includes(gone), false, gone);
  }
  for (const kept of ["HMRC filing is not available yet", "Two-step sign-in is optional for each user", "There is no SMS option", "There is no mobile app and no public API",
    "No plan includes a support response-time promise", "posting from B2BNEST is switched off for customers"]) assert(text.includes(kept), kept);
});

Deno.test("Phase 21: no 'coming soon' promises, and COLLABORATION says only what the code does", () => {
  assertEquals(/coming soon|team chat \(|video conferenc/i.test(text), false);
  for (const gone of ["Comments and mentions", "File sharing", "Real-time collaboration", "Team workspaces"]) assertEquals(text.includes(gone), false, gone);
  assert(text.includes("There is no team chat, no video calls, no @mentions and no shared file storage"));
});

// Phase 30b: what the assistant says about Phases 24-30 must match the code.
const section = (heading: string) => {
  const i = text.indexOf(`## ${heading}`);
  assert(i >= 0, heading);
  const next = text.indexOf("\n## ", i + 3);
  return text.slice(i, next < 0 ? undefined : next);
};

Deno.test("Phase 30b: contracts are written by AI and cost the same credits as the function", () => {
  assertEquals(LEGAL_DOCUMENT_CREDITS, CREDITS_PER_DOCUMENT);
  const legal = section("CONTRACTS AND LEGAL NOTICES");
  assert(legal.includes("The AI drafts the document from the details the user types in."));
  assert(legal.includes(`Each document uses ${CREDITS_PER_DOCUMENT} AI credits. If the AI fails or doesn't produce a usable document, the credits are given back.`));
  assert(text.includes(`Each contract or legal notice uses ${CREDITS_PER_DOCUMENT} AI credits`));
  for (const j of JURISDICTIONS) assert(legal.includes(j.label), j.label);
  assert(legal.includes("[Company number]"));
  assert(legal.includes("PDF, Word (.docx) or Markdown (.md)"));
  assert(legal.includes("The last 10 documents of each generator are saved in that browser only"));
});

Deno.test("Phase 30b: the document type lists are exactly the catalogue", () => {
  const legal = section("CONTRACTS AND LEGAL NOTICES");
  const listed = [...legal.matchAll(/^ {2}- ([^:]+): (.+)$/gm)].flatMap((m) => m[2].split("; ").map((label) => ({ group: m[1], label })));
  assertEquals(listed, DOC_TYPES.map((d) => ({ group: d.group, label: d.label })));
});

Deno.test("Phase 30b: never claims legal advice, compliance or a lawyer's review", () => {
  assert(text.includes("It is not legal advice: a qualified solicitor should check a document before anyone relies on it."));
  for (const line of text.split("\n")) {
    if (/legal advice/i.test(line)) assert(/not legal advice/i.test(line), line);
  }
  // Instructions to the assistant ("Never say ... is compliant") are the only place these words may appear.
  const claims = text.split("\n").map((l) => l.replace(/Never say[^.]*\./g, "")).join("\n");
  assertEquals(/(document|contract|policy|notice)s? (is|are) (legally )?(compliant|approved|lawyer-approved|legally binding)/i.test(claims), false);
  assertEquals(/GDPR[- ]compliant|guaranteed compliance|solicitor-approved/i.test(claims), false);
  assert(text.includes("Never say a generated document is compliant, approved or checked by a lawyer."));
});

Deno.test("Phase 30b: QR codes are real, local-only tools say so, old false lines are gone", () => {
  const tools = section("BUSINESS TOOLS");
  assert(tools.includes("makes real, scannable QR codes"));
  for (const t of ["web address", "text", "email", "phone number", "SMS", "WhatsApp", "Wi-Fi", "contact card (vCard)", "PNG and SVG"]) assert(tools.includes(t), t);
  assert(tools.includes("Generate, Validate, Manage and Import / Export tabs, with CSV import and export. Coupons are saved in that browser only."));
  assert(tools.includes("Money → Cash flow. Entries are saved in that browser only."));
  assert(tools.includes("Using a tool, a template or AI Studio, and the dashboard, needs signing in."));
  assert(tools.includes("Back button and a breadcrumb"));
  assert(text.includes("\"You don't have a paid plan yet.\" and a View plans button"));
  assert(text.includes("Users can see their remaining AI credits and reset date on the Dashboard and in Settings → Billing."));
  for (const gone of ["- Contract generator", "- Privacy policy generator", "- Cash flow tracking", "Business cards designer", "Email signature generator",
    "Secure file storage", "Document sharing and collaboration", "File attachments and document management"]) {
    assertEquals(text.includes(gone), false, gone);
  }
});

Deno.test("Phase 30b: two-step sign-in is described as built", () => {
  const sec = section("SECURITY & COMPLIANCE");
  for (const t of ["optional for each user (Settings → Security)", "authenticator app", "required for platform administrators to open the Admin area",
    "There is no SMS option", "a platform administrator checks it is them and then resets their two-step sign-in", "There is no self-service reset"]) {
    assert(sec.includes(t), t);
  }
});

Deno.test("Phase 35: free-trial accounts include 50 AI credits, the same number as the SQL and the screen", async () => {
  assertEquals(TRIAL_AI_CREDITS, 50);
  assert(text.includes("- Free-trial accounts include 50 AI credits."));
  assertEquals(/(trial|free)[^.\n]*\b10 (AI )?credits/i.test(text), false);
  const sql = await Deno.readTextFile(new URL("../../../docs/phase35/proposal.sql", import.meta.url));
  assert(sql.includes("false, 'free', 50, 50)"));
  const ui = await Deno.readTextFile(new URL("../../../src/lib/aiCredits.ts", import.meta.url));
  assert(ui.includes("export const TRIAL_AI_CREDITS = 50;"));
});

Deno.test("Phase 37: top-up packs, 12 months, after monthly, no roll-over, subscribers only; all from the catalogue", async () => {
  const { TOPUP_PACKS } = await import("../_shared/topup-packs.ts");
  for (const p of TOPUP_PACKS) {
    const price = `£${p.amountPence % 100 === 0 ? p.amountPence / 100 : (p.amountPence / 100).toFixed(2)}`;
    assert(text.includes(`${p.credits.toLocaleString("en-GB")} credits ${price}`), `${p.id} missing`);
  }
  assert(text.includes("100 credits £5, 300 credits £12, 1,000 credits £35"));
  for (const s of ["last 12 months", "used after the monthly credits", "don't roll over", "subscribers on their own paid plan only", "prices as shown"]) assert(text.includes(s), s);
});
