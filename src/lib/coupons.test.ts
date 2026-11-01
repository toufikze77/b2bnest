import { describe, it, expect } from 'vitest';
import { checkCoupon, couponsToCsv, generateCodes, MAX_BULK, parseCouponsCsv, type Coupon, type GenerationPreset } from './coupons';

const preset: GenerationPreset = { id: 'p', name: 'p', pattern: '', length: 8, groups: 1, separator: '-', charset: 'alphanumeric', caseStyle: 'upper' };
const c = (over: Partial<Coupon> = {}): Coupon => ({ id: 'id1', code: 'SPRING-1234', discountType: 'percentage', value: 10, tags: [], isStackable: false, isActive: true, ...over });

describe('generateCodes', () => {
  it('makes the requested number of unique codes in one pass, avoiding existing ones', () => {
    const existing = new Set(['TAKEN']);
    const { codes, shortBy } = generateCodes(preset, 500, existing);
    expect(codes).toHaveLength(500);
    expect(new Set(codes).size).toBe(500);
    expect(codes).not.toContain('TAKEN');
    expect(shortBy).toBe(0);
  });
  it('a tiny pattern stops instead of looping forever, and says how many it could not make', () => {
    const tiny: GenerationPreset = { ...preset, length: 1, charset: 'numeric' }; // only 10 possible codes
    const { codes, shortBy } = generateCodes(tiny, 50, new Set());
    expect(codes.length).toBeLessThanOrEqual(10);
    expect(shortBy).toBe(50 - codes.length);
  });
  it('the cap is 10,000', () => expect(MAX_BULK).toBe(10_000));
});

describe('checkCoupon (Validate tab)', () => {
  const today = '2026-11-02';
  it.each([
    ['valid', [c()], 'SPRING-1234'],
    ['valid (case-insensitive match)', [c()], 'spring-1234'],
    ['unknown', [c()], 'NOPE-0000'],
    ['not_started', [c({ startDate: '2026-12-01' })], 'SPRING-1234'],
    ['expired', [c({ endDate: '2026-11-01' })], 'SPRING-1234'],
    ['used_up', [c({ maxUses: 3, uses: 3 })], 'SPRING-1234'],
    ['deactivated', [c({ isActive: false })], 'SPRING-1234'],
    ['invalid', [c({ value: 150 })], 'SPRING-1234'],
  ] as const)('%s', (label, coupons, code) => {
    expect(checkCoupon(code, coupons, today).status).toBe(label.split(' ')[0]);
  });
  it('start and end dates are inclusive; 2 of 3 uses is still valid', () => {
    expect(checkCoupon('SPRING-1234', [c({ startDate: today, endDate: today, maxUses: 3, uses: 2 })], today).status).toBe('valid');
  });
});

describe('CSV import / export', () => {
  it('round-trips, and rejects bad rows and repeated codes with a reason', () => {
    const csv = couponsToCsv([c({ description: 'Says "hi", twice' }), c({ id: 'id2', code: 'SUMMER-9999', uses: 1, maxUses: 5 })]);
    const back = parseCouponsCsv(csv, new Set());
    expect(back.imported.map((x) => [x.code, x.uses ?? 0, x.description ?? ''])).toEqual([['SPRING-1234', 0, 'Says "hi", twice'], ['SUMMER-9999', 1, '']]);
    const bad = parseCouponsCsv(`${csv}\nx,AB,percentage,10\ny,GOOD-0001,weird,10\nz,SPRING-1234,percentage,10`, new Set(['SUMMER-9999']));
    expect(bad.imported.map((x) => x.code)).toEqual(['SPRING-1234']);
    expect(bad.rejected.map((r) => r.reason)).toEqual([
      'Code SUMMER-9999 already exists.', 'Code must be at least 4 characters.', 'Unknown discount type "weird".', 'Code SPRING-1234 already exists.',
    ]);
  });
  it('a file without a code column is rejected plainly', () => {
    expect(parseCouponsCsv('a,b\n1,2', new Set()).rejected[0].reason).toMatch(/No "code" column/);
  });
});
