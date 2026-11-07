// The forgot-password screen: the "wait 60 seconds, click once" hint, the spam / Gmail hint after sending, and a plain
// message for Supabase's one-email-a-minute limit (429). useAuth is mocked: nothing is sent.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ result: { error: null as null | { message: string; status?: number } } }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ toast }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ resetPassword: async () => st.result }) }));

import ForgotPassword from './ForgotPassword';

const send = () => {
  render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'person@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }));
};

beforeEach(() => { st.result = { error: null }; toast.mockClear(); });

describe('forgot password', () => {
  it('says to wait 60 seconds and click one new link once', () => {
    render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
    expect(screen.getByTestId('reset-expired-hint')).toHaveTextContent('If the link says expired, wait 60 seconds and request one new link, then click it once.');
  });
  it('after sending: the spam folder and Gmail hint', async () => {
    send();
    expect(await screen.findByTestId('reset-email-hint')).toHaveTextContent('Check your spam folder; Gmail may fold repeat emails (click the three dots).');
  });
  it('the one-email-a-minute limit (429) is said in plain words', async () => {
    st.result = { error: { message: 'For security purposes, you can only request this after 42 seconds.', status: 429 } };
    send();
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Please wait a moment', description: 'A link was sent less than a minute ago. Wait 60 seconds, then request one new link.' })));
    expect(screen.queryByTestId('reset-email-hint')).toBeNull();
  });
});
