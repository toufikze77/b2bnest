import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BILLING_LINK_ERROR, BILLING_LINK_ERROR_CODE, isBillingLinkError, readFunctionError } from './billingErrors';

describe('billing-link error (Phase 14)', () => {
  it('is the exact message the owner asked for', () => {
    expect(BILLING_LINK_ERROR).toBe("We couldn't link your billing account. Please contact support.");
  });

  it('matches the server copy in supabase/functions/_shared/verified-customer.ts', () => {
    const server = readFileSync('supabase/functions/_shared/verified-customer.ts', 'utf8');
    expect(server).toContain(`BILLING_LINK_ERROR = "${BILLING_LINK_ERROR}"`);
    expect(server).toContain(`BILLING_LINK_ERROR_CODE = "${BILLING_LINK_ERROR_CODE}"`);
  });

  it('recognises the code in raw text and in a parsed body, nothing else', () => {
    expect(isBillingLinkError('{"error":"billing_account_unverified","message":"x"}')).toBe(true);
    expect(isBillingLinkError({ error: 'billing_account_unverified' })).toBe(true);
    expect(isBillingLinkError({ error: 'already_subscribed' })).toBe(false);
    expect(isBillingLinkError('plan_not_available')).toBe(false);
    expect(isBillingLinkError(null)).toBe(false);
  });

  it('reads a functions.invoke error body, and copes with none', async () => {
    const err = { context: { json: async () => ({ error: 'billing_account_unverified' }) } };
    expect(await readFunctionError(err)).toEqual({ error: 'billing_account_unverified' });
    expect(await readFunctionError(new Error('x'))).toBeNull();
    expect(await readFunctionError({ context: { json: async () => { throw new Error('not json'); } } })).toBeNull();
  });

  it('is shown by every screen that starts a Stripe checkout', () => {
    for (const file of ['src/components/PricingPlans.tsx', 'src/components/checkout/StripeCheckout.tsx']) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).toContain('isBillingLinkError(');
      expect(src, file).toContain('BILLING_LINK_ERROR');
    }
  });
});
