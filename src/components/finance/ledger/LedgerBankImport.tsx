// Finance phase 3c-1: "Import statement" (docs/ledger-bank/README.md). The CSV is read here, in the browser; only the
// rows built from it go to ledger_bank_import, 500 at a time. Nothing is posted to the ledger.
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatPence } from '@/lib/ledger';
import {
  buildRows, chunk, COLUMN_LABELS, detectColumns, findHeaderRow, mappingReady, MAX_FILE_ROWS, parseCsv, totals,
  type BankRow, type Built, type ColumnKey, type ColumnMap,
} from '@/lib/bankCsv';
import { BANK_FILE_PRIVACY, type BankImportResult, type ImportDone } from '@/lib/ledgerBank';
import { codeOf, type LedgerApi } from '@/lib/ledgerApi';

const MAX_BYTES = 5 * 1024 * 1024;
const KEYS: ColumnKey[] = ['date', 'description', 'amount', 'money_in', 'money_out', 'balance', 'reference'];
const todayIso = () => new Date().toISOString().slice(0, 10);

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

type Parsed = { fileName: string; cells: string[][]; header: number; map: ColumnMap };

export function LedgerBankImport({ api, organizationId, bankAccountId, onDone, onError, busy, setBusy }: {
  api: LedgerApi; organizationId: string; bankAccountId: string;
  onDone: (r: ImportDone) => void; onError: (code: string) => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ row: number; reason: string }[] | null>(null);
  const inFlight = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    setFileError(null); setParsed(null); setRejected(null);
    if (!file) return;
    if (file.size > MAX_BYTES) { setFileError('This file is larger than 5 MB. Export a shorter period from your bank.'); return; }
    let text: string;
    try { text = await readText(file); } catch { setFileError("This file can't be read. Choose a CSV file exported from your bank."); return; }
    const cells = parseCsv(text);
    if (cells.length < 2) { setFileError('No statement lines were found in this file.'); return; }
    if (cells.length > MAX_FILE_ROWS + 15) { setFileError(`This file has more than ${MAX_FILE_ROWS.toLocaleString('en-GB')} lines. Export a shorter period.`); return; }
    const header = findHeaderRow(cells);
    setParsed({ fileName: file.name.slice(0, 120), cells, header, map: detectColumns(cells[header]) });
  };

  const built: Built | null = parsed && mappingReady(parsed.map) ? buildRows(parsed.cells, parsed.header, parsed.map, todayIso()) : null;
  const sum = built ? totals(built.rows) : null;
  const headerNames = parsed ? parsed.cells[parsed.header] : [];
  const setCol = (k: ColumnKey, v: number) => {
    if (!parsed) return;
    const map = { ...parsed.map, [k]: v };
    if (k === 'amount' && v >= 0) { map.money_in = -1; map.money_out = -1; }
    if ((k === 'money_in' || k === 'money_out') && v >= 0) map.amount = -1;
    setParsed({ ...parsed, map });
  };

  const run = async (rows: BankRow[]) => {
    if (inFlight.current || busy || !parsed) return;
    inFlight.current = true; setBusy(true); setRejected(null);
    const done: ImportDone = { imported: 0, skipped: 0, rejected: 0, importedBefore: false };
    try {
      const parts = chunk(rows);
      for (let i = 0; i < parts.length; i++) {
        setProgress(parts.length > 1 ? `Importing part ${i + 1} of ${parts.length}…` : 'Importing…');
        const r = await api.bankImport(organizationId, bankAccountId, parsed.fileName, parts[i]);
        if (!r.ok) { onError(codeOf(r)); return; }
        const d: BankImportResult = r.data;
        if (d.result === 'rejected') {
          done.rejected += d.rejected;
          setRejected(d.problems.map((p) => ({ row: p.row + i * 500, reason: p.reason })));
          break;
        }
        done.imported += d.imported; done.skipped += d.skipped_duplicates;
        if (i === 0 && d.imported_before) done.importedBefore = true;
      }
      setParsed(null);
      if (input.current) input.current.value = '';
      onDone(done);
    } finally {
      inFlight.current = false; setBusy(false); setProgress(null);
    }
  };

  return (
    <div className="space-y-3" data-testid="bank-import">
      <p className="text-muted-foreground">{BANK_FILE_PRIVACY}</p>
      <div>
        <label htmlFor="bank-file" className="mb-1 block font-medium">Statement file (CSV)</label>
        <input id="bank-file" ref={input} type="file" accept=".csv,text/csv" disabled={busy}
          onChange={(e) => { void choose(e.target.files?.[0]); }} className="block text-sm" />
      </div>
      {fileError && <p role="alert" className="text-destructive">{fileError}</p>}
      {parsed && (
        <div className="space-y-3 rounded-md border p-3" data-testid="bank-mapping">
          <p className="font-medium">Which column is which?</p>
          <p className="text-muted-foreground">Choose one Amount column (money out negative), or separate Money in and Money out columns.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {KEYS.map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span>{COLUMN_LABELS[k]}</span>
                <select aria-label={COLUMN_LABELS[k]} value={parsed.map[k]} disabled={busy} onChange={(e) => setCol(k, Number(e.target.value))}
                  className="rounded-md border bg-background px-2 py-1">
                  <option value={-1}>(not used)</option>
                  {headerNames.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {!mappingReady(parsed.map) && <p role="alert" className="text-destructive">Choose the Date, Description and Amount (or Money in / Money out) columns.</p>}
          {built && sum && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left" data-testid="bank-preview">
                  <caption className="mb-1 text-left font-medium">First {Math.min(10, built.rows.length)} of {built.rows.length} lines</caption>
                  <thead><tr><th className="pr-3">Date</th><th className="pr-3">Description</th><th className="pr-3 text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
                  <tbody>
                    {built.rows.slice(0, 10).map((r, i) => (
                      <tr key={i}><td className="whitespace-nowrap pr-3">{r.date}</td><td className="pr-3">{r.description}</td>
                        <td className="whitespace-nowrap pr-3 text-right tabular-nums">{formatPence(r.amount_pence)}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">{r.balance_pence == null ? '' : formatPence(r.balance_pence)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p data-testid="bank-totals">
                {sum.count} lines{sum.first ? `, ${sum.first} to ${sum.last}` : ''}. Money in {formatPence(sum.moneyIn)}, money out {formatPence(sum.moneyOut)}.
              </p>
              {(built.problems.length > 0 || built.skippedZero > 0) && (
                <div role="status" className="rounded-md border border-amber-500/50 p-2" data-testid="bank-warnings">
                  {built.skippedZero > 0 && <p>{built.skippedZero} line{built.skippedZero === 1 ? '' : 's'} with a zero amount will be left out.</p>}
                  {built.problems.length > 0 && (
                    <>
                      <p>{built.problems.length} line{built.problems.length === 1 ? '' : 's'} can't be read and will be left out:</p>
                      <ul className="list-disc pl-5">{built.problems.slice(0, 10).map((p) => <li key={p.line}>Line {p.line}: {p.reason}</li>)}</ul>
                    </>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void run(built.rows); }} disabled={busy || built.rows.length === 0} aria-busy={busy}>
                  {busy ? progress ?? 'Importing…' : `Import ${built.rows.length} line${built.rows.length === 1 ? '' : 's'}`}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => { setParsed(null); if (input.current) input.current.value = ''; }}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}
      {rejected && (
        <div role="alert" className="text-destructive" data-testid="bank-rejected">
          <p>That part of the file was not imported because some lines were refused:</p>
          <ul className="list-disc pl-5">{rejected.slice(0, 10).map((p) => <li key={p.row}>Row {p.row}: {p.reason.replace(/_/g, ' ')}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

