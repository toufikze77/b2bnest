// Coupon generator rules (Phase 29: moved out of CouponGenerator.tsx so they can be tested; the rules are unchanged).

export type CodeCharset = 'alphanumeric' | 'alpha' | 'numeric' | 'hex' | 'custom';
export type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'bogo';
export type CaseStyle = 'upper' | 'lower' | 'mixed';

export type Coupon = {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number; // percentage or fixed currency value
  currency?: string;
  minSpend?: number;
  maxUses?: number; // overall uses across all customers
  /** How many times it has been used (recorded with "Record a use"). Older saved coupons have none: 0. */
  uses?: number;
  perCustomerLimit?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  tags: string[];
  isStackable: boolean;
  isActive: boolean;
  metadata?: Record<string, string>;
};

export type GenerationPreset = {
  id: string;
  name: string;
  pattern: string;
  length: number;
  groups: number;
  separator: string;
  charset: CodeCharset;
  customCharset?: string;
  caseStyle: CaseStyle;
  prefix?: string;
  suffix?: string;
};

export const DISCOUNT_TYPES: DiscountType[] = ['percentage', 'fixed', 'free_shipping', 'bogo'];
/** One generation makes at most this many codes. */
export const MAX_BULK = 10_000;
export const MAX_BULK_MESSAGE = `You can generate up to ${MAX_BULK.toLocaleString('en-GB')} codes at a time.`;

export const buildCharset = (charset: CodeCharset, customCharset?: string): string => {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const numeric = '0123456789';
  if (charset === 'alpha') return alpha;
  if (charset === 'numeric') return numeric;
  if (charset === 'hex') return '0123456789ABCDEF';
  if (charset === 'custom') return customCharset && customCharset.length > 0 ? customCharset : 'ABCDEF0123456789';
  return alpha + numeric;
};

const applyCase = (input: string, style: CaseStyle): string =>
  style === 'upper' ? input.toUpperCase() : style === 'lower' ? input.toLowerCase() : input;

const token = (length: number, charset: string): string => {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let out = '';
  for (let i = 0; i < length; i++) out += charset[values[i] % charset.length];
  return out;
};

/** One code in the preset's shape: [prefix-]group-group…[-suffix]. */
export function buildCode(preset: GenerationPreset): string {
  const charset = buildCharset(preset.charset, preset.customCharset);
  const parts: string[] = [];
  for (let g = 0; g < preset.groups; g++) parts.push(applyCase(token(preset.length, charset), preset.caseStyle));
  let code = parts.join(preset.separator);
  if (preset.prefix) code = `${preset.prefix}${preset.separator}${code}`;
  if (preset.suffix) code = `${code}${preset.separator}${preset.suffix}`;
  return code;
}

/**
 * `quantity` new codes in one pass, unique among themselves and against `existing`. When the pattern is too small to
 * make that many different codes, it stops after a bounded number of tries and reports how many it could not make.
 */
export function generateCodes(preset: GenerationPreset, quantity: number, existing: ReadonlySet<string>): { codes: string[]; shortBy: number } {
  const seen = new Set(existing);
  const codes: string[] = [];
  const maxTries = quantity * 10 + 100;
  for (let tries = 0; codes.length < quantity && tries < maxTries; tries++) {
    const code = buildCode(preset);
    if (!seen.has(code)) { seen.add(code); codes.push(code); }
  }
  return { codes, shortBy: quantity - codes.length };
}

export const validateCoupon = (coupon: Coupon): string[] => {
  const errors: string[] = [];
  if (!coupon.code || coupon.code.length < 4) errors.push('Code must be at least 4 characters.');
  if (coupon.discountType === 'percentage' && (coupon.value <= 0 || coupon.value > 100)) errors.push('Percentage must be between 1 and 100.');
  if (coupon.discountType === 'fixed' && coupon.value <= 0) errors.push('Fixed amount must be greater than 0.');
  if (coupon.minSpend && coupon.minSpend < 0) errors.push('Minimum spend cannot be negative.');
  if (coupon.maxUses && coupon.maxUses <= 0) errors.push('Max uses must be greater than 0.');
  if (coupon.perCustomerLimit && coupon.perCustomerLimit <= 0) errors.push('Per-customer limit must be greater than 0.');
  if (coupon.startDate && coupon.endDate && new Date(coupon.startDate) > new Date(coupon.endDate)) errors.push('Start date must be before end date.');
  return errors;
};

export type CouponStatus = 'valid' | 'unknown' | 'not_started' | 'expired' | 'used_up' | 'deactivated' | 'invalid';
export const COUPON_STATUS_TEXT: Record<CouponStatus, string> = {
  valid: 'Valid: this code can be used.',
  unknown: 'Unknown: no saved coupon has this code.',
  not_started: 'Not started yet: this code works from its start date.',
  expired: 'Expired: the end date has passed.',
  used_up: 'Used up: it has reached its maximum number of uses.',
  deactivated: 'Deactivated: this code has been switched off.',
  invalid: "This coupon's settings are not valid.",
};

/** Local date as YYYY-MM-DD (the format of the date inputs). */
export const todayIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Checks a typed code against the saved coupons. Start and end dates are inclusive. */
export function checkCoupon(input: string, coupons: readonly Coupon[], today = todayIso()): { status: CouponStatus; coupon?: Coupon; problems?: string[] } {
  const code = input.trim();
  if (!code) return { status: 'unknown' };
  const coupon = coupons.find((c) => c.code === code) ?? coupons.find((c) => c.code.toLowerCase() === code.toLowerCase());
  if (!coupon) return { status: 'unknown' };
  if (!coupon.isActive) return { status: 'deactivated', coupon };
  const problems = validateCoupon(coupon);
  if (problems.length) return { status: 'invalid', coupon, problems };
  if (coupon.startDate && today < coupon.startDate) return { status: 'not_started', coupon };
  if (coupon.endDate && today > coupon.endDate) return { status: 'expired', coupon };
  if (coupon.maxUses && (coupon.uses ?? 0) >= coupon.maxUses) return { status: 'used_up', coupon };
  return { status: 'valid', coupon };
}

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { values.push(current); current = ''; } else current += ch;
  }
  values.push(current);
  return values;
};

export type ImportResult = { imported: Coupon[]; rejected: { line: number; reason: string }[] };

/** Reads an exported coupons CSV. Rows that would not pass validateCoupon, or repeat a code, are rejected with a reason. */
export function parseCouponsCsv(text: string, existingCodes: ReadonlySet<string>, newId: () => string = () => crypto.randomUUID()): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { imported: [], rejected: [{ line: 1, reason: 'The file is empty.' }] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  if (!headers.includes('code')) return { imported: [], rejected: [{ line: 1, reason: 'No "code" column. Use a file exported from this tool.' }] };
  const seen = new Set(existingCodes);
  const result: ImportResult = { imported: [], rejected: [] };
  lines.slice(1).forEach((line, i) => {
    const values = parseCsvLine(line);
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (values[idx] ?? '').trim(); });
    const type = (o.discountType || 'percentage') as DiscountType;
    const coupon: Coupon = {
      id: o.id || newId(),
      code: o.code,
      discountType: type,
      value: Number(o.value || 0),
      currency: o.currency || undefined,
      minSpend: o.minSpend ? Number(o.minSpend) : undefined,
      maxUses: o.maxUses ? Number(o.maxUses) : undefined,
      uses: o.uses ? Number(o.uses) : undefined,
      perCustomerLimit: o.perCustomerLimit ? Number(o.perCustomerLimit) : undefined,
      startDate: o.startDate || undefined,
      endDate: o.endDate || undefined,
      description: o.description || undefined,
      tags: (o.tags || '').split('|').map((t) => t.trim()).filter(Boolean),
      isStackable: o.isStackable === 'true',
      isActive: o.isActive !== 'false',
    };
    const lineNo = i + 2;
    if (!DISCOUNT_TYPES.includes(type)) return void result.rejected.push({ line: lineNo, reason: `Unknown discount type "${type}".` });
    const problems = validateCoupon(coupon);
    if (problems.length) return void result.rejected.push({ line: lineNo, reason: problems[0] });
    if (seen.has(coupon.code)) return void result.rejected.push({ line: lineNo, reason: `Code ${coupon.code} already exists.` });
    seen.add(coupon.code);
    result.imported.push(coupon);
  });
  return result;
}

export function couponsToCsv(coupons: readonly Coupon[]): string {
  const headers = ['id', 'code', 'discountType', 'value', 'currency', 'minSpend', 'maxUses', 'uses', 'perCustomerLimit', 'startDate', 'endDate', 'description', 'tags', 'isStackable', 'isActive'];
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = coupons.map((c) => [c.id, c.code, c.discountType, c.value, c.currency, c.minSpend, c.maxUses, c.uses ?? 0, c.perCustomerLimit,
    c.startDate, c.endDate, (c.description ?? '').replace(/\n/g, ' '), c.tags.join('|'), c.isStackable, c.isActive].map(cell).join(','));
  return [headers.join(','), ...rows].join('\n');
}
