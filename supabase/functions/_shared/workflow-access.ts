// Which accounts can use Workflow Studio (owner decision, 28 Oct 2026). ONE rule, shared by the server
// (workflow-send-email, workflow-execute) and the app (src/lib/access.ts → workflowsIncluded), so both always agree.
//
// Included: anyone on the 14-day trial (the trial is the way to try every feature), owners and master accounts
// (state 'owner'), and subscribers on Business ('professional') or Scale ('enterprise').
// Not included: Solo ('starter'), a trial that has ended, a suspended account.
// Company members follow the paying account: _access_state_for() returns that account's plan_key with via='company'.
// An unknown or missing plan key, or an unknown state, fails closed (not included) and is reported.
//
// The input is one row of public._access_state_for(uid) / my_access_state() — the single source of access and plan.

export const WORKFLOW_PLAN_KEYS = ["professional", "enterprise"] as const;
/** Plan keys the catalogue knows (supabase/functions/_shared/plans.ts). Anything else is "unknown" and fails closed. */
const KNOWN_PLAN_KEYS = ["starter", "professional", "enterprise"];

export const WORKFLOWS_NOT_INCLUDED_MESSAGE = "Workflows are included in the Business and Scale plans.";
export const WORKFLOWS_NOT_INCLUDED_COMPANY_MESSAGE =
  "Workflows are included in the Business and Scale plans. Your company's plan doesn't include them; the account owner can change the plan.";
export const WORKFLOW_PLAN_CHECK_FAILED =
  "We couldn't check your plan just now, so nothing was sent. Please try again in a moment.";

export interface WorkflowAccessInput {
  state?: string | null;
  plan_key?: string | null;
  via?: string | null;
}

export type WorkflowAccess =
  | { included: true; reason: "trial" | "owner" | "plan" }
  | { included: false; reason: "plan_not_included" | "unknown_plan" | "trial_ended" | "suspended" | "unknown_state"; via: "self" | "company" };

export function workflowAccess(row: WorkflowAccessInput | null | undefined): WorkflowAccess {
  const via = row?.via === "company" ? "company" : "self";
  const state = row?.state;
  if (state === "trial") return { included: true, reason: "trial" };
  if (state === "owner") return { included: true, reason: "owner" };
  if (state === "trial_ended") return { included: false, reason: "trial_ended", via };
  if (state === "suspended") return { included: false, reason: "suspended", via };
  if (state === "subscribed") {
    const key = typeof row?.plan_key === "string" ? row.plan_key.trim().toLowerCase() : "";
    if ((WORKFLOW_PLAN_KEYS as readonly string[]).includes(key)) return { included: true, reason: "plan" };
    if (KNOWN_PLAN_KEYS.includes(key)) return { included: false, reason: "plan_not_included", via };
    return { included: false, reason: "unknown_plan", via };
  }
  return { included: false, reason: "unknown_state", via };
}

/** true only when the rule above includes workflows. */
export const workflowsIncluded = (row: WorkflowAccessInput | null | undefined): boolean => workflowAccess(row).included;
