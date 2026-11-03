import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import FreeToolsBanner from './FreeToolsBanner';
import { BANK_PARTNERS } from '@/data/freeToolsPromos';

const show = (partners?: Parameters<typeof FreeToolsBanner>[0]['partners']) => render(<MemoryRouter><FreeToolsBanner partners={partners} /></MemoryRouter>);
const PARTNER = { name: 'Test Bank', description: 'A business current account.', url: 'https://bank.example.test/ref?x=1', offer: 'Offer exactly as stated by the bank' };

beforeEach(() => { sessionStorage.clear(); });

describe('FreeToolsBanner (Phase 38)', () => {
  it('ships with no bank partners and no placeholder links', () => {
    expect(BANK_PARTNERS).toEqual([]);
  });

  it('is labelled Advert; with no partners the bank section is not shown; the Finance Assistant links to the tool', () => {
    show();
    expect(screen.getByRole('complementary', { name: 'Advert' })).toBeInTheDocument();
    expect(screen.getByText('Advert')).toBeVisible();
    expect(screen.queryByTestId('ftb-banks')).toBeNull();
    expect(screen.queryByText(/We may earn a commission/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the Business Finance Assistant' })).toHaveAttribute('href', '/business-tools?tool=business-finance-assistant');
    expect(screen.getByText(/Needs a B2BNEST account and a plan \(every new account starts with a 14-day trial\)/)).toBeInTheDocument();
    expect(screen.getByText('Not financial advice. Check the terms with the provider.')).toBeInTheDocument();
  });

  it('with a partner: sponsored link in a new tab, the commission line, the offer', () => {
    show([PARTNER]);
    const link = screen.getByRole('link', { name: /Test Bank/ });
    expect(link).toHaveAttribute('rel', 'sponsored noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', PARTNER.url);
    expect(screen.getByText('We may earn a commission if you open an account through these links.')).toBeInTheDocument();
    expect(screen.getByText(PARTNER.offer)).toBeInTheDocument();
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
