import { describe, it, expect } from 'vitest';
import { parseAiTemplate } from './aiTemplateSchema';

// Stored fixtures: task titles exactly as returned by gpt-4o-mini in the 2 Oct 2026 cost test (run 2).
// No paid calls are made by these tests.
const t = (title: string, dayOffset = 0) => ({ title, status: 'todo', priority: 'medium', dayOffset });
const tpl = (boards: { name: string; groups: { name: string; titles: string[] }[] }[]) => ({
  schemaVersion: 1, kind: 'workspace', name: 'Fixture', description: 'Stored fixture',
  boards: boards.map((b) => ({ name: b.name, description: 'd', views: ['table'], groups: b.groups.map((g) => ({ name: g.name, tasks: g.titles.map((x, i) => t(x, i)) })) })),
});

const salon = tpl([
  { name: 'Client Bookings', groups: [{ name: 'Upcoming Appointments', titles: ['Client Appointment', 'Client Appointment', 'Client Appointment'] }] },
  { name: 'Stylist Rota', groups: [{ name: 'Weekly Schedule', titles: ['Stylist Shift', 'Stylist Shift', 'Stylist Shift'] }] },
  { name: 'Product Stock', groups: [{ name: 'Current Stock', titles: ['Shampoo', 'Conditioner', 'Hair Color'] }] },
]);
const builder = tpl([{ name: 'Job Tracking', groups: [
  { name: 'Backlog Jobs', titles: ['Job A', 'Job B', 'Job C'] }, { name: 'In Progress Jobs', titles: ['Job D', 'Job E'] },
  { name: 'Completed Jobs', titles: ['Job F', 'Job G'] }, { name: 'Quotes', titles: ['Quote A', 'Quote B'] },
  { name: 'Site Safety Checks', titles: ['Safety Check A', 'Safety Check B'] }, { name: 'Subcontractors', titles: ['Subcontractor A', 'Subcontractor B'] },
] }]);
const accountancy = tpl([
  { name: 'Client Onboarding', groups: [{ name: 'New Clients', titles: ['Initial Consultation', 'Collect Documents', 'Set Up Client Profile', 'Client Agreement', 'Schedule Follow-Up'] }] },
  { name: 'Year-End Accounts', groups: [{ name: 'Accounts Preparation', titles: ['Gather Financial Statements', 'Review Transactions', 'Prepare Draft Accounts', 'Client Review Meeting', 'File Accounts'] }] },
  { name: 'VAT Deadlines', groups: [{ name: 'VAT Returns', titles: ['Collect VAT Data', 'Prepare VAT Return', 'Client Approval', 'Submit VAT Return', 'Review VAT Payments'] }] },
  { name: 'Client Follow-Ups', groups: [{ name: 'Pending Follow-Ups', titles: ['Check on Document Submission', 'Follow Up on Payment', 'Client Feedback Request', 'Schedule Next Meeting', 'Review Client Satisfaction'] }] },
]);
const cafe = tpl([{ name: 'Daily Operations', groups: [
  { name: 'Opening Checklist', titles: ['Prepare Coffee Machines', 'Check Inventory', 'Set Up Tables', 'Prepare Pastries', 'Clean Dining Area'] },
  { name: 'Closing Checklist', titles: ['Clean Coffee Machines', 'Count Cash Register', 'Restock Supplies', 'Clean Kitchen', 'Lock Up'] },
  { name: 'Supplier Orders', titles: ['Order Coffee Beans', 'Order Milk Supplies', 'Order Pastries'] },
  { name: 'Staff Training', titles: ['Conduct Barista Training', 'Health & Safety Training'] },
] }]);

describe('AI template quality gate (stored fixtures)', () => {
  it('rejects the salon output for repeated task titles', () => {
    const r = parseAiTemplate(salon);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/repeated task titles.*client appointment/);
  });
  it('rejects the builder output for "Job A / Job B" placeholders', () => {
    const r = parseAiTemplate(builder);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/placeholder task titles \(Job A, Job B, Job C\)/);
  });
  it('accepts the accountancy and café outputs', () => {
    expect(parseAiTemplate(accountancy).ok).toBe(true);
    expect(parseAiTemplate(cafe).ok).toBe(true);
  });
  it('catches repeats differing only in case/punctuation, and generic titles', () => {
    expect(parseAiTemplate(tpl([{ name: 'B', groups: [{ name: 'G', titles: ['Lock up', 'lock-up', 'Order beans'] }] }])).ok).toBe(false);
    expect(parseAiTemplate(tpl([{ name: 'B', groups: [{ name: 'G', titles: ['Task', 'Order beans', 'Quote 1'] }] }])).ok).toBe(false);
  });
  it('does not flag real titles that end in letters or numbers', () => {
    expect(parseAiTemplate(tpl([{ name: 'B', groups: [{ name: 'G', titles: ['Submit VAT Return', 'Plan Q4', 'Check fire exits'] }] }])).ok).toBe(true);
  });
});
