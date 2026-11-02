// Phase 37: AI credit top-up packs. MUST match public.ai_topup_packs (docs/phase37/proposal.sql) and
// src/lib/aiTopups.ts; src/lib/aiTopups.test.ts checks all three agree. Prices are what the customer pays, in pence.
export type TopupPack = { id: string; credits: number; amountPence: number };

export const TOPUP_PACKS: readonly TopupPack[] = [
  { id: "credits_100", credits: 100, amountPence: 500 },
  { id: "credits_300", credits: 300, amountPence: 1200 },
  { id: "credits_1000", credits: 1000, amountPence: 3500 },
] as const;

/** Most unexpired top-up credits one account may hold (open checkouts count). */
export const TOPUP_CAP = 5000;
/** Purchased credits last this many months. */
export const TOPUP_VALID_MONTHS = 12;
/** Checkout sessions expire after this many seconds (the database counts open checkouts for 35 minutes). */
export const TOPUP_SESSION_SECONDS = 31 * 60;

export const topupPack = (id: unknown): TopupPack | null =>
  typeof id === "string" ? TOPUP_PACKS.find((p) => p.id === id) ?? null : null;

const pounds = (pence: number) => `£${pence % 100 === 0 ? (pence / 100).toLocaleString("en-GB") : (pence / 100).toFixed(2)}`;
/** "100 credits £5, 300 credits £12, 1,000 credits £35" (built from the catalogue). */
export const topupPacksText = () => TOPUP_PACKS.map((p) => `${p.credits.toLocaleString("en-GB")} credits ${pounds(p.amountPence)}`).join(", ");
