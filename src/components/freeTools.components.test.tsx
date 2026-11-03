import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GoalTracker from './GoalTracker';
import CustomerSurveyBuilder from './CustomerSurveyBuilder';
import BusinessSetupChecklist from './BusinessSetupChecklist';
import { CHECKLIST_KEY } from '@/lib/setupChecklist';
import ComplianceChecker from './ComplianceChecker';
import BestPracticesGuide from './BestPracticesGuide';
import CostCalculator from './CostCalculator';
import { STORAGE_KEY as GOALS_KEY } from '@/lib/goals';
import { STORAGE_KEY as SURVEYS_KEY } from '@/lib/surveys';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('Goal Tracker (Phase 38)', () => {
  it('validates in words, adds, edits, shows progress accessibly, completes and deletes; saved in the browser', () => {
    render(<GoalTracker />);
    expect(screen.getByTestId('goals-empty')).toBeInTheDocument();
    expect(screen.getByText(/Saved in this browser only/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a goal' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Add a goal' }));
    expect(screen.getByText('Enter a goal.')).toBeInTheDocument();
    expect(screen.getByText('Choose a target date.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Win 5 clients' } });
    fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2001-01-01' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Add a goal' }));
    const goal = screen.getByTestId('goal');
    expect(goal).toHaveTextContent('Target: 1 Jan 2001');
    expect(goal).toHaveTextContent(/Overdue by \d+ days/);
    fireEvent.click(within(goal).getByRole('button', { name: 'Add 10% to Win 5 clients' }));
    expect(within(goal).getByRole('progressbar', { name: 'Progress on Win 5 clients' })).toHaveAttribute('aria-valuetext', '10%');
    for (let i = 0; i < 9; i++) fireEvent.click(within(goal).getByRole('button', { name: 'Add 10% to Win 5 clients' }));
    expect(goal).toHaveTextContent('Completed');
    fireEvent.click(within(goal).getByRole('button', { name: 'Edit Win 5 clients' }));
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Win 6 clients' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Edit goal' }));
    expect(screen.getByTestId('goal')).toHaveTextContent('Win 6 clients');
    expect(JSON.parse(localStorage.getItem(GOALS_KEY)!)[0]).toMatchObject({ title: 'Win 6 clients', targetDate: '2001-01-01', progress: 100 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Win 6 clients' }));
    expect(screen.getByTestId('goals-empty')).toBeInTheDocument();
  });
});

describe('Customer Survey Builder (Phase 38)', () => {
  it('says plainly it does not collect answers; no Publish; reorder, required, preview, save in the browser', () => {
    render(<CustomerSurveyBuilder />);
    expect(screen.getByTestId('survey-no-responses')).toHaveTextContent("doesn't publish it or collect answers");
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/ready to collect responses|Share Options|Analytics/);
    expect(screen.getByTestId('surveys-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New survey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save survey' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the survey a title.');
    fireEvent.change(screen.getByLabelText('Survey title'), { target: { value: 'Feedback' } });
    const q1 = screen.getAllByTestId('survey-question')[0];
    fireEvent.change(within(q1).getByLabelText('Question text'), { target: { value: 'First?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a question' }));
    const q2 = screen.getAllByTestId('survey-question')[1];
    fireEvent.change(within(q2).getByLabelText('Question text'), { target: { value: 'Second?' } });
    fireEvent.click(within(q2).getByRole('checkbox', { name: 'Required' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move question 2 up' }));
    expect(within(screen.getAllByTestId('survey-question')[0]).getByLabelText('Question text')).toHaveValue('Second?');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByTestId('survey-preview')).toHaveTextContent('1. Second? (required)');
    fireEvent.click(screen.getByRole('button', { name: 'Save survey' }));
    expect(screen.getByTestId('survey-card')).toHaveTextContent('2 questions');
    expect(JSON.parse(localStorage.getItem(SURVEYS_KEY)!)[0].questions.map((q: { question: string }) => q.question)).toEqual(['Second?', 'First?']);
  });
});

describe('Business Setup Checklist (Phase 38)', () => {
  it('UK steps with GOV.UK links; ticks saved in the browser; reset', () => {
    const { unmount } = render(<BusinessSetupChecklist />);
    expect(document.body.textContent).not.toMatch(/\bEIN\b|\bIRS\b|LLC|state and local/);
    expect(screen.getAllByRole('link', { name: /GOV\.UK/ }).length).toBeGreaterThan(5);
    fireEvent.click(screen.getByRole('checkbox', { name: /Open a business bank account/ }));
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('1 of 12 steps done (8%)');
    unmount();
    render(<BusinessSetupChecklist />);
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('1 of 12 steps done');
    expect(JSON.parse(localStorage.getItem(CHECKLIST_KEY)!)).toEqual(['bank']);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0 of 12 steps done');
  });
});

describe('Compliance Checker, Best Practices, Cost Calculator (Phase 38)', () => {
  it('compliance: not legal advice, empty state, then items each linked to GOV.UK', () => {
    render(<ComplianceChecker />);
    expect(screen.getByTestId('not-legal-advice')).toHaveTextContent('General guidance, not legal advice.');
    expect(screen.getByTestId('cc-none')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Do you (or will you) employ anyone?'), { target: { value: 'yes' } });
    const items = screen.getAllByTestId('cc-item');
    expect(items).toHaveLength(4);
    for (const i of items) expect(within(i).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^https:\/\/www\.gov\.uk\//));
  });
  it('best practices: no ratings, time estimates or made-up resources', () => {
    render(<BestPracticesGuide />);
    expect(document.body.textContent).not.toMatch(/impact|beginner|intermediate|advanced|Template Library|Template\b|\d+-\d+ (weeks|hours|days)/);
    expect(screen.getByText(/General guidance, not legal, tax or financial advice/)).toBeInTheDocument();
  });
  it('cost calculator: UK structures, no figures until typed, totals and required count', () => {
    render(<CostCalculator />);
    expect(screen.getByTestId('cc-empty')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Business structure'), { target: { value: 'limited_company' } });
    expect(screen.getByTestId('cc-totals')).toHaveTextContent('£0.00');
    expect(screen.getByTestId('cc-totals')).toHaveTextContent('3 required items have no amount yet.');
    fireEvent.change(screen.getByLabelText('Amount for Register the company with Companies House (£)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Amount for Business insurance (£)'), { target: { value: '250' } });
    expect(screen.getByTestId('cc-totals')).toHaveTextContent('£100.00');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Business insurance' }));
    expect(screen.getByTestId('cc-totals')).toHaveTextContent('Total of the amounts you entered£350.00');
    expect(document.body.textContent).not.toMatch(/\$|LLC|EIN|California/);
  });
});
