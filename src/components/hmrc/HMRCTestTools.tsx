import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  callHmrcFunction, fetchLastHmrcTest, messageFor, ukDate, type HmrcHeaderCheck, type HmrcLastTest,
} from '@/lib/hmrcConnection';
import { collectHmrcFraudData } from '@/lib/hmrcFraud';

/** HMRC's Test Fraud Prevention Headers API result codes (v1.0), in plain words. */
const CHECK_SUMMARY: Record<string, string> = {
  VALID_HEADERS: 'HMRC says all the required headers were sent and look valid.',
  POTENTIALLY_INVALID_HEADERS: 'HMRC accepted the headers but has warnings to look at.',
  INVALID_HEADERS: 'HMRC says some headers are missing or not valid.',
};
const TEST_NAMES: Record<string, string> = {
  hello_world: 'Hello World', hello_application: 'Hello Application', hello_user: 'connection test', fraud_headers_validate: 'header test',
};

/**
 * HMRC P1 + P2: test tools for owners and admins of a connected company (sandbox only). The panel shows this only
 * when the server says the person can manage HMRC and the company is connected. No token or raw HMRC reply is shown.
 */
export default function HMRCTestTools({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState<'hello_user' | 'fraud_headers_validate' | null>(null);
  const [said, setSaid] = useState('');
  const [check, setCheck] = useState<HmrcHeaderCheck | null>(null);
  const [last, setLast] = useState<HmrcLastTest | null>(null);

  const loadLast = useCallback(async () => { setLast(await fetchLastHmrcTest(companyId)); }, [companyId]);
  useEffect(() => { setSaid(''); setCheck(null); void loadLast(); }, [loadLast]);

  const run = async (kind: 'hello_user' | 'fraud_headers_validate') => {
    setBusy(kind); setSaid(''); if (kind === 'fraud_headers_validate') setCheck(null);
    const r = await callHmrcFunction('hmrc-test-call', { company_id: companyId, kind, fraud: collectHmrcFraudData() });
    setBusy(null);
    if (!r.ok) {
      setSaid(r.code === 'hmrc_refused'
        ? `HMRC didn't accept the test call${r.hmrc_code ? ` (${r.hmrc_code})` : ''}. Please try again later.`
        : r.message ?? messageFor(r.code));
    } else if (kind === 'hello_user') {
      setSaid(r.message === 'Hello User' ? 'The connection works. HMRC replied: Hello User.' : 'HMRC answered the test call.');
    } else if (r.result) {
      setCheck(r.result);
      setSaid(CHECK_SUMMARY[r.result.code] ?? 'HMRC returned a result for the header test.');
    } else {
      setSaid(messageFor('hmrc_unavailable'));
    }
    void loadLast();
  };

  const feedback = (title: string, items: HmrcHeaderCheck['errors'], testid: string) => items.length > 0 && (
    <div data-testid={testid}>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((i, n) => (
          <li key={`${i.code}-${n}`} className="break-words">
            {i.headers.length ? <span className="font-mono text-xs">{i.headers.join(', ')}</span> : null}
            {i.headers.length ? ': ' : ''}{i.message || i.code}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-3 rounded-md border p-3" data-testid="hmrc-test-tools">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="secondary" onClick={() => run('hello_user')} disabled={!!busy} data-testid="hmrc-test-connection">
          {busy === 'hello_user' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <FlaskConical className="mr-2 h-4 w-4" aria-hidden />}
          Test the connection
        </Button>
        <Button type="button" variant="outline" onClick={() => run('fraud_headers_validate')} disabled={!!busy} data-testid="hmrc-check-headers">
          {busy === 'fraud_headers_validate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ListChecks className="mr-2 h-4 w-4" aria-hidden />}
          Check HMRC header test
        </Button>
      </div>
      <p aria-live="polite" role="status" className="text-sm" data-testid="hmrc-test-result">{said}</p>
      {check && (
        <div className="space-y-2" data-testid="hmrc-header-check">
          {feedback('Errors', check.errors, 'hmrc-header-errors')}
          {feedback('Warnings', check.warnings, 'hmrc-header-warnings')}
        </div>
      )}
      {last && (
        <p className="text-xs text-muted-foreground" data-testid="hmrc-last-tested">
          Last tested {ukDate(last.at)} ({TEST_NAMES[last.kind] ?? 'test'}: {last.passed ? 'HMRC answered' : 'did not pass'}).
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        These tests use HMRC's test environment only and send no tax figures. "Check HMRC header test" asks HMRC to check the
        fraud prevention information it requires with every call.
      </p>
      <p className="text-xs text-muted-foreground" data-testid="hmrc-privacy-note">
        HMRC requires this information to help prevent fraud: your IP address, a random device ID kept in this browser,
        your browser's user agent, screen and window size, time zone, your B2BNEST user ID (not your email address),
        and whether you used your authenticator app when you signed in.
      </p>
    </div>
  );
}
