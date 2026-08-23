import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Eye, Palette } from 'lucide-react';
import { toast } from 'sonner';
import {
  DOCUMENT_TEMPLATES,
  DocumentTemplate,
  DocumentTemplateId,
  renderDocumentPdf,
} from '@/lib/documentTemplates';
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates';

const rgb = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Small visual mock of how the PDF will look. */
const TemplateThumb: React.FC<{ template: DocumentTemplate }> = ({ template: t }) => {
  const accent = rgb(t.accent);
  const banded = t.headerStyle === 'band' || t.headerStyle === 'dark';

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border bg-white"
      style={{ aspectRatio: '210 / 148', fontFamily: t.font === 'times' ? 'serif' : 'sans-serif' }}
      aria-hidden
    >
      {t.headerStyle === 'sidebar' && (
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />
      )}
      {banded ? (
        <div className="flex items-center justify-between px-3 py-2" style={{ background: accent }}>
          <div>
            <div className="h-1.5 w-16 rounded bg-white/90" />
            <div className="mt-1 h-1 w-10 rounded bg-white/50" />
          </div>
          <div className="h-2 w-12 rounded bg-white/90" />
        </div>
      ) : (
        <div className="flex items-start justify-between px-3 pt-3">
          <div>
            <div className="h-1.5 w-16 rounded" style={{ background: accent }} />
            <div className="mt-1 h-1 w-10 rounded bg-gray-300" />
          </div>
          <div className="h-2 w-12 rounded" style={{ background: accent }} />
        </div>
      )}

      <div className="px-3 pt-3">
        {t.headerStyle === 'rule' && <div className="mb-2 h-[2px] w-full" style={{ background: accent }} />}
        {t.headerStyle === 'plain' && <div className="mb-2 h-px w-full bg-gray-200" />}
        <div className="flex justify-between">
          <div className="space-y-1">
            <div className="h-1 w-14 rounded bg-gray-400" />
            <div className="h-1 w-10 rounded bg-gray-200" />
          </div>
          <div className="space-y-1">
            <div className="ml-auto h-1 w-12 rounded bg-gray-300" />
            <div className="ml-auto h-1 w-8 rounded bg-gray-200" />
          </div>
        </div>

        <div className="mt-3">
          <div
            className="h-2 w-full rounded-sm"
            style={{ background: t.headerStyle === 'plain' ? '#e5e7eb' : accent }}
          />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-3 items-center gap-1 px-1"
              style={{ background: t.zebraRows && i % 2 === 1 ? '#f5f6f8' : 'transparent' }}
            >
              <div className="h-1 flex-1 rounded bg-gray-200" />
              <div className="h-1 w-4 rounded bg-gray-200" />
              <div className="h-1 w-6 rounded bg-gray-300" />
            </div>
          ))}
        </div>

        <div className="mt-2 flex justify-end">
          <div
            className="h-2.5 w-16 rounded-sm"
            style={{
              background: t.headerStyle === 'plain' ? 'transparent' : accent,
              borderTop: t.headerStyle === 'plain' ? `2px solid ${accent}` : undefined,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const SAMPLE = {
  number: 'PREVIEW-001',
  created_at: new Date().toISOString(),
  status: 'draft',
  company_name: 'Your Company Ltd',
  company_address: '10 Business Street\nLondon, EC1A 1BB',
  client_name: 'Acme Industries',
  client_email: 'accounts@acme.com',
  client_address: '5 Client Avenue\nManchester, M1 2AB',
  items: [
    { description: 'Consulting services — discovery workshop', quantity: 2, rate: 450, amount: 900 },
    { description: 'Implementation & configuration', quantity: 1, rate: 1250, amount: 1250 },
    { description: 'Support retainer (monthly)', quantity: 3, rate: 200, amount: 600 },
  ],
  subtotal: 2750,
  tax_rate: 20,
  tax_amount: 550,
  total_amount: 3300,
  notes: 'Payment due within 30 days. Thank you for your business.',
};

interface Props {
  currency?: string;
}

const TemplateGrid: React.FC<{
  documentType: 'quote' | 'invoice';
  selected: DocumentTemplateId;
  onSelect: (id: DocumentTemplateId) => void;
  currency: string;
}> = ({ documentType, selected, onSelect, currency }) => {
  const previewPdf = (id: DocumentTemplateId) => {
    const pdf = renderDocumentPdf({ ...SAMPLE, type: documentType }, id, currency);
    window.open(pdf.output('bloburl'), '_blank');
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DOCUMENT_TEMPLATES.map((t) => {
        const isDefault = selected === t.id;
        return (
          <Card
            key={t.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isDefault ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(t.id)}
          >
            <CardContent className="space-y-3 p-4">
              <TemplateThumb template={t} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {isDefault && (
                  <Badge className="shrink-0">
                    <Check className="mr-1 h-3 w-3" /> Default
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    previewPdf(t.id);
                  }}
                >
                  <Eye className="mr-1 h-4 w-4" /> Preview
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  variant={isDefault ? 'secondary' : 'default'}
                  disabled={isDefault}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(t.id);
                  }}
                >
                  {isDefault ? 'In use' : 'Use as default'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const DocumentTemplatePicker: React.FC<Props> = ({ currency = 'GBP' }) => {
  const { prefs, setDefaultTemplate } = useDocumentTemplates();
  const [tab, setTab] = useState<'invoice' | 'quote'>('invoice');

  const handleSelect = async (documentType: 'quote' | 'invoice', id: DocumentTemplateId) => {
    try {
      await setDefaultTemplate(documentType, id);
      toast.success(`Saved as your default ${documentType} template`);
    } catch {
      toast.error('Could not save your template preference');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          <div>
            <CardTitle>Document Templates</CardTitle>
            <CardDescription>
              Choose a design for your invoices and quotes. Your choice is saved and used by default
              for every PDF you download or send.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'invoice' | 'quote')}>
          <TabsList className="mb-4">
            <TabsTrigger value="invoice">Invoice template</TabsTrigger>
            <TabsTrigger value="quote">Quote template</TabsTrigger>
          </TabsList>
          <TabsContent value="invoice">
            <TemplateGrid
              documentType="invoice"
              selected={prefs.invoice_template}
              onSelect={(id) => handleSelect('invoice', id)}
              currency={currency}
            />
          </TabsContent>
          <TabsContent value="quote">
            <TemplateGrid
              documentType="quote"
              selected={prefs.quote_template}
              onSelect={(id) => handleSelect('quote', id)}
              currency={currency}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DocumentTemplatePicker;
