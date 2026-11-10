import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { checkBalance, differenceText, emptyLine, formatPence, type DraftLine } from '@/lib/ledger';

export interface GridAccount { value: string; label: string }

/** The balanced grid: account, debit, credit per line, with the running totals and difference underneath. */
export function JournalGrid({ lines, onChange, accounts, idPrefix }: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  accounts: GridAccount[];
  idPrefix: string;
}) {
  const known = new Set(accounts.map((a) => a.value));
  const check = checkBalance(lines, known);
  const set = (i: number, patch: Partial<DraftLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Account</th>
              <th className="py-2 pr-2 font-medium">Debit (£)</th>
              <th className="py-2 pr-2 font-medium">Credit (£)</th>
              <th className="py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <select aria-label={`Line ${i + 1} account`} id={`${idPrefix}-acc-${i}`} value={l.account}
                    onChange={(e) => set(i, { account: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Choose an account</option>
                    {accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <Input aria-label={`Line ${i + 1} debit`} inputMode="decimal" value={l.debit} onChange={(e) => set(i, { debit: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <Input aria-label={`Line ${i + 1} credit`} inputMode="decimal" value={l.credit} onChange={(e) => set(i, { credit: e.target.value })} />
                </td>
                <td className="py-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 2}
                    onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td className="py-2 pr-2">Totals</td>
              <td className="py-2 pr-2" data-testid={`${idPrefix}-total-debit`}>{formatPence(check.debit)}</td>
              <td className="py-2 pr-2" data-testid={`${idPrefix}-total-credit`}>{formatPence(check.credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, emptyLine()])}>
        <Plus className="h-4 w-4" aria-hidden="true" />Add line
      </Button>
      <p role="status" data-testid={`${idPrefix}-difference`} className={check.difference === 0 && check.debit > 0 ? 'text-sm font-medium text-green-700' : 'text-sm font-medium text-amber-800'}>
        {differenceText(check)}
      </p>
      {check.problems.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive" aria-label="Line problems">
          {check.problems.map((p, i) => <li key={i}>{p.line ? `Line ${p.line}: ` : ''}{p.message}</li>)}
        </ul>
      )}
    </div>
  );
}
