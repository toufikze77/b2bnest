import fs from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Signed out, and any Supabase call fails the test: the page must render with neither.
vi.mock('@/integrations/supabase/client', () => ({ supabase: new Proxy({}, { get: () => { throw new Error('Business Resources must not call Supabase'); } }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));

import BusinessResourcesPage, { BUSINESS_RESOURCES_TITLE } from './BusinessResourcesPage';
import { GUIDANCE, REFERRAL_DISCLOSURE, REFERRALS } from '@/components/BusinessResources';

const show = () => render(<MemoryRouter><BusinessResourcesPage /></MemoryRouter>);

describe('/business-resources (public)', () => {
  it('renders signed out with exactly one h1, a unique title and a canonical URL', () => {
    show();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(BUSINESS_RESOURCES_TITLE);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.b2bnest.online/business-resources');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(/GOV\.UK and HMRC guidance/);
  });

  it('JSON-LD has a WebPage and an ItemList of every link', () => {
    show();
    const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!);
    const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toEqual(['WebPage', 'ItemList']);
    const count = GUIDANCE.reduce((n, s) => n + s.links.length, 0) + REFERRALS.length;
    expect(ld['@graph'][1].itemListElement).toHaveLength(count);
  });

  it('affiliate disclosure near the top and next to each referral link', () => {
    show();
    expect(screen.getByTestId('disclosure-top')).toHaveTextContent(REFERRAL_DISCLOSURE);
    expect(REFERRAL_DISCLOSURE).toBe('We may earn a commission if you sign up through this link. It does not change the price you pay.');
    expect(screen.getAllByTestId('disclosure-link')).toHaveLength(REFERRALS.length);
    for (const r of REFERRALS) {
      const card = screen.getByRole('link', { name: new RegExp(`Visit ${r.provider}`) }).closest('article')!;
      expect(within(card as HTMLElement).getByTestId('disclosure-link')).toHaveTextContent(REFERRAL_DISCLOSURE);
    }
  });

  it('referral links are rel="sponsored noopener noreferrer"; guidance links only go to GOV.UK', () => {
    show();
    const links = screen.getAllByRole('link') as HTMLAnchorElement[];
    const external = links.filter((a) => a.getAttribute('href')?.startsWith('http'));
    for (const a of external) {
      const href = a.getAttribute('href')!;
      if (REFERRALS.some((r) => r.url === href)) expect(a).toHaveAttribute('rel', 'sponsored noopener noreferrer');
      else {
        expect(href.startsWith('https://www.gov.uk/'), href).toBe(true);
        expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      }
      expect(a).toHaveAttribute('target', '_blank');
    }
    expect(external.length).toBe(GUIDANCE.reduce((n, s) => n + s.links.length, 0) + REFERRALS.length);
  });

  it('no ratings, review scores or "Starting at" prices; no HMRC filing claim', () => {
    const { container } = show();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Starting at|★|☆|\/month|rating|reviews?\b/i);
    expect(text).not.toMatch(/files? (your )?(VAT|returns?) with HMRC|submits? to HMRC/i);
    expect(text).toMatch(/does not file anything with HMRC/);
  });

  it('CTA: 14-day trial to sign-up, plus Pricing', () => {
    show();
    expect(screen.getByRole('link', { name: 'Try B2BNEST free for 14 days' })).toHaveAttribute('href', '/auth?mode=signup');
    expect(screen.getByRole('link', { name: 'See plans and prices' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByText(/After 14 days you choose a plan to continue/)).toBeInTheDocument();
  });

  it('is in the sitemap, llms.txt, the router, nav, footer and homepage', () => {
    const root = path.resolve(__dirname, '../..');
    const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
    expect(read('public/sitemap.xml')).toContain('<loc>https://www.b2bnest.online/business-resources</loc>');
    expect(read('public/llms.txt')).toContain('(/business-resources)');
    expect(read('src/App.tsx')).toContain('<Route path="/business-resources" element={<BusinessResourcesPage />} />');
    expect(read('src/components/Header.tsx').match(/to="\/business-resources"/g)).toHaveLength(2);
    expect(read('src/components/Footer.tsx')).toContain("navigate('/business-resources')");
    expect(read('src/pages/Index.tsx')).toContain('to="/business-resources"');
  });
});
