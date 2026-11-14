import React, { useState, useEffect, useRef } from 'react';
import { runLedgerAutoSoon } from '@/lib/ledgerAutoRun';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Save, CheckCircle2, Edit, X, FileText, Upload, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CURRENCIES } from '@/utils/currencyUtils';
import { formatMoney, normalizeCurrency } from '@/lib/money';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import ImageUpload from '@/components/ImageUpload';
import { useOptionalActiveOrganization } from '@/contexts/OrganizationContext';
import { companyErrorMessage, isMissingCompanyColumn, withoutCompany } from '@/lib/financeCompany';
import {
  DEFAULT_TREATMENT, fromPence, INVOICE_VAT_KEYS, isGbp, isMissingColumnError, isRecordedInvoice, isVatTreatment, lineNetPence, sumLines,
  treatmentsIn, VAT_RATES, VAT_SCHEME, VAT_TREATMENT_LABELS, VAT_TREATMENT_SHORT, VAT_TREATMENTS, type VatTreatment,
} from '@/lib/vat';

type DocItem = { id: string; description: string; quantity: number; rate: number; amount: number; vat_treatment: VatTreatment | '' };
const todayIso = () => new Date().toISOString().slice(0, 10);

interface QuoteInvoiceCreationSectionProps {
  documentType: 'quote' | 'invoice';
  onDocumentSaved: () => void;
  editingDocument?: any;
  onEditComplete?: () => void;
  onCancelEdit?: () => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

const QuoteInvoiceCreationSection: React.FC<QuoteInvoiceCreationSectionProps> = ({
  documentType,
  onDocumentSaved,
  editingDocument,
  onEditComplete,
  onCancelEdit
}) => {
  const { user } = useAuth();
  // New documents use the account currency (sent explicitly, never the database default of USD).
  const accountCurrency = useAccountCurrency();
  const [isLoading, setIsLoading] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [logoUrl, setLogoUrl] = useState('');
  // A new document starts with the logo from the latest invoice or quote (shown with "Use a different logo" / "Remove").
  const [logoSuggested, setLogoSuggested] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const logoRef = useRef('');
  logoRef.current = logoUrl;
  
  // Form state
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_address: '',
    company_name: '',
    company_address: '',
    notes: '',
    tax_rate: '0',
    valid_until: '',
    due_date: '',
    status: 'draft',
    logo_url: '',
    currency: ''
  });

  const [items, setItems] = useState<DocItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0, vat_treatment: DEFAULT_TREATMENT }
  ]);
  // HMRC P4 (invoices only): the tax point, the date VAT is counted (standard scheme: the invoice date).
  const [taxPointDate, setTaxPointDate] = useState(todayIso());
  const isInvoice = documentType === 'invoice';
  // HMRC P4b: an invoice belongs to a company (organization_id). A new one starts with the active company; an older one
  // with no company must have one chosen before its VAT is recorded. Quotes have no company link.
  const org = useOptionalActiveOrganization();
  const companies = org?.memberships ?? [];
  const [companyId, setCompanyId] = useState<string>(editingDocument?.organization_id ?? org?.organizationId ?? '');
  useEffect(() => {
    setCompanyId(editingDocument ? editingDocument.organization_id ?? '' : org?.organizationId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDocument?.id, org?.organizationId]);
  const askCompany = isInvoice && companies.length > 0 && (!editingDocument || ('organization_id' in editingDocument && !editingDocument.organization_id));

  // Load products on mount and when the signed-in person changes (by id: a session refresh gives a new user object).
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // New document with no logo yet: use the logo of this person's latest invoice or quote (logo_url). Nothing is written.
  useEffect(() => {
    if (editingDocument || !user?.id) return;
    let live = true;
    const latest = async (table: 'invoices' | 'quotes') => {
      const { data, error } = await supabase.from(table).select('logo_url, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (error || !Array.isArray(data)) return null;
      const row = (data as { logo_url?: string | null; created_at?: string }[]).find((r) => typeof r.logo_url === 'string' && r.logo_url.trim());
      return row ? { url: row.logo_url as string, at: String(row.created_at ?? '') } : null;
    };
    (async () => {
      try {
        const found = (await Promise.all([latest('invoices'), latest('quotes')])).filter((x): x is { url: string; at: string } => !!x);
        const pick = found.sort((a, b) => b.at.localeCompare(a.at))[0];
        if (!live || !pick || logoRef.current) return;
        setLogoUrl(pick.url);
        setFormData((prev) => ({ ...prev, logo_url: pick.url }));
        setLogoSuggested(true);
      } catch { /* no suggestion: the uploader is shown as usual */ }
    })();
    return () => { live = false; };
  }, [editingDocument, user?.id, resetCount]);

  const loadProducts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Load editing document data
  useEffect(() => {
    if (editingDocument) {
      setFormData({
        client_name: editingDocument.client_name || '',
        client_email: editingDocument.client_email || '',
        client_address: editingDocument.client_address || '',
        company_name: editingDocument.company_name || '',
        company_address: editingDocument.company_address || '',
        notes: editingDocument.notes || '',
        tax_rate: String(editingDocument.tax_rate || 0),
        valid_until: editingDocument.valid_until || '',
        due_date: editingDocument.due_date || '',
        status: editingDocument.status || 'draft',
        logo_url: editingDocument.logo_url || '',
        // An existing document keeps its stored currency.
        currency: normalizeCurrency(editingDocument.currency)
      });
      
      setLogoUrl(editingDocument.logo_url || '');
      
      // Set draft checkbox based on current status
      setSaveAsDraft(editingDocument.status === 'draft');
      
      if (editingDocument.items && Array.isArray(editingDocument.items)) {
        setItems(editingDocument.items.map((item: any, index: number) => ({
          id: String(index + 1),
          description: item.description || '',
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: item.amount || 0,
          // An older invoice has no VAT treatment on its lines: the owner chooses one (nothing is guessed).
          vat_treatment: isVatTreatment(item.vat_treatment) ? item.vat_treatment : '',
        })));
      }
      // The tax point: as saved, or for an older invoice the date it was created in B2BNEST (shown, editable).
      setTaxPointDate(editingDocument.tax_point_date || (editingDocument.created_at ? String(editingDocument.created_at).slice(0, 10) : todayIso()));
    } else {
      // Reset form for new document
      resetForm();
    }
  }, [editingDocument]);

  const resetForm = () => {
    setFormData({
      client_name: '',
      client_email: '',
      client_address: '',
      company_name: '',
      company_address: '',
      notes: '',
      tax_rate: '0',
      valid_until: '',
      due_date: '',
      status: 'draft',
      logo_url: '',
      currency: ''
    });
    setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0, vat_treatment: DEFAULT_TREATMENT }]);
    setTaxPointDate(todayIso());
    setSaveAsDraft(true);
    setLogoUrl('');
    setLogoSuggested(false);
    setResetCount((n) => n + 1);
  };

  // Line amounts in pence (quantity x unit price, rounded to the penny): no floating-point sums.
  const calculateItemAmount = (quantity: number, rate: number) => {
    const p = lineNetPence(quantity, rate);
    return Number.isFinite(p) ? fromPence(p) : 0;
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = calculateItemAmount(updated.quantity, updated.rate);
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    const newId = String(items.length + 1);
    setItems(prev => [...prev, {
      id: newId,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      vat_treatment: DEFAULT_TREATMENT
    }]);
  };

  const addProductAsItem = (product: Product) => {
    const newId = String(items.length + 1);
    setItems(prev => [...prev, {
      id: newId,
      description: product.name + (product.description ? ` - ${product.description}` : ''),
      quantity: 1,
      rate: product.price,
      amount: calculateItemAmount(1, product.price),
      vat_treatment: DEFAULT_TREATMENT
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // Quotes keep one tax rate for the document, as before. Invoices (HMRC P4): VAT per line, rounded per line, summed.
  const vatLines = items.map((item) => ({ treatment: (item.vat_treatment || DEFAULT_TREATMENT) as VatTreatment, netPence: lineNetPence(item.quantity, item.rate) || 0 }));
  const vatTotals = sumLines(vatLines);
  const calculateTotals = () => {
    if (isInvoice) return { subtotal: fromPence(vatTotals.net), taxAmount: fromPence(vatTotals.vat), total: fromPence(vatTotals.gross) };
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * Number(formData.tax_rate)) / 100;
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();
  const lineTreatments = Array.from(new Set(items.map((i) => i.vat_treatment)));
  const mixedRates = isInvoice && lineTreatments.length === 1 && lineTreatments[0] ? false : isInvoice;
  const wasNotRecorded = isInvoice && !!editingDocument && !isRecordedInvoice(editingDocument);
  const currency = formData.currency || (editingDocument ? normalizeCurrency(editingDocument.currency) : accountCurrency);
  const fmt = (n: number) => formatMoney(n, currency, { cents: true });
  const currencyOptions = Array.from(new Set([...(accountCurrency ? [accountCurrency] : []), ...Object.keys(CURRENCIES), ...(currency ? [currency] : [])]));

  const handleSubmit = async () => {
    if (!user) return;
    
    // Basic validation
    if (!formData.client_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Client name is required",
        variant: "destructive"
      });
      return;
    }

    if (items.some(item => !item.description.trim())) {
      toast({
        title: "Validation Error", 
        description: "All items must have a description",
        variant: "destructive"
      });
      return;
    }
    
    if (isInvoice && items.some((item) => !item.vat_treatment)) {
      toast({ title: "Validation Error", description: "Choose a VAT treatment for every line.", variant: "destructive" });
      return;
    }
    if (askCompany && !companyId) {
      toast({ title: "Validation Error", description: "Choose the company this invoice belongs to.", variant: "destructive" });
      return;
    }
    if (isInvoice && !/^\d{4}-\d{2}-\d{2}$/.test(taxPointDate)) {
      toast({ title: "Validation Error", description: "Enter the tax point date (the date VAT is counted).", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      // HMRC P4: an invoice saves its VAT per line (treatment, rate, net, VAT, gross), the tax point and "recorded".
      // tax_rate / tax_amount stay filled for older screens: tax_amount = the lines' VAT, tax_rate = the one rate if
      // every line has the same treatment, otherwise 0 (mixed rates).
      const invoiceItems = items.map((item, i) => {
        const line = vatTotals.lines[i];
        return { ...item, amount: fromPence(line.net), vat_treatment: line.treatment, vat_rate: VAT_RATES[line.treatment],
          net: fromPence(line.net), vat: fromPence(line.vat), gross: fromPence(line.gross) };
      });
      const singleTreatment = lineTreatments.length === 1 && isVatTreatment(lineTreatments[0]) ? lineTreatments[0] : null;
      const documentData = {
        user_id: user.id,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_address: formData.client_address,
        company_name: formData.company_name,
        company_address: formData.company_address,
        items: isInvoice ? invoiceItems : items.map(({ vat_treatment: _t, ...rest }) => rest),
        subtotal: subtotal,
        tax_rate: isInvoice ? (singleTreatment ? VAT_RATES[singleTreatment] : 0) : Number(formData.tax_rate),
        tax_amount: taxAmount,
        total_amount: total,
        notes: formData.notes,
        status: saveAsDraft ? 'draft' : 'sent',
        logo_url: logoUrl,
        currency: currency || null,
        updated_at: new Date().toISOString(),
        ...(documentType === 'quote' && {
          valid_until: formData.valid_until || null,
          quote_number: editingDocument?.quote_number || `Q-${Date.now()}`
        }),
        ...(documentType === 'invoice' && {
          due_date: formData.due_date || null,
          invoice_number: editingDocument?.invoice_number || `INV-${Date.now()}`,
          tax_point_date: taxPointDate,
          vat_scheme: VAT_SCHEME,
          vat_status: 'recorded',
          ...(askCompany && companyId ? { organization_id: companyId } : {}),
        })
      };

      const save = async (row: Record<string, unknown>) => {
        if (editingDocument) {
          // Update existing document
          const { data, error } = await supabase
            .from(documentType === 'quote' ? 'quotes' : 'invoices')
            .update(row as any)
            .eq('id', editingDocument.id)
            .select()
            .single();
          return { data, error };
        }
        // Create new document
        const { data, error } = await supabase
          .from(documentType === 'quote' ? 'quotes' : 'invoices')
          .insert([row] as any)
          .select()
          .single();
        return { data, error };
      };
      let result = await save(documentData);
      // Before the HMRC P4b database update there is no organization_id column: save without it.
      if (result.error && 'organization_id' in documentData && isMissingCompanyColumn(result.error)) result = await save(withoutCompany(documentData));
      // Before the HMRC P4 database update the three VAT columns don't exist: save without them (the lines keep their
      // VAT), and say the invoice will show as "VAT not recorded" until the update is applied and it is saved again.
      let vatColumnsMissing = false;
      if (result.error && isInvoice && isMissingColumnError(result.error)) {
        const legacy: Record<string, unknown> = { ...documentData };
        for (const k of INVOICE_VAT_KEYS) delete legacy[k];
        result = await save(legacy);
        vatColumnsMissing = !result.error;
      }

      if (result.error) throw result.error;
      // Ledger automatic postings: post this invoice straight away (fire and forget; never affects this flow).
      if (isInvoice) runLedgerAutoSoon((result.data as { organization_id?: string | null } | null)?.organization_id ?? editingDocument?.organization_id);

      const action = editingDocument ? 'updated' : 'created';
      const status = saveAsDraft ? 'draft' : 'sent';
      toast({
        title: "Success",
        description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} ${action} as ${status}.${status === 'sent' ? ' No email was sent from B2BNEST.' : ''}${vatColumnsMissing ? ' VAT details will be recorded after a database update.' : ''}`
      });
      
      onDocumentSaved();
      if (editingDocument && onEditComplete) {
        onEditComplete();
      }

      // Reset form if creating new document
      if (!editingDocument) {
        resetForm();
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Error",
        description: companyErrorMessage(error as { message?: string }) ?? "Failed to save document",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!editingDocument || !user) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from(documentType === 'quote' ? 'quotes' : 'invoices')
        .update({ 
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingDocument.id);

      if (error) throw error;
      if (documentType === 'invoice') runLedgerAutoSoon(editingDocument.organization_id);

      toast({
        title: "Success",
        description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} reverted to draft`
      });
      setSaveAsDraft(true);
      onDocumentSaved();
    } catch (error) {
      console.error('Error reverting to draft:', error);
      toast({
        title: "Error",
        description: "Failed to revert to draft",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isEditing = !!editingDocument;
  const documentTitle = isEditing 
    ? `Edit ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}` 
    : `Create ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}`;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>{documentTitle}</CardTitle>
              <CardDescription>
                {isEditing ? 'Update your existing document' : 'Generate professional quotes and invoices'}
              </CardDescription>
            </div>
          </div>
          {isEditing && (
            <div className="flex items-center gap-2">
              <Badge variant={editingDocument.status === 'draft' ? 'secondary' : 'default'}>
                {editingDocument.status}
              </Badge>
              {onCancelEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancelEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Client Information</h3>
            <div>
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Enter client name"
                required
              />
            </div>
            <div>
              <Label htmlFor="client_email">Client Email</Label>
              <Input
                id="client_email"
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>
            <div>
              <Label htmlFor="client_address">Client Address</Label>
              <Textarea
                id="client_address"
                value={formData.client_address}
                onChange={(e) => setFormData(prev => ({ ...prev, client_address: e.target.value }))}
                placeholder="Enter client address"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Information</h3>
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Your company name"
              />
            </div>
            <div>
              <Label htmlFor="company_address">Company Address</Label>
              <Textarea
                id="company_address"
                value={formData.company_address}
                onChange={(e) => setFormData(prev => ({ ...prev, company_address: e.target.value }))}
                placeholder="Your company address"
                rows={3}
              />
            </div>
            {!isInvoice && <div>
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: e.target.value }))}
                placeholder="0"
              />
            </div>}
          </div>
        </div>

        {/* Document Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentType === 'quote' && (
            <div>
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>
          )}
          <div>
            <Label htmlFor="doc_currency">Currency</Label>
            <Select value={currency || undefined} onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}>
              <SelectTrigger id="doc_currency" aria-describedby="doc_currency_help"><SelectValue placeholder="Choose a currency" /></SelectTrigger>
              <SelectContent>
                {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}{c === accountCurrency ? ' (account currency)' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            <p id="doc_currency_help" className="mt-1 text-small text-muted-foreground">
              {editingDocument ? 'This document keeps the currency it was saved in unless you change it.' : 'Defaults to your account currency. Change it for this document only.'}
            </p>
          </div>
          {documentType === 'invoice' && (
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          )}
          {askCompany && (
            <div>
              <Label htmlFor="invoice_company">Company *</Label>
              <select id="invoice_company" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-describedby="invoice_company_help" required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="" disabled>Choose a company</option>
                {companies.map((c) => <option key={c.organizationId} value={c.organizationId}>{c.name}</option>)}
              </select>
              <p id="invoice_company_help" className="mt-1 text-small text-muted-foreground">{editingDocument ? 'This invoice has no company yet. Choose the one it belongs to: its VAT is recorded for that company.' : 'The company this invoice belongs to.'}</p>
            </div>
          )}
          {isInvoice && (
            <div>
              <Label htmlFor="tax_point_date">Tax point date (VAT) *</Label>
              <Input id="tax_point_date" type="date" value={taxPointDate} onChange={(e) => setTaxPointDate(e.target.value)} aria-describedby="tax_point_help" required />
              <p id="tax_point_help" className="mt-1 text-small text-muted-foreground">The date VAT is counted. On the standard scheme this is the invoice date.</p>
            </div>
          )}
        </div>
        {isInvoice && wasNotRecorded && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50" data-testid="invoice-vat-not-recorded">
            This invoice was saved before VAT was recorded per line. Check the tax point date and choose a VAT treatment for each line, then save to record its VAT.
          </p>
        )}
        {isInvoice && currency && !isGbp(currency) && (
          <p className="text-sm text-muted-foreground" data-testid="invoice-not-gbp">This invoice is in {currency}. Its VAT is kept as entered, but invoices not in GBP are left out of VAT returns until currency conversion exists.</p>
        )}

        {/* Logo Upload */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Company Logo</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            {logoSuggested && logoUrl && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" data-testid="logo-suggested">
                <span className="text-muted-foreground">Using the logo from your latest invoice or quote.</span>
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-upload-user-avatars')?.click()}>Use a different logo</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoUrl(''); setFormData((prev) => ({ ...prev, logo_url: '' })); setLogoSuggested(false); }}>Remove</Button>
              </div>
            )}
            <ImageUpload
              onImageUploaded={(url) => {
                setLogoUrl(url);
                setFormData(prev => ({ ...prev, logo_url: url }));
                setLogoSuggested(false);
              }}
              userId={user?.id}
              bucket="user-avatars"
              currentImageUrl={logoUrl}
              accept="image/*"
              maxSize={5}
              className="w-full"
              label="Upload Company Logo"
            />
            {logoUrl && (
              <div className="mt-2">
                <img src={logoUrl} alt="Company logo used on your quotes and invoices" className="h-16 w-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Items</h3>
            <div className="flex gap-2">
              {products.length > 0 && (
                <Select onValueChange={(value) => {
                  const product = products.find(p => p.id === value);
                  if (product) addProductAsItem(product);
                }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select product/service" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>{product.name} - {fmt(product.price)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={addItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                <div className={isInvoice ? 'col-span-12 md:col-span-3' : 'col-span-5'}>
                  <Label htmlFor={`desc-${item.id}`}>Description *</Label>
                  <Input
                    id={`desc-${item.id}`}
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                  <Input
                    id={`qty-${item.id}`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`rate-${item.id}`}>Rate</Label>
                  <Input
                    id={`rate-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                  />
                </div>
                {isInvoice && (
                  <div className="col-span-6 md:col-span-2">
                    <Label htmlFor={`vat-${item.id}`}>VAT *</Label>
                    <select id={`vat-${item.id}`} value={item.vat_treatment} onChange={(e) => updateItem(item.id, 'vat_treatment', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {!item.vat_treatment && <option value="">Choose…</option>}
                      {VAT_TREATMENTS.map((t) => <option key={t} value={t}>{VAT_TREATMENT_LABELS[t]}</option>)}
                    </select>
                  </div>
                )}
                <div className="col-span-2">
                  <Label htmlFor={`amount-${item.id}`}>{isInvoice ? 'Net' : 'Amount'}</Label>
                  <Input
                    id={`amount-${item.id}`}
                    value={fmt(item.amount)}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    onClick={() => removeItem(item.id)}
                    variant="outline"
                    size="sm"
                    disabled={items.length === 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span>{isInvoice ? 'Net total:' : 'Subtotal:'}</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {isInvoice && (
            <div className="space-y-1" data-testid="invoice-vat-groups">
              {treatmentsIn(vatTotals).map((t) => {
                const g = vatTotals.byTreatment[t]!;
                return (
                  <div key={t} className="flex justify-between text-sm text-muted-foreground">
                    <span>{VAT_TREATMENT_SHORT[t]}: net {fmt(fromPence(g.net))}</span>
                    <span>VAT {fmt(fromPence(g.vat))}</span>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm">
                <span>VAT total{mixedRates ? ' (mixed rates)' : ''}:</span>
                <span>{fmt(taxAmount)}</span>
              </div>
            </div>
          )}
          {!isInvoice && Number(formData.tax_rate) > 0 && (
            <div className="flex justify-between text-sm">
              <span>Tax ({formData.tax_rate}%):</span>
              <span>{fmt(taxAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total:</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes or terms"
            rows={3}
          />
        </div>

        {/* Draft Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="save-as-draft"
            checked={saveAsDraft}
            onCheckedChange={(checked) => setSaveAsDraft(checked as boolean)}
          />
          <Label htmlFor="save-as-draft" className="text-sm font-medium">
            Save as draft (not yet sent to the customer)
          </Label>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {isEditing && editingDocument.status === 'sent' && (
            <Button
              onClick={handleRevertToDraft}
              variant="outline"
              disabled={isLoading}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Revert to Draft
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1"
          >
            {saveAsDraft ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving Draft...' : isEditing ? 'Update Draft' : 'Save as Draft'}
              </>
            ) : (
              <>
                {/* Only records the status: B2BNEST does not email the document. */}
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving…' : isEditing ? 'Update and mark as sent' : 'Save and mark as sent'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteInvoiceCreationSection;