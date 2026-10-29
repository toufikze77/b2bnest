import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { workflowAccess, workflowsIncluded } from "./workflow-access.ts";
import { PLAN_CATALOG } from "./plans.ts";

Deno.test("workflows rule: every state and plan, company members, unknown plans fail closed", () => {
  const cases: [Parameters<typeof workflowAccess>[0], boolean, string][] = [
    [{ state: "trial", plan_key: null, via: "self" }, true, "trial"],
    [{ state: "trial", plan_key: null, via: "company" }, true, "trial"],
    [{ state: "owner", plan_key: null }, true, "owner"],
    [{ state: "subscribed", plan_key: "professional", via: "self" }, true, "plan"],
    [{ state: "subscribed", plan_key: "enterprise", via: "self" }, true, "plan"],
    [{ state: "subscribed", plan_key: "professional", via: "company" }, true, "plan"],
    [{ state: "subscribed", plan_key: "Enterprise" }, true, "plan"],
    [{ state: "subscribed", plan_key: "starter", via: "self" }, false, "plan_not_included"],
    [{ state: "subscribed", plan_key: "starter", via: "company" }, false, "plan_not_included"],
    [{ state: "subscribed", plan_key: "gold" }, false, "unknown_plan"],
    [{ state: "subscribed", plan_key: null }, false, "unknown_plan"],
    [{ state: "subscribed", plan_key: "" }, false, "unknown_plan"],
    [{ state: "trial_ended", plan_key: null, via: "self" }, false, "trial_ended"],
    [{ state: "trial_ended", plan_key: null, via: "company" }, false, "trial_ended"],
    [{ state: "suspended", plan_key: "enterprise" }, false, "suspended"],
    [{ state: "something_new" }, false, "unknown_state"],
    [{}, false, "unknown_state"],
    [null, false, "unknown_state"],
  ];
  for (const [row, included, reason] of cases) {
    const a = workflowAccess(row);
    assertEquals([a.included, a.reason], [included, reason], JSON.stringify(row));
    assertEquals(workflowsIncluded(row), included);
  }
  assertEquals(workflowAccess({ state: "subscribed", plan_key: "starter", via: "company" }), { included: false, reason: "plan_not_included", via: "company" });
});

Deno.test("every catalogue plan key is classified (none falls through as unknown); legacy prices share the key", () => {
  const byKey = Object.keys(PLAN_CATALOG).map((k) => [k, workflowAccess({ state: "subscribed", plan_key: k }).reason]);
  assertEquals(byKey, [["starter", "plan_not_included"], ["professional", "plan"], ["enterprise", "plan"]]);
  // Legacy prices (Business £35/£350, Scale £85/£850) belong to the same plan key, so they follow the same rule.
  assertEquals(Object.values(PLAN_CATALOG).filter((p) => p.legacy).map((p) => p.key), ["professional", "enterprise"]);
});

import { workflowRefusal, WORKFLOW_PLAN_CHECK_FAILED, WORKFLOWS_NOT_INCLUDED_MESSAGE } from "./workflow-access.ts";
Deno.test("workflowRefusal: null when included; fails closed; same codes as the Phase 19 functions", () => {
  const m = { suspended: "S", trialEnded: "T", companyTrialEnded: "CT" };
  assertEquals(workflowRefusal(workflowAccess({ state: "trial" }), m), null);
  assertEquals(workflowRefusal(workflowAccess({ state: "subscribed", plan_key: "enterprise" }), m), null);
  assertEquals(workflowRefusal(null, m), { status: 503, code: "plan_check_failed", message: WORKFLOW_PLAN_CHECK_FAILED });
  assertEquals(workflowRefusal(workflowAccess({}), m)?.code, "plan_check_failed");
  assertEquals(workflowRefusal(workflowAccess({ state: "subscribed", plan_key: "starter" }), m), { status: 403, code: "plan_not_included", message: WORKFLOWS_NOT_INCLUDED_MESSAGE });
  assertEquals(workflowRefusal(workflowAccess({ state: "trial_ended", via: "company" }), m), { status: 402, code: "trial_ended", message: "CT" });
  assertEquals(workflowRefusal(workflowAccess({ state: "suspended" }), m), { status: 403, code: "account_suspended", message: "S" });
});
