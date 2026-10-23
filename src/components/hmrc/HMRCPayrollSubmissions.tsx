import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';
import { HMRCFilingBanner, PreviewOnlyBadge, SubmitUnavailableButton, PREVIEW_ONLY } from '@/components/hmrc/filingStatus';

type PayrollPreview = {
  id: string;
  type: 'FPS' | 'EPS';
  period: string;
  payDate: string;
  employeeCount: number;
  totalGross: number;
  totalTax: number;
  totalNI: number;
};

// Example figures only (labelled on screen). Nothing here comes from or goes to HMRC.
const EXAMPLES: PayrollPreview[] = [
  { id: '1', type: 'FPS', period: '2024-10', payDate: '2024-10-31', employeeCount: 5, totalGross: 15500, totalTax: 2950, totalNI: 1700 },
];

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REQUIREMENTS: Record<PayrollPreview['type'], string[]> = {
  FPS: ['Due on or before each pay date', 'Includes every employee paid in the period', 'Updates year-to-date figures for each employee'],
  EPS: ['Due by the 19th of the month after the tax month', 'Needed in some months even if no one was paid', 'Can include adjustments from earlier periods'],
};

const HMRCPayrollSubmissions = () => {
  const [selected, setSelected] = useState<PayrollPreview | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payroll (RTI)</h2>
        <p className="text-muted-foreground">Preview Full Payment Submission (FPS) and Employer Payment Summary (EPS) figures. Filing with HMRC is not available yet.</p>
      </div>

      <HMRCFilingBanner />

      <div className="grid gap-4">
        {EXAMPLES.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{s.type} · {s.period}</h3>
                    <PreviewOnlyBadge />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                    <div><p className="text-muted-foreground">Pay date</p><p className="font-medium">{format(new Date(s.payDate), 'dd MMM yyyy')}</p></div>
                    <div><p className="text-muted-foreground">Employees</p><p className="font-medium">{s.employeeCount}</p></div>
                    <div><p className="text-muted-foreground">Gross pay</p><p className="font-medium">{gbp(s.totalGross)}</p></div>
                    <div><p className="text-muted-foreground">Tax</p><p className="font-medium">{gbp(s.totalTax)}</p></div>
                    <div><p className="text-muted-foreground">NI</p><p className="font-medium">{gbp(s.totalNI)}</p></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(s)}><Eye className="mr-2 h-4 w-4" />View preview</Button>
                  <SubmitUnavailableButton />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{selected.type} {selected.period} · {PREVIEW_ONLY}</CardTitle>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <h4 className="mb-3 font-semibold">Summary</h4>
              <div className="flex justify-between"><span>Total gross pay</span><span className="font-mono">{gbp(selected.totalGross)}</span></div>
              <div className="flex justify-between"><span>Total tax deducted</span><span className="font-mono">{gbp(selected.totalTax)}</span></div>
              <div className="flex justify-between"><span>Total NI deducted</span><span className="font-mono">{gbp(selected.totalNI)}</span></div>
              <hr />
              <div className="flex justify-between font-semibold"><span>Total net pay (preview)</span><span className="font-mono">{gbp(selected.totalGross - selected.totalTax - selected.totalNI)}</span></div>
            </div>
            <div className="text-sm">
              <h4 className="mb-3 font-semibold">{selected.type} rules (general guidance)</h4>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{REQUIREMENTS[selected.type].map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HMRCPayrollSubmissions;
