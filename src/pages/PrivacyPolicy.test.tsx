// HMRC P7d: the live Privacy Policy renders the HMRC section, the download and delete section and the contact address,
// and none of the phrases that aren't backed by the code (docs/hmrc-p7d/README.md).
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Footer', () => ({ default: () => <footer /> }));

import PrivacyPolicy, { PRIVACY_CONTACT, PRIVACY_LAST_UPDATED } from './PrivacyPolicy';

const page = () => render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);

describe('Privacy Policy (live page)', () => {
  it('last updated today, and the contact address is info@b2bnest.online', () => {
    page();
    expect(screen.getByTestId('privacy-updated')).toHaveTextContent('Last updated: 9 November 2026');
    expect(PRIVACY_LAST_UPDATED).toBe('9 November 2026');
    expect(PRIVACY_CONTACT).toBe('info@b2bnest.online');
    expect(within(screen.getByTestId('privacy-contact')).getByText('Email: info@b2bnest.online')).toBeInTheDocument();
  });

  it('the HMRC section: test environment only, fraud prevention information, what we keep, records that cannot change, live readings not stored', () => {
    page();
    const h = screen.getByTestId('privacy-hmrc');
    expect(within(h).getByRole('heading', { name: 'Making Tax Digital and HMRC' })).toBeInTheDocument();
    expect(h).toHaveTextContent("currently use HMRC's test environment only: nothing is filed with HMRC for real");
    expect(h).toHaveTextContent('fraud prevention information');
    expect(h).toHaveTextContent('a random device identifier');
    expect(h).toHaveTextContent('never the code');
    expect(h).toHaveTextContent('When an owner or admin chooses Disconnect, the tokens are deleted at once.');
    expect(h).toHaveTextContent("Records of returns sent can't be changed or deleted");
    expect(h).toHaveTextContent('What HMRC shows you is not stored.');
  });

  it('retention as the owner decided, and the business keeps its own VAT records', () => {
    page();
    const r = screen.getByTestId('privacy-retention');
    expect(r).toHaveTextContent('6 years after the end of the VAT period');
    expect(r).toHaveTextContent('12 months');
    expect(r).toHaveTextContent('only while your company stays connected to HMRC');
    expect(r).toHaveTextContent("Keeping your own VAT records is your business's legal duty, not ours. Download your data before");
  });

  it('download and delete: Settings > Your data, a fresh sign-in, and info@b2bnest.online for anything else', () => {
    page();
    const d = screen.getByTestId('privacy-your-data');
    expect(within(d).getByRole('link', { name: 'Settings > Your data' })).toHaveAttribute('href', '/settings?tab=data');
    for (const t of ['Download my data:', 'Download company data:', 'Close this company:', 'Delete my account:']) expect(d).toHaveTextContent(t);
    expect(d).toHaveTextContent('asks you to sign in again');
    expect(d).toHaveTextContent('email info@b2bnest.online');
  });

  it('none of the banned phrases', () => {
    const { container } = page();
    const text = container.textContent ?? '';
    for (const re of [/\(adviser/i, /\bDPO\b/, /data protection officer/i, /\b(30|90) days\b/i, /Article \d/, /backup/i, /security audits/i, /admin@b2bnest/i,
      /HMRC (approved|accredited|recognised)/i, /penetration test/i, /WCAG/i, /lawyer/i])
      expect(text).not.toMatch(re);
  });
});
