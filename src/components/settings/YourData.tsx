import { useId, useState } from 'react';
import { Download, Loader2, Trash2, Building2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useDemoMode } from '@/contexts/demoModeState';
import { DemoReadonlyNote } from '@/components/demo/DemoBanner';
import { supabase } from '@/integrations/supabase/client';
import { cleanCode } from '@/lib/twoStep';
import {
  ACCOUNT_DELETED, checkAccountDeletion, checkCompanyClosure, closeCompany, confirmIdentity, DATA_CONTACT, deleteAccount, downloadData,
  type AccountCheck, type CompanyCheck, type Failure,
} from '@/lib/dataRights';

const failed = (r: { ok: boolean }): r is Failure => r.ok === false;

/** HMRC P7b: download your data, close a company, delete your account (docs/hmrc-p7b/README.md). */
export default function YourData() {
  const { user } = useAuth();
  const { organizationId, organization } = useActiveOrganization();
  const { isDemo } = useDemoMode();
  const [deletedMessage, setDeletedMessage] = useState<string | null>(null);
  const role = organization?.role;
  const companyName = organization?.name ?? 'your company';

  if (deletedMessage) {
    return (
      <Card data-testid="data-deleted">
        <CardHeader><CardTitle className="text-lg">Account deleted</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p role="status" className="text-sm">{deletedMessage}</p>
          <Button asChild variant="outline"><a href="/">Go to the home page</a></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="your-data">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your data</CardTitle>
          <CardDescription>
            Download a copy of your data at any time. If you run a VAT-registered business, HMRC expects you to keep your VAT records for 6 years:
            download them before you delete anything. Questions: {DATA_CONTACT}.
          </CardDescription>
        </CardHeader>
      </Card>
      {isDemo && <DemoReadonlyNote what="Downloading, closing and deleting" />}

      <DownloadCard
        testId="data-download-account"
        title="Download my data"
        text="A ZIP file with your personal data: your profile, settings and preferences, marketing choices, AI conversations, and the records you keep yourself (for example notes, quotes, contacts, products, suppliers and payroll). Uploaded pictures are listed with download links that work for 1 hour. It usually takes less than a minute."
        button="Download my data"
        disabled={isDemo}
        email={user?.email ?? null}
        run={() => downloadData('account')}
      />

      {organizationId && (role === 'owner' || role === 'admin') && (
        <DownloadCard
          testId="data-download-company"
          title={`Download company data: ${companyName}`}
          text="A ZIP file with everything this company keeps in B2BNEST: invoices, expenses, bills, projects, tasks, rota and holiday, support tickets, HMRC settings, the record of each VAT return sent to HMRC's test environment (the nine boxes and HMRC's receipt) and the HMRC connection status (never its tokens). Invoices, expenses, bills and VAT returns sent are also included as CSV for spreadsheets. Owners and admins only."
          button="Download company data"
          disabled={isDemo}
          email={user?.email ?? null}
          run={() => downloadData('company', organizationId)}
        />
      )}

      {organizationId && role === 'owner' && !isDemo && (
        <CloseCompanyCard companyId={organizationId} companyName={companyName} email={user?.email ?? null} />
      )}

      {!isDemo && <DeleteAccountCard email={user?.email ?? null} onDeleted={async (m) => {
        setDeletedMessage(m);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }} />}
    </div>
  );
}

type DownloadRun = () => Promise<{ ok: true; filename: string } | Failure>;

/**
 * A download needs a fresh sign-in too (the server decides: it answers reauth_required when the last sign-in is older
 * than 10 minutes). Then this asks for the password, or the authenticator code for people who use one, and retries the
 * download once. The password is only handed to Supabase Auth (confirmIdentity) and never kept.
 */
function useConfirmedDownload(run: DownloadRun, email: string | null) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState<'authenticator' | 'sign_in' | null>(null);
  const show = (r: Awaited<ReturnType<DownloadRun>>) =>
    setSaid(failed(r) ? { ok: false, text: r.message } : { ok: true, text: `Downloaded ${r.filename}. Keep it somewhere safe.` });
  const start = async () => {
    setBusy(true); setSaid(null);
    const r = await run();
    setBusy(false);
    if (failed(r) && r.code === 'reauth_required') { setAsk(r.confirm_with ?? 'sign_in'); return; }
    show(r);
  };
  const retry = async () => {
    setAsk(null); setBusy(true);
    const r = await run();
    setBusy(false);
    if (failed(r) && r.code === 'reauth_required') {
      setSaid({ ok: false, text: "We still couldn't confirm it is you. Sign out, sign in again, then try once more." });
      return;
    }
    show(r);
  };
  const dialog = <ConfirmDownloadDialog how={ask} email={email} onCancel={() => setAsk(null)} onConfirmed={() => { void retry(); }} />;
  return { busy, said, start, dialog };
}

function ConfirmDownloadDialog({ how, email, onCancel, onConfirmed }: {
  how: 'authenticator' | 'sign_in' | null; email: string | null; onCancel: () => void; onConfirmed: () => void;
}) {
  const id = useId();
  const [secret, setSecret] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setSecret(''); setError(null); onCancel(); };
  const totp = how === 'authenticator';
  const ready = totp ? cleanCode(secret).length === 6 : secret.length > 0;
  return (
    <Dialog open={how !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent data-testid="data-download-confirm">
        <DialogHeader>
          <DialogTitle>Confirm it's you</DialogTitle>
          <DialogDescription>
            {totp ? 'For your security, enter the code from your authenticator app to download your data.' : 'For your security, enter your password to download your data.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || checking || !how) return;
          setChecking(true); setError(null);
          const problem = await confirmIdentity(how, totp ? { code: cleanCode(secret) } : { email, password: secret });
          setChecking(false);
          if (problem) { setError(problem); return; }
          setSecret('');
          onConfirmed();
        }}>
          <Label htmlFor={`${id}-secret`}>{totp ? 'Code from your authenticator app' : 'Your password'}</Label>
          <Input id={`${id}-secret`} value={secret} autoFocus onChange={(e) => setSecret(totp ? cleanCode(e.target.value) : e.target.value)}
            type={totp ? 'text' : 'password'} inputMode={totp ? 'numeric' : undefined} autoComplete={totp ? 'one-time-code' : 'current-password'} />
          {error && <p className="text-sm" role="alert" data-testid="data-download-confirm-error">{error}</p>}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={!ready || checking} data-testid="data-download-confirm-go">
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Confirm and download
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DownloadCard(p: { testId: string; title: string; text: string; button: string; disabled: boolean; email: string | null; run: DownloadRun }) {
  const d = useConfirmedDownload(p.run, p.email);
  return (
    <Card data-testid={p.testId}>
      <CardHeader>
        <CardTitle className="text-base">{p.title}</CardTitle>
        <CardDescription>{p.text}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button type="button" variant="outline" disabled={d.busy || p.disabled} onClick={() => { void d.start(); }}>
          {d.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
          {d.busy ? 'Preparing your file…' : p.button}
        </Button>
        {d.said && <p className="text-sm" role={d.said.ok ? 'status' : 'alert'} data-testid={`${p.testId}-said`}>{d.said.text}</p>}
        {d.dialog}
      </CardContent>
    </Card>
  );
}

/** The last step of a closure or deletion: the export offer, the tick, the typed confirmation and a fresh sign-in. */
function ConfirmStep(p: {
  confirmWith: 'authenticator' | 'sign_in'; typedLabel: string; expected: string; email: string | null; actionLabel: string; testId: string;
  exportOffer: React.ReactNode; onConfirm: () => Promise<{ ok: true; message?: string } | Failure>; onDone: (message: string) => void;
}) {
  const id = useId();
  const [downloaded, setDownloaded] = useState(false);
  const [typed, setTyped] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typedOk = typed.trim().toLowerCase() === p.expected.trim().toLowerCase() && typed.trim() !== '';
  const ready = downloaded && typedOk && (p.confirmWith === 'authenticator' ? cleanCode(secret).length === 6 : secret.length > 0);
  return (
    <div className="space-y-3 rounded-md border border-destructive/40 p-4" data-testid={p.testId}>
      {p.exportOffer}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={downloaded} onChange={(e) => setDownloaded(e.target.checked)} data-testid={`${p.testId}-downloaded`} />
        <span>I have downloaded what I need. I understand this can't be undone.</span>
      </label>
      <div className="space-y-1 sm:max-w-sm">
        <Label htmlFor={`${id}-typed`}>{p.typedLabel}</Label>
        <Input id={`${id}-typed`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1 sm:max-w-sm">
        <Label htmlFor={`${id}-secret`}>{p.confirmWith === 'authenticator' ? 'Code from your authenticator app' : 'Your password'}</Label>
        <Input id={`${id}-secret`} value={secret} onChange={(e) => setSecret(p.confirmWith === 'authenticator' ? cleanCode(e.target.value) : e.target.value)}
          type={p.confirmWith === 'authenticator' ? 'text' : 'password'} inputMode={p.confirmWith === 'authenticator' ? 'numeric' : undefined}
          autoComplete={p.confirmWith === 'authenticator' ? 'one-time-code' : 'current-password'} />
        <p className="text-xs text-muted-foreground">We check it is you before anything is removed.</p>
      </div>
      {!ready && <p id={`${id}-hint`} className="text-xs text-muted-foreground">Tick the box, type the confirmation and {p.confirmWith === 'authenticator' ? 'the 6-digit code' : 'your password'} to turn on the button.</p>}
      <Button type="button" variant="destructive" disabled={!ready || busy} aria-describedby={!ready ? `${id}-hint` : undefined} data-testid={`${p.testId}-go`} onClick={async () => {
        setBusy(true); setError(null);
        const problem = await confirmIdentity(p.confirmWith, p.confirmWith === 'authenticator' ? { code: cleanCode(secret) } : { email: p.email, password: secret });
        if (problem) { setBusy(false); setError(problem); return; }
        const r = await p.onConfirm();
        setBusy(false);
        if (failed(r)) { setError(r.messages?.length ? r.messages.join(' ') : r.message); return; }
        p.onDone(r.message ?? '');
      }}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{p.actionLabel}
      </Button>
      {error && <p className="text-sm" role="alert" data-testid={`${p.testId}-error`}>{error}</p>}
    </div>
  );
}

function CloseCompanyCard({ companyId, companyName, email }: { companyId: string; companyName: string; email: string | null }) {
  const [check, setCheck] = useState<({ ok: true } & CompanyCheck) | Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const problem = check && failed(check) ? check : null;
  const ok = check && !failed(check) ? check as { ok: true } & CompanyCheck : null;
  return (
    <Card data-testid="data-close-company">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" aria-hidden />Close {companyName}</CardTitle>
        <CardDescription>
          Removes the company's records, members and HMRC connection from B2BNEST. Owners only. B2BNEST keeps a minimal record of what was sent to HMRC
          (the VAT returns sent and the HMRC activity log) for 6 years, then deletes it. Closing a company doesn't cancel your own subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {closed ? <p role="status" className="text-sm" data-testid="data-close-company-done">{closed}</p> : !ok ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={async () => { setBusy(true); setCheck(await checkCompanyClosure(companyId)); setBusy(false); }}
              data-testid="data-close-company-start">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Close this company…
            </Button>
            {problem && <p role="alert" className="text-sm" data-testid="data-close-company-error">{problem.message}</p>}
          </>
        ) : (
          <>
            <p className="text-sm" data-testid="data-close-company-summary">
              {ok.name} has {ok.members} active member{ok.members === 1 ? '' : 's'}{ok.hmrc_connected ? ', is connected to HMRC' : ''} and has
              {' '}{ok.hmrc_submissions} HMRC submission record{ok.hmrc_submissions === 1 ? '' : 's'}. All members lose access.
            </p>
            <ConfirmStep
              testId="data-close-company-confirm" confirmWith={ok.confirm_with} email={email} expected={ok.name}
              typedLabel={`Type the company name (${ok.name}) to confirm`} actionLabel="Close the company"
              exportOffer={<DownloadInline label="Download company data first" email={email} run={() => downloadData('company', companyId)} />}
              onConfirm={() => closeCompany(companyId, ok.name)} onDone={(m) => setClosed(m || 'The company is closed.')}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteAccountCard({ email, onDeleted }: { email: string | null; onDeleted: (message: string) => void }) {
  const [check, setCheck] = useState<({ ok: true } & AccountCheck) | Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const problem = check && failed(check) ? check : null;
  const ok = check && !failed(check) ? check as { ok: true } & AccountCheck : null;
  return (
    <Card data-testid="data-delete-account">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Trash2 className="h-4 w-4" aria-hidden />Delete my account</CardTitle>
        <CardDescription>
          Deletes your sign-in and your personal data. Records you made for a company that carries on stay with that company. A company where you are
          the only member and an owner is closed. B2BNEST keeps its minimal HMRC record for 6 years, with your name replaced by "Deleted user".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!ok ? (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={async () => { setBusy(true); setCheck(await checkAccountDeletion()); setBusy(false); }}
              data-testid="data-delete-account-start">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Delete my account…
            </Button>
            {problem && (
              <Alert role="alert" data-testid="data-delete-account-refused">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                <AlertTitle>{problem.code === 'refused' ? "Your account can't be deleted yet" : 'Not available'}</AlertTitle>
                <AlertDescription>{problem.messages?.length ? <ul className="list-disc pl-5">{problem.messages.map((m) => <li key={m}>{m}</li>)}</ul> : problem.message}</AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <>
            {ok.companies_closed.length > 0 && (
              <p className="text-sm" data-testid="data-delete-account-closes">These companies will be closed because you are their only member: {ok.companies_closed.join(', ')}.</p>
            )}
            <ConfirmStep
              testId="data-delete-account-confirm" confirmWith={ok.confirm_with} email={email} expected={email ?? ''}
              typedLabel="Type your email address to confirm" actionLabel="Delete my account"
              exportOffer={<DownloadInline label="Download my data first" email={email} run={() => downloadData('account')} />}
              onConfirm={() => deleteAccount(email ?? '')} onDone={(m) => onDeleted(m || ACCOUNT_DELETED)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DownloadInline({ label, run, email }: { label: string; run: DownloadRun; email: string | null }) {
  const d = useConfirmedDownload(run, email);
  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" size="sm" disabled={d.busy} onClick={() => { void d.start(); }}>
        {d.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}{label}
      </Button>
      {d.said && <p className="text-xs" role={d.said.ok ? 'status' : 'alert'}>{d.said.text}</p>}
      {d.dialog}
    </div>
  );
}
