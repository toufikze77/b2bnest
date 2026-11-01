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

describe('functionErrorText (Phase 26)', () => {
  it('prefers the message, then a sentence in error, else the fallback; never "non-2xx", codes or stack lines', async () => {
    const { functionErrorText } = await import('./billingErrors');
    expect(functionErrorText({ error: 'already_on_plan', message: 'This is already your current plan.' }, 'x')).toBe('This is already your current plan.');
    expect(functionErrorText({ error: 'No verified billing account found for this user. Please contact support.' }, 'x')).toBe('No verified billing account found for this user. Please contact support.');
    expect(functionErrorText({ error: 'no_subscription' }, 'fallback')).toBe('fallback');
    expect(functionErrorText({ error: 'Edge Function returned a non-2xx status code' }, 'fallback')).toBe('fallback');
    expect(functionErrorText({ error: 'Card declined by bank\n    at foo (bar.js:1:2)' }, 'x')).toBe('Card declined by bank');
    expect(functionErrorText(null, 'fallback')).toBe('fallback');
    expect(functionErrorText({ message: 'y '.repeat(400) }, 'x').length).toBeLessThanOrEqual(300);
  });
  it('isNoCustomer only for a 404 with reason no_customer', async () => {
    const { isNoCustomer } = await import('./billingErrors');
    expect(isNoCustomer(404, { reason: 'no_customer' })).toBe(true);
    expect(isNoCustomer(409, { reason: 'no_customer' })).toBe(false);
    expect(isNoCustomer(404, { reason: 'unverified' })).toBe(false);
    expect(isNoCustomer(null, null)).toBe(false);
  });
});
