import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const st = vi.hoisted(() => ({
  role: 'member' as string | null, demo: false,
  download: vi.fn(), checkAccount: vi.fn(), deleteAccount: vi.fn(), checkCompany: vi.fn(), closeCompany: vi.fn(), confirm: vi.fn(), signOut: vi.fn(),
}));
const USER = { id: 'u1', email: 'ann@example.test' };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: USER, loading: false }) }));
vi.mock('@/contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({ organizationId: st.role ? 'org-x' : null, organization: st.role ? { organizationId: 'org-x', name: 'Company X', role: st.role } : null, memberships: [], loading: false }),
}));
vi.mock('@/contexts/demoModeState', () => ({ useDemoMode: () => ({ isDemo: st.demo, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signOut: (...a: unknown[]) => st.signOut(...a) } } }));
vi.mock('@/lib/dataRights', async (orig) => ({
  ...(await orig<object>()),
  downloadData: (...a: unknown[]) => st.download(...a),
  checkAccountDeletion: () => st.checkAccount(),
  deleteAccount: (...a: unknown[]) => st.deleteAccount(...a),
  checkCompanyClosure: (...a: unknown[]) => st.checkCompany(...a),
  closeCompany: (...a: unknown[]) => st.closeCompany(...a),
  confirmIdentity: (...a: unknown[]) => st.confirm(...a),
}));

import YourData from './YourData';
import { NOT_AVAILABLE } from '@/lib/dataRights';

beforeEach(() => {
  for (const f of [st.download, st.checkAccount, st.deleteAccount, st.checkCompany, st.closeCompany, st.confirm, st.signOut]) f.mockReset();
  st.role = 'member'; st.demo = false;
  st.signOut.mockResolvedValue({ error: null });
});

describe('Settings → Your data', () => {
  it('a member: download my data and delete my account; no company download or closure', () => {
    render(<YourData />);
    expect(screen.getByTestId('data-download-account')).toBeInTheDocument();
    expect(screen.queryByTestId('data-download-company')).toBeNull();
    expect(screen.queryByTestId('data-close-company')).toBeNull();
    expect(screen.getByTestId('data-delete-account')).toBeInTheDocument();
    expect(screen.getByText(/keep your VAT records for 6 years/)).toBeInTheDocument();
  });

  it('an admin also downloads company data; only an owner can close the company', () => {
    st.role = 'admin';
    const { unmount } = render(<YourData />);
    expect(screen.getByTestId('data-download-company')).toHaveTextContent('Download company data: Company X');
    expect(screen.getByTestId('data-download-company')).toHaveTextContent('never its tokens');
    expect(screen.queryByTestId('data-close-company')).toBeNull();
    unmount();
    st.role = 'owner';
    render(<YourData />);
    expect(screen.getByTestId('data-close-company')).toBeInTheDocument();
  });

  it('the demo account: view only (downloads off, no closure or deletion)', () => {
    st.role = 'owner'; st.demo = true;
    render(<YourData />);
    expect(within(screen.getByTestId('data-download-account')).getByRole('button')).toBeDisabled();
    expect(within(screen.getByTestId('data-download-company')).getByRole('button')).toBeDisabled();
    expect(screen.queryByTestId('data-close-company')).toBeNull();
    expect(screen.queryByTestId('data-delete-account')).toBeNull();
  });

  it('before the server side exists: a clear "not available yet", no crash', async () => {
    st.download.mockResolvedValue({ ok: false, code: 'not_available', message: NOT_AVAILABLE });
    render(<YourData />);
    fireEvent.click(within(screen.getByTestId('data-download-account')).getByRole('button'));
    expect(await screen.findByTestId('data-download-account-said')).toHaveTextContent("This isn't available yet");
    expect(screen.getByTestId('data-download-account-said')).toHaveAttribute('role', 'alert');
    expect(st.download).toHaveBeenCalledWith('account');
  });

  it('a successful download says where it went', async () => {
    st.download.mockResolvedValue({ ok: true, filename: 'b2bnest-my-data-2026-11-09.zip' });
    render(<YourData />);
    fireEvent.click(within(screen.getByTestId('data-download-account')).getByRole('button'));
    expect(await screen.findByTestId('data-download-account-said')).toHaveTextContent('Downloaded b2bnest-my-data-2026-11-09.zip');
  });

  it('delete my account: refusals are shown in plain words and nothing else is offered', async () => {
    st.checkAccount.mockResolvedValue({ ok: false, code: 'refused', message: 'x', messages: ['You are the only owner of Company X, which has other members. Make someone else an owner, or close the company, first.'] });
    render(<YourData />);
    fireEvent.click(screen.getByTestId('data-delete-account-start'));
    const box = await screen.findByTestId('data-delete-account-refused');
    expect(box).toHaveTextContent("Your account can't be deleted yet");
    expect(box).toHaveTextContent('You are the only owner of Company X');
    expect(screen.queryByTestId('data-delete-account-confirm')).toBeNull();
  });

  it('delete my account: the export offer, the tick, the typed email and a fresh code; then the final screen', async () => {
    st.checkAccount.mockResolvedValue({ ok: true, companies_closed: ['Solo Ltd'], companies_left: [], confirm_with: 'authenticator' });
    st.confirm.mockResolvedValue(null);
    st.deleteAccount.mockResolvedValue({ ok: true, message: 'Your account is deleted. If you needed your records, you should have downloaded them first.' });
    render(<YourData />);
    fireEvent.click(screen.getByTestId('data-delete-account-start'));
    const step = await screen.findByTestId('data-delete-account-confirm');
    expect(screen.getByTestId('data-delete-account-closes')).toHaveTextContent('Solo Ltd');
    expect(within(step).getByRole('button', { name: /Download my data first/ })).toBeInTheDocument();
    const go = screen.getByTestId('data-delete-account-confirm-go');
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByTestId('data-delete-account-confirm-downloaded'));
    fireEvent.change(within(step).getByLabelText(/Type your email address/), { target: { value: 'someone@else.test' } });
    fireEvent.change(within(step).getByLabelText(/Code from your authenticator app/), { target: { value: '123 456' } });
    expect(go).toBeDisabled(); // wrong email
    fireEvent.change(within(step).getByLabelText(/Type your email address/), { target: { value: ' ANN@example.test ' } });
    expect(go).toBeEnabled();
    fireEvent.click(go);
    expect(await screen.findByTestId('data-deleted')).toHaveTextContent('Your account is deleted. If you needed your records, you should have downloaded them first.');
    expect(st.confirm).toHaveBeenCalledWith('authenticator', { code: '123456' });
    expect(st.deleteAccount).toHaveBeenCalledWith('ann@example.test');
    await waitFor(() => expect(st.signOut).toHaveBeenCalledWith({ scope: 'local' }));
  });

  it('delete my account: a failed identity check stops before anything is deleted', async () => {
    st.checkAccount.mockResolvedValue({ ok: true, companies_closed: [], companies_left: [], confirm_with: 'sign_in' });
    st.confirm.mockResolvedValue("That password didn't work.");
    render(<YourData />);
    fireEvent.click(screen.getByTestId('data-delete-account-start'));
    const step = await screen.findByTestId('data-delete-account-confirm');
    fireEvent.click(screen.getByTestId('data-delete-account-confirm-downloaded'));
    fireEvent.change(within(step).getByLabelText(/Type your email address/), { target: { value: 'ann@example.test' } });
    expect(within(step).getByLabelText('Your password')).toHaveAttribute('type', 'password');
    fireEvent.change(within(step).getByLabelText('Your password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('data-delete-account-confirm-go'));
    expect(await screen.findByTestId('data-delete-account-confirm-error')).toHaveTextContent("That password didn't work.");
    expect(st.confirm).toHaveBeenCalledWith('sign_in', { email: 'ann@example.test', password: 'wrong' });
    expect(st.deleteAccount).not.toHaveBeenCalled();
  });

  it('close the company: a summary, then the typed company name; a server refusal is shown', async () => {
    st.role = 'owner';
    st.checkCompany.mockResolvedValue({ ok: true, name: 'Company X', members: 3, hmrc_connected: true, hmrc_submissions: 2, confirm_with: 'authenticator' });
    st.confirm.mockResolvedValue(null);
    st.closeCompany.mockResolvedValueOnce({ ok: false, code: 'reauth_required', message: 'For your security, confirm it is you again.' })
      .mockResolvedValueOnce({ ok: true, message: 'The company is closed.' });
    render(<YourData />);
    fireEvent.click(screen.getByTestId('data-close-company-start'));
    expect(await screen.findByTestId('data-close-company-summary')).toHaveTextContent('Company X has 3 active members, is connected to HMRC and has 2 HMRC submission records');
    const step = screen.getByTestId('data-close-company-confirm');
    fireEvent.click(screen.getByTestId('data-close-company-confirm-downloaded'));
    fireEvent.change(within(step).getByLabelText(/Type the company name/), { target: { value: 'Company Y' } });
    fireEvent.change(within(step).getByLabelText(/Code from your authenticator app/), { target: { value: '654321' } });
    expect(screen.getByTestId('data-close-company-confirm-go')).toBeDisabled();
    fireEvent.change(within(step).getByLabelText(/Type the company name/), { target: { value: 'company x' } });
    fireEvent.click(screen.getByTestId('data-close-company-confirm-go'));
    expect(await screen.findByTestId('data-close-company-confirm-error')).toHaveTextContent('confirm it is you again');
    fireEvent.click(screen.getByTestId('data-close-company-confirm-go'));
    expect(await screen.findByTestId('data-close-company-done')).toHaveTextContent('The company is closed.');
    expect(st.closeCompany).toHaveBeenCalledWith('org-x', 'Company X');
  });

  it('close the company: not available yet is shown, nothing else', async () => {
    st.role = 'owner';
    st.checkCompany.mockResolvedValue({ ok: false, code: 'not_available', message: NOT_AVAILABLE });
    render(<YourData />);
    fireEvent.click(screen.getByTestId('data-close-company-start'));
    expect(await screen.findByTestId('data-close-company-error')).toHaveTextContent("This isn't available yet");
    expect(screen.queryByTestId('data-close-company-confirm')).toBeNull();
  });
});
