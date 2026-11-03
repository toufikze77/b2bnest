import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import FreeToolsBanner from './FreeToolsBanner';
import { REFERRAL_GROUPS, REFERRAL_PARTNERS, type ReferralGroup, type ReferralPartner } from '@/data/freeToolsPromos';
import { REVOLUT_BUSINESS } from '@/data/referralLinks';
import { REFERRALS } from '@/components/BusinessResources';

const show = (p?: { groups?: ReferralGroup[]; partners?: ReferralPartner[] }) => render(<MemoryRouter><FreeToolsBanner {...p} /></MemoryRouter>);
const GROUPS: ReferralGroup[] = [{ id: 'banking', label: 'Banking & finance' }, { id: 'accounting', label: 'Accounting software' }, { id: 'legal', label: 'Legal' }];
const BANK: ReferralPartner = { id: 'b1', name: 'Bank One', description: 'A business account.', url: 'https://bank.example.test/ref', group: 'banking' };
const ACCOUNTS: ReferralPartner = { id: 'a1', name: 'Books One', description: 'Accounting software.', url: 'https://books.example.test/ref', offer: 'Offer exactly as stated', group: 'accounting' };

beforeEach(() => { sessionStorage.clear(); });

describe('FreeToolsBanner referral groups (Phase 38 follow-up)', () => {
  it('ships one group, "Banking & finance", with one entry: Revolut Business from the shared referral data', () => {
    expect(REFERRAL_GROUPS).toEqual([{ id: 'banking', label: 'Banking & finance' }]);
    expect(REFERRAL_PARTNERS).toEqual([{ id: 'revolut-business', name: REVOLUT_BUSINESS.name, description: REVOLUT_BUSINESS.description, url: REVOLUT_BUSINESS.url, group: 'banking' }]);
    expect(REFERRALS[0]).toBe(REVOLUT_BUSINESS); // the Business Resources page uses the same entry: one place for the link
    expect(REFERRAL_PARTNERS.every((p) => !p.offer)).toBe(true);
  });

  it('as shipped: Revolut Business under "Banking & finance", no selector, the commission line and sponsored link', () => {
    show();
    expect(screen.getByText('Advert')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Banking & finance' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    const link = screen.getByRole('link', { name: /Revolut Business account/ });
    expect(link).toHaveAttribute('href', REVOLUT_BUSINESS.url);
    expect(link).toHaveAttribute('rel', 'sponsored noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('We may earn a commission if you open an account through these links.')).toBeInTheDocument();
    expect(screen.getByText('Not financial advice. Check the terms with the provider.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the Business Finance Assistant' })).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant');
  });

  it('partner section hidden when no entry has a link (no placeholder); an entry without a link is never rendered', () => {
    show({ groups: GROUPS, partners: [{ ...BANK, url: undefined }, { ...ACCOUNTS, url: '' }] });
    expect(screen.queryByTestId('ftb-partners')).toBeNull();
    expect(screen.queryByText(/We may earn a commission/)).toBeNull();
    expect(screen.getByTestId('free-tools-banner')).toBeInTheDocument(); // the Finance Assistant part still shows
  });

  it('an entry without a link is skipped among others; a group with no entries is never shown', () => {
    show({ groups: GROUPS, partners: [BANK, { ...BANK, id: 'b2', name: 'No Link Bank', url: undefined }] });
    expect(screen.getAllByTestId('ftb-partner')).toHaveLength(1);
    expect(screen.queryByText('No Link Bank')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull(); // Accounting software and Legal have no entries
  });

  it('two groups with entries: a selector, "Banking & finance" first and selected, keyboard switching announced and remembered for the session', () => {
    const { unmount } = show({ groups: GROUPS, partners: [ACCOUNTS, BANK] });
    const tabs = within(screen.getByRole('tablist', { name: 'Partner category' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Banking & finance', 'Accounting software']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /Bank One/ })).toBeInTheDocument();
    expect(screen.getByTestId('ftb-group-announce')).toHaveTextContent('Showing Banking & finance');
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Accounting software' })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Accounting software' }));
    expect(screen.getByTestId('ftb-group-announce')).toHaveTextContent('Showing Accounting software');
    expect(screen.getByRole('link', { name: /Books One/ })).toHaveAttribute('rel', 'sponsored noopener noreferrer');
    expect(screen.getByText('Offer exactly as stated')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Bank One/ })).toBeNull();
    unmount();
    show({ groups: GROUPS, partners: [ACCOUNTS, BANK] });
    expect(screen.getByRole('tab', { name: 'Accounting software' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Accounting software' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Banking & finance' })).toHaveAttribute('aria-selected', 'true');
  });

  it('dismiss hides it for this session; a new session shows it again', () => {
    const { unmount } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Hide this advert for now' }));
    expect(screen.queryByTestId('free-tools-banner')).toBeNull();
    unmount();
    show();
    expect(screen.queryByTestId('free-tools-banner')).toBeNull();
    sessionStorage.clear(); // a new browser session
    show();
    expect(screen.getAllByTestId('free-tools-banner')).toHaveLength(1);
  });
});
