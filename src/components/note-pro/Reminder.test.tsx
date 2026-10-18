import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReminderBadge, ReminderField } from './Reminder';

describe('note reminder UI', () => {
  it('says exactly what happens, and nothing about email or push', () => {
    render(<ReminderField value="2026-10-25T09:00:00.000Z" onChange={() => {}} timeZone="Europe/London" />);
    const help = screen.getByText(/You'll get a notification in B2BNEST when this time passes\. Checked every 15 minutes\./);
    expect(help).toHaveTextContent('Set for Sun 25 Oct 2026, 09:00 GMT.');
    expect(document.body.textContent).not.toMatch(/email|push/i);
  });

  it('shows local time in the input and stores UTC (DST end in London)', () => {
    const onChange = vi.fn();
    render(<ReminderField value={null} onChange={onChange} timeZone="Europe/London" />);
    fireEvent.change(screen.getByLabelText('Reminder'), { target: { value: '2026-10-25T00:30' } });
    expect(onChange).toHaveBeenCalledWith('2026-10-24T23:30:00.000Z');
  });

  it('Remove reminder clears it to null', () => {
    const onChange = vi.fn();
    render(<ReminderField value="2026-10-25T09:00:00.000Z" onChange={onChange} timeZone="Europe/London" />);
    expect(screen.getByLabelText('Reminder')).toHaveValue('2026-10-25T09:00');
    fireEvent.click(screen.getByRole('button', { name: 'Remove reminder' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('a due reminder looks different from a future one', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const { rerender } = render(<ReminderBadge value="2026-10-18T11:00:00Z" now={now} timeZone="Europe/London" />);
    expect(screen.getByText(/Reminder due · Sun 18 Oct 2026, 12:00 BST/)).toBeInTheDocument();
    rerender(<ReminderBadge value="2026-10-19T11:00:00Z" now={now} timeZone="Europe/London" />);
    expect(screen.getByText(/^Reminder · Mon 19 Oct 2026, 12:00 BST/)).toBeInTheDocument();
    rerender(<ReminderBadge value={null} now={now} />);
    expect(screen.queryByText(/Reminder/)).not.toBeInTheDocument();
  });
});
