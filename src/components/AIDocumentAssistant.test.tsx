import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AIDocumentAssistant from './AIDocumentAssistant';
import { PLANS } from '@/lib/plans';
import { answerQuestion, UNKNOWN_ANSWER } from '@/lib/helpAssistant';

const BANNED = [/trading/i, /portfolio/i, /unlimited crm users/i, /15 users/i, /\binvest/i, /crypto/i, /24\/7/i, /phone support/i, /live chat/i, /\bAI assistant\b/i, /always learning/i];

const open = () => {
  render(<MemoryRouter><AIDocumentAssistant /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open the help assistant' }));
  return screen.getByRole('dialog', { name: 'Help assistant' });
};
const ask = (dialog: HTMLElement, q: string) => {
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Your question' }), { target: { value: q } });
  fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'Your question' }), { key: 'Enter', code: 'Enter' });
};

describe('homepage help assistant', () => {
  it('says what it is: a help assistant, not an AI', () => {
    const dialog = open();
    expect(within(dialog).getByRole('heading', { name: 'Help assistant' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/not an AI/i);
  });

  it('shows no invented trading, portfolio or user-limit claims, even after asking every suggested question', () => {
    const dialog = open();
    for (const q of ['What is B2BNEST?', 'What plans do you offer?', 'How do I get started?', 'Which integrations can I connect?', 'How do I get help?', 'Do you have trading tools?', 'Show my portfolio', 'Enterprise plan']) ask(dialog, q);
    const replies = Array.from(dialog.querySelectorAll('[data-from="assistant"]')).map((el) => el.textContent).join(' ');
    expect(replies.length).toBeGreaterThan(500);
    for (const re of BANNED) expect(replies).not.toMatch(re);
    // The rest of the panel (header, buttons, links) is clean too, leaving out only what the person typed.
    const panel = dialog.cloneNode(true) as HTMLElement;
    panel.querySelectorAll('[data-from="user"]').forEach((el) => el.remove());
    for (const re of BANNED) expect(panel.textContent).not.toMatch(re);
  });

  it('plan names, prices and user limits are exactly the Pricing page data', () => {
    const dialog = open();
    ask(dialog, 'What plans do you offer?');
    for (const plan of PLANS) {
      expect(dialog).toHaveTextContent(`${plan.name}: £${plan.monthly} a month or £${plan.annual} a year, up to ${plan.userLimit}`);
    }
    expect(PLANS.map((p) => [p.name, p.users])).toEqual([['Starter', 1], ['Professional', 5], ['Enterprise', 25]]);
  });

  it('says plainly when it does not know, with links to Help and Contact', () => {
    const dialog = open();
    ask(dialog, 'What is the weather in Leeds?');
    expect(dialog).toHaveTextContent("Sorry, I don't know the answer to that.");
    expect(within(dialog).getAllByRole('link', { name: 'Help page' }).at(-1)).toHaveAttribute('href', '/help');
    expect(within(dialog).getAllByRole('link', { name: 'Contact us' }).at(-1)).toHaveAttribute('href', '/contact');
  });

  it('never promises ticket or email replies', () => {
    const a = answerQuestion('How do I open a support ticket and when will you email me back?');
    expect(a.text).toMatch(/Support tickets are not switched on yet/);
    expect(a.text).not.toMatch(/within|hours|reply by email|we will email/i);
  });

  it('unrelated or trading questions get the honest fallback', () => {
    expect(answerQuestion('best stocks to buy')).toBe(UNKNOWN_ANSWER);
  });
});
