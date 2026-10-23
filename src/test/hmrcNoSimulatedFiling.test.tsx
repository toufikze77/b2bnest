import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HMRCVATReturns from '@/components/hmrc/HMRCVATReturns';
import HMRCTaxReturns from '@/components/hmrc/HMRCTaxReturns';
import HMRCPayrollSubmissions from '@/components/hmrc/HMRCPayrollSubmissions';
import HMRCObligations from '@/components/hmrc/HMRCObligations';
import { HMRC_FILING_UNAVAILABLE } from '@/components/hmrc/filingStatus';

// HMRC filing is not built. No screen may simulate a successful filing, invent a reference, or record "submitted".
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));

const SRC = path.resolve(__dirname, '..');
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.endsWith(path.join('supabase', 'types.ts')) ? [p] : [];
  });
}
const all = files(SRC).map((f) => ({ f: path.relative(SRC, f), src: fs.readFileSync(f, 'utf8') }));
const hits = (re: RegExp) => all.flatMap(({ f, src }) => src.split('\n').flatMap((l, i) => (re.test(l) ? [`${f}:${i + 1}: ${l.trim().slice(0, 110)}`] : [])));

describe('no simulated HMRC filing in the code', () => {
  it('hmrcService has no Math.random (no invented references)', () => {
    expect(fs.readFileSync(path.join(SRC, 'services', 'hmrcService.ts'), 'utf8')).not.toMatch(/Math\.random/);
  });
  it('no fake submit functions remain in hmrcService', () => {
    expect(fs.readFileSync(path.join(SRC, 'services', 'hmrcService.ts'), 'utf8')).not.toMatch(/submitFPS|submitEPS|logSubmission/);
  });
  it('nothing in src writes hmrc_submission_logs (only a real HMRC response may record a submission)', () => {
    expect(hits(/hmrc_submission_logs['"]\)\s*\.(insert|upsert|update)/)).toEqual([]);
  });
  it('no "successfully submitted" wording for HMRC anywhere in src', () => {
    const hmrcFile = (h: string) => /hmrc|payroll|vat|tax/i.test(h.split(':')[0]);
    expect(hits(/successfully submitted|submitted successfully|Submitted to HMRC/i).filter((h) => hmrcFile(h) || /HMRC|VAT|FPS|EPS|RTI/.test(h))).toEqual([]);
  });
  it('no invented HMRC reference strings in the HMRC screens', () => {
    expect(hits(/['"`](VAT|FPS|EPS|SA|CT)-[A-Z0-9-]{6,}['"`]/).filter((h) => h.startsWith('components'))).toEqual([]);
  });
});

describe.each([
  ['VAT returns', HMRCVATReturns],
  ['Tax returns', HMRCTaxReturns],
  ['Payroll (FPS/EPS)', HMRCPayrollSubmissions],
  ['Obligations', HMRCObligations],
])('%s screen', (_name, Screen) => {
  it('shows the "not available" banner, never a submitted state, and every submit button is disabled', () => {
    render(<Screen />);
    expect(screen.getByText(HMRC_FILING_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(/successfully submitted|submitted successfully/i)).toBeNull();
    expect(screen.queryByText(/^Submitted$/i)).toBeNull();
    const submits = screen.queryAllByRole('button', { name: /submit/i });
    for (const b of submits) expect(b).toBeDisabled();
  });
});
