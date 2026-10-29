// Phase 20: the assistant's platform knowledge can't state a price, credit amount or workflow plan that disagrees with
// the plan catalogue (_shared/plans.ts) or the workflow rule (_shared/workflow-access.ts).
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { platformKnowledge, NON_WORKFLOW_PLAN_NAMES, WORKFLOW_PLAN_NAMES } from "./knowledge.ts";
import { PLAN_CATALOG } from "../_shared/plans.ts";
import { workflowsIncluded } from "../_shared/workflow-access.ts";

const text = platformKnowledge();
const plans = Object.values(PLAN_CATALOG);
const pounds = (p: number) => `£${p / 100}`;

Deno.test("every price in the text is a catalogue price for that plan, and every plan's prices are there", () => {
  const allowed = new Set(plans.flatMap((p) => [pounds(p.prices.month.amount), pounds(p.prices.year.amount)]));
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

Deno.test("every 'N AI credits' figure is a catalogue credit allowance", () => {
  const allowed = new Set(plans.map((p) => p.aiCreditLimit));
  for (const m of text.matchAll(/([\d,]+) AI credits/g)) assert(allowed.has(Number(m[1].replace(/,/g, ""))), m[0]);
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
    "Document version control", "Sentiment analysis", "Predictive analytics", "Scheduled reports", "company's email settings", "Steps that don't run yet are hidden"]) {
    assertEquals(text.includes(gone), false, gone);
  }
  for (const kept of ["HMRC filing is not available yet", "Two-step sign-in is not active yet", "There is no mobile app and no public API",
    "No plan includes a support response-time promise", "posting from B2BNEST is switched off for customers"]) assert(text.includes(kept), kept);
});

Deno.test("Phase 21: no 'coming soon' promises, and COLLABORATION says only what the code does", () => {
  assertEquals(/coming soon|team chat \(|video conferenc/i.test(text), false);
  for (const gone of ["Comments and mentions", "File sharing", "Real-time collaboration", "Team workspaces"]) assertEquals(text.includes(gone), false, gone);
  assert(text.includes("There is no team chat, no video calls, no @mentions and no shared file storage"));
});
