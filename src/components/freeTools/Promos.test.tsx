import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { FinanceAssistantPromo, ReferralSlot } from './Promos';
import { REFERRAL_GROUPS, REFERRAL_PARTNERS, type ReferralGroup, type ReferralPartner } from '@/data/freeToolsPromos';
import { REVOLUT_BUSINESS } from '@/data/referralLinks';

const GROUPS: ReferralGroup[] = [{ id: 'banking', label: 'Banking & finance' }, { id: 'accounting', label: 'Accounting software' }, { id: 'legal', label: 'Legal' }];
const ALL = ['setup-checklist', 'cost-calculator', 'business-resources'] as const;
const BANK: ReferralPartner = { id: 'b1', name: 'Bank One', description: 'A business account.', url: 'https://bank.example.test/ref', group: 'banking', contexts: [...ALL] };
const BOOKS: ReferralPartner = { id: 'a1', name: 'Books One', description: 'Accounting software.', url: 'https://books.example.test/ref', offer: 'Offer exactly as stated', group: 'accounting', contexts: ['business-resources'] };
const slot = (p: Partial<Parameters<typeof ReferralSlot>[0]> = {}) => render(<ReferralSlot context="business-resources" {...p} />);

beforeEach(() => { sessionStorage.clear(); });

describe('ReferralSlot (Phase 39)', () => {
  it('ships one group, "Banking & finance", with one entry: Revolut Business from the shared referral data, in the three places', () => {
    expect(REFERRAL_GROUPS).toEqual([{ id: 'banking', label: 'Banking & finance' }]);
    expect(REFERRAL_PARTNERS).toEqual([{ id: 'revolut-business', name: REVOLUT_BUSINESS.name, description: REVOLUT_BUSINESS.description, url: REVOLUT_BUSINESS.url, group: 'banking', contexts: [...ALL] }]);
    expect(REFERRAL_PARTNERS.every((p) => !p.offer)).toBe(true);
  });

  it.each(ALL)('%s: Advert label, the commission line, sponsored link in a new tab, not financial advice', (context) => {
    render(<ReferralSlot context={context} />);
    const box = screen.getByTestId(`referral-slot-${context}`);
    expect(within(box).getByText('Advert')).toBeVisible();
    expect(within(box).getByText('We may earn a commission if you open an account through these links.')).toBeInTheDocument();
    expect(within(box).getByText('Not financial advice. Check the terms with the provider.')).toBeInTheDocument();
    const link = within(box).getByRole('link', { name: /Revolut Business account/ });
    expect(link).toHaveAttribute('href', REVOLUT_BUSINESS.url);
    expect(link).toHaveAttribute('rel', 'sponsored noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(within(box).queryByRole('tablist')).toBeNull(); // one group: no selector
  });

  it('an entry without a link is never rendered; with no linked entries the slot shows nothing at all', () => {
    const { container } = slot({ groups: GROUPS, partners: [{ ...BANK, url: undefined }, { ...BOOKS, url: '' }] });
    expect(container).toBeEmptyDOMElement();
    slot({ groups: GROUPS, partners: [BANK, { ...BANK, id: 'b2', name: 'No Link Bank', url: undefined }] });
    expect(screen.getAllByTestId('rs-partner')).toHaveLength(1);
    expect(screen.queryByText('No Link Bank')).toBeNull();
  });

  it('a selector only with two or more groups that have entries here; "Banking & finance" first; keyboard; announced', () => {
    const { unmount } = slot({ groups: GROUPS, partners: [BOOKS, BANK] });
    const tabs = within(screen.getByRole('tablist', { name: 'Partner category' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Banking & finance', 'Accounting software']); // Legal has none
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('rs-group-announce')).toHaveTextContent('Showing Banking & finance');
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Accounting software' }));
    expect(screen.getByText('Offer exactly as stated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Books One/ })).toHaveAttribute('rel', 'sponsored noopener noreferrer');
    unmount();
    // In a place where only one of those groups has entries, there is no selector.
    render(<ReferralSlot context="cost-calculator" groups={GROUPS} partners={[BOOKS, BANK]} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Banking & finance' })).toBeInTheDocument();
  });

  it('dismissed for this session only, per place', () => {
    const { unmount } = render(<ReferralSlot context="cost-calculator" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide this advert for now' }));
    expect(screen.queryByTestId('referral-slot-cost-calculator')).toBeNull();
    unmount();
    render(<><ReferralSlot context="cost-calculator" /><ReferralSlot context="setup-checklist" /></>);
    expect(screen.queryByTestId('referral-slot-cost-calculator')).toBeNull();
    expect(screen.getByTestId('referral-slot-setup-checklist')).toBeInTheDocument();
    sessionStorage.clear();
    render(<ReferralSlot context="cost-calculator" />);
    expect(screen.getByTestId('referral-slot-cost-calculator')).toBeInTheDocument();
  });

  it('the Finance Assistant promotion says what it does today, that it needs a plan, and links to it', () => {
    render(<FinanceAssistantPromo />, { wrapper: MemoryRouter });
    const box = screen.getByTestId('finance-assistant-promo');
    expect(box).toHaveTextContent('quotes and invoices');
    expect(box).toHaveTextContent('Needs a B2BNEST account and a plan (every new account starts with a 14-day trial).');
    expect(within(box).getByRole('link', { name: 'Open the Business Finance Assistant' })).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant');
  });
});
