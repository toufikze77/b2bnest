import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';
import { HMRCFilingBanner, PreviewOnlyBadge, SubmitUnavailableButton, PREVIEW_ONLY } from '@/components/hmrc/filingStatus';

type VATReturnPreview = {
  id: string;
  period: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  vatDue: number;
  vatReclaimed: number;
  totalSales: number;
  totalPurchases: number;
};

// Example figures only (labelled on screen). Nothing here comes from or goes to HMRC.
const EXAMPLES: VATReturnPreview[] = [
  { id: '1', period: 'Q4 2024', startDate: '2024-10-01', endDate: '2024-12-31', dueDate: '2025-02-07', vatDue: 4250, vatReclaimed: 850, totalSales: 25000, totalPurchases: 5000 },
];

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HMRCVATReturns = () => {
  const [selected, setSelected] = useState<VATReturnPreview | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">VAT Returns</h2>
        <p className="text-muted-foreground">Prepare and preview a VAT return. Filing with HMRC is not available yet.</p>
      </div>

      <HMRCFilingBanner />

      <div className="grid gap-4">
        {EXAMPLES.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{r.period}</h3>
                    <PreviewOnlyBadge />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div><p className="text-muted-foreground">Period</p><p className="font-medium">{format(new Date(r.startDate), 'dd MMM')} – {format(new Date(r.endDate), 'dd MMM yyyy')}</p></div>
                    <div><p className="text-muted-foreground">Due date</p><p className="font-medium">{format(new Date(r.dueDate), 'dd MMM yyyy')}</p></div>
                    <div><p className="text-muted-foreground">Net VAT (preview)</p><p className="font-medium">{gbp(r.vatDue - r.vatReclaimed)}</p></div>
                    <div><p className="text-muted-foreground">Total sales</p><p className="font-medium">{gbp(r.totalSales)}</p></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(r)}><Eye className="mr-2 h-4 w-4" />View preview</Button>
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
              <CardTitle>VAT return preview: {selected.period} · {PREVIEW_ONLY}</CardTitle>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <h4 className="mb-3 font-semibold">VAT calculation</h4>
              <div className="flex justify-between"><span>VAT due on sales and other outputs</span><span className="font-mono">{gbp(selected.vatDue)}</span></div>
              <div className="flex justify-between"><span>VAT reclaimed on purchases and other inputs</span><span className="font-mono">{gbp(selected.vatReclaimed)}</span></div>
              <hr />
              <div className="flex justify-between font-semibold"><span>Net VAT (preview)</span><span className="font-mono">{gbp(selected.vatDue - selected.vatReclaimed)}</span></div>
            </div>
            <div className="space-y-2 text-sm">
              <h4 className="mb-3 font-semibold">Sales and purchases</h4>
              <div className="flex justify-between"><span>Total value of sales and all other outputs</span><span className="font-mono">{gbp(selected.totalSales)}</span></div>
              <div className="flex justify-between"><span>Total value of purchases and all other inputs</span><span className="font-mono">{gbp(selected.totalPurchases)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HMRCVATReturns;
