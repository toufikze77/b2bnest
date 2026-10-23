import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building, User, Eye, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { HMRCFilingBanner, PreviewOnlyBadge, SubmitUnavailableButton, PREVIEW_ONLY } from '@/components/hmrc/filingStatus';

type TaxReturnPreview = {
  id: string;
  type: 'corporation' | 'self-assessment';
  taxYear: string;
  dueDate: string;
  profit?: number;
  taxDue: number;
};

// Example figures only (labelled on screen). Nothing here comes from or goes to HMRC.
const EXAMPLES: TaxReturnPreview[] = [
  { id: '1', type: 'corporation', taxYear: '2023-24', dueDate: '2024-12-31', profit: 85000, taxDue: 16150 },
];

const TYPE_NAME: Record<TaxReturnPreview['type'], string> = { corporation: 'Corporation Tax', 'self-assessment': 'Self Assessment' };
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HMRCTaxReturns = () => {
  const [selected, setSelected] = useState<TaxReturnPreview | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Returns</h2>
        <p className="text-muted-foreground">Prepare and preview Corporation Tax and Self Assessment figures. Filing with HMRC is not available yet.</p>
      </div>

      <HMRCFilingBanner />

      <div className="grid gap-4">
        {EXAMPLES.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    {r.type === 'corporation' ? <Building className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    <h3 className="text-lg font-semibold">{TYPE_NAME[r.type]} {r.taxYear}</h3>
                    <PreviewOnlyBadge />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                    <div><p className="text-muted-foreground">Due date</p><p className="font-medium">{format(new Date(r.dueDate), 'dd MMM yyyy')}</p></div>
                    {r.profit !== undefined && <div><p className="text-muted-foreground">Profit</p><p className="font-medium">{gbp(r.profit)}</p></div>}
                    <div><p className="text-muted-foreground">Tax due (preview)</p><p className="font-medium">{gbp(r.taxDue)}</p></div>
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

      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertTitle>Deadlines (general guidance)</AlertTitle>
        <AlertDescription>
          Corporation Tax returns are due 12 months after the end of the accounting period; tax is usually payable 9 months
          and 1 day after it. Self Assessment online returns are due by 31 January after the end of the tax year.
        </AlertDescription>
      </Alert>

      {selected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{TYPE_NAME[selected.type]} {selected.taxYear} · {PREVIEW_ONLY}</CardTitle>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {selected.profit !== undefined && <div className="flex justify-between"><span>Taxable profit</span><span className="font-mono">{gbp(selected.profit)}</span></div>}
            <div className="flex justify-between font-semibold"><span>Tax due (preview)</span><span className="font-mono">{gbp(selected.taxDue)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HMRCTaxReturns;
