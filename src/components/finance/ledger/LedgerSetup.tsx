import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { checkBalance, DEFAULT_CHART, formatPence, LEDGER_POSTED_WARNING, ledgerMessage, linesForRpc, parseOpeningCsv, parsePence, type DraftLine, emptyLine } from '@/lib/ledger';
import { codeOf, type LedgerApi } from '@/lib/ledgerApi';
import { JournalGrid } from './JournalGrid';

type Step = 'choose' | 'opening' | 'preview';

const CHART_OPTIONS = DEFAULT_CHART.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }));
const CHART_CODES = new Set(DEFAULT_CHART.map((a) => a.code));
const nameOf = (code: string) => DEFAULT_CHART.find((a) => a.code === code)?.name ?? code;

/** Setup, once per company: start fresh from a date, or import opening balances as one balanced journal at that date. */
export function LedgerSetup({ api, organizationId, onDone }: { api: LedgerApi; organizationId: string; onDone: () => void }) {
  const [step, setStep] = useState<Step>('choose');
  const [mode, setMode] = useState<'fresh' | 'import'>('fresh');
  const [startDate, setStartDate] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [csvProblems, setCsvProblems] = useState<{ line: number; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useMemo(() => checkBalance(lines, CHART_CODES), [lines]);

  const onCsv = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const r = parseOpeningCsv(text, CHART_CODES);
    setCsvProblems(r.problems);
    if (r.lines.length) setLines(r.lines.length >= 2 ? r.lines : [...r.lines, emptyLine()]);
  };

  const submit = async () => {
    setBusy(true); setError(null);
    const r = await api.setup(organizationId, startDate, mode, mode === 'import' ? linesForRpc(lines, 'account_code') : null);
    setBusy(false);
    if (r.ok) onDone(); else setError(ledgerMessage(codeOf(r)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up the ledger</CardTitle>
        <CardDescription>Choose the date your bookkeeping starts. You do this once for this company.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === 'choose' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="ledger-start">Start date</Label>
              <Input id="ledger-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="max-w-xs" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">How do you want to start?</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="ledger-mode" checked={mode === 'fresh'} onChange={() => setMode('fresh')} className="mt-1" />
                <span><strong>Start fresh</strong>: no balances before the start date.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="ledger-mode" checked={mode === 'import'} onChange={() => setMode('import')} className="mt-1" />
                <span><strong>Import opening balances</strong>: one balanced journal dated the start date.</span>
              </label>
            </fieldset>
            <Button disabled={!startDate} onClick={() => setStep(mode === 'import' ? 'opening' : 'preview')}>Next</Button>
          </>
        )}

        {step === 'opening' && (
          <>
            <p className="text-sm text-muted-foreground">
              Enter each account's balance at the start date, or upload a CSV file with the columns account_code,debit,credit.
              Codes are from the standard chart below.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ledger-csv">Upload a CSV file</Label>
              <Input id="ledger-csv" type="file" accept=".csv,text/csv" onChange={(e) => { void onCsv(e.target.files?.[0]); }} className="max-w-sm" />
            </div>
            {csvProblems.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="font-medium">Some lines in the file need fixing:</p>
                  <ul className="list-disc pl-5" aria-label="CSV problems">
                    {csvProblems.map((p, i) => <li key={i}>{p.line ? `CSV line ${p.line}: ` : ''}{p.message}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <JournalGrid idPrefix="opening" lines={lines} onChange={setLines} accounts={CHART_OPTIONS} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep('choose')}>Back</Button>
              <Button disabled={!check.ok} onClick={() => setStep('preview')}>Preview</Button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="space-y-1 text-sm" data-testid="ledger-preview">
              <p><strong>Start date:</strong> {startDate}</p>
              <p><strong>Chart of accounts:</strong> the standard chart ({DEFAULT_CHART.length} accounts). You can add and rename accounts later.</p>
              <p><strong>Opening balances:</strong> {mode === 'fresh' ? 'none (starting fresh).' : `one journal of ${check.used} lines, dated ${startDate}.`}</p>
            </div>
            {mode === 'import' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Account</th><th className="py-1 pr-2 font-medium">Debit</th><th className="py-1 font-medium">Credit</th></tr></thead>
                  <tbody>
                    {lines.filter((l) => l.account).map((l, i) => (
                      <tr key={i}><td className="py-1 pr-2">{l.account} {nameOf(l.account)}</td><td className="py-1 pr-2">{formatPence(parsePence(l.debit) ?? 0)}</td><td className="py-1">{formatPence(parsePence(l.credit) ?? 0)}</td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="font-medium"><td className="py-1 pr-2">Totals</td><td className="py-1 pr-2">{formatPence(check.debit)}</td><td className="py-1">{formatPence(check.credit)}</td></tr></tfoot>
                </table>
              </div>
            )}
            {mode === 'import' && <Alert><AlertDescription>{LEDGER_POSTED_WARNING}</AlertDescription></Alert>}
            <p className="text-sm text-muted-foreground">The start date can't be changed after the first journal.</p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(mode === 'import' ? 'opening' : 'choose')} disabled={busy}>Back</Button>
              <Button onClick={() => { void submit(); }} disabled={busy || (mode === 'import' && !check.ok)}>
                {busy ? 'Setting up…' : 'Set up the ledger'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
