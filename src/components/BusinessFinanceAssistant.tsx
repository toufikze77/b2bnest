import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuoteInvoiceCreationSection from '@/components/QuoteInvoiceCreationSection';
import PayrollUK from '@/components/payroll/PayrollUK';
import { formatCurrency } from '@/utils/currencyUtils';
import { formatMoney } from '@/lib/money';
import { DocumentsTable } from '@/components/finance/DocumentsTable';
import { FinanceOverview } from '@/components/finance/FinanceOverview';
import { FinanceAnalytics } from '@/components/finance/FinanceAnalytics';
import { FinanceReports } from '@/components/finance/FinanceReports';
import { InvoiceStatusChip, QuoteStatusChip } from '@/components/finance/DocStatusChip';
import { ExpensesTab } from '@/components/finance/ExpensesTab';
import { OutgoingsTab } from '@/components/finance/OutgoingsTab';
import { ProductsTab } from '@/components/finance/ProductsTab';
import { SuppliersTab } from '@/components/finance/SuppliersTab';
import { moneyOutApi, MoneyOutTable } from '@/lib/moneyOutApi';
import DocumentTemplatePicker from '@/components/documents/DocumentTemplatePicker';
import { useDocumentTemplates } from '@/hooks/useDocumentTemplates';
import { renderDocumentPdf } from '@/lib/documentTemplates';
import { Tables } from '@/integrations/supabase/types';
// Type definitions
type Quote = Tables<'quotes'>;
type Invoice = Tables<'invoices'>;
type Product = Tables<'products_services'>;
type Supplier = Tables<'suppliers'>;
type Expense = Tables<'expenses'>;
type Outgoing = Tables<'outgoings'>;
type BankAccount = Tables<'bank_accounts'>;
type BankTransaction = Tables<'bank_transactions'>;

// Safe bank account type without sensitive data
type SafeBankAccount = {
  id: string;
  account_id: string;
  provider_name: string;
  account_type: string;
  currency: string;
  balance: number | null;
  available_balance: number | null;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
};

interface FinanceItem {
  [key: string]: any;
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const BusinessFinanceAssistant = () => {
  const { user } = useAuth();
  // Account currency: '' when not set, and then amounts print as plain numbers (never "$").
  const accountCurrency = useAccountCurrency();
  const { organization } = useActiveOrganization();
  const navigate = useNavigate();
  const { templateFor } = useDocumentTemplates();
  const [isLoading, setIsLoading] = useState(false);
  type FinanceTab = 'dashboard' | 'create' | 'quotes' | 'invoices' | 'products' | 'suppliers' | 'expenses' | 'outgoings' | 'banking' | 'payroll' | 'reports' | 'analytics' | 'templates';
  const FINANCE_TABS: FinanceTab[] = ['dashboard', 'create', 'quotes', 'invoices', 'products', 'suppliers', 'expenses', 'outgoings', 'banking', 'payroll', 'reports', 'analytics', 'templates'];
  const location = useLocation();
  const tabFromUrl = (): FinanceTab => {
    const t = new URLSearchParams(location.search).get('tab') as FinanceTab | null;
    return t && FINANCE_TABS.includes(t) ? t : 'dashboard';
  };
  const [activeTab, setActiveTab] = useState<FinanceTab>(tabFromUrl);
  // ?type=invoice|quote preselects the Create tab's document type ("New invoice" / "New quote").
  const typeFromUrl = (): 'invoice' | 'quote' | null => {
    const t = new URLSearchParams(location.search).get('type');
    return t === 'invoice' || t === 'quote' ? t : null;
  };
  useEffect(() => {
    setActiveTab(tabFromUrl());
    const t = typeFromUrl();
    if (t) { setDocumentType(t); setEditingDocument(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.key]);
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>(() => typeFromUrl() ?? 'quote');
  const [editingDocument, setEditingDocument] = useState<Quote | Invoice | null>(null);
  const [showDocumentList, setShowDocumentList] = useState(false);
  const [sendingDocument, setSendingDocument] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [outgoings, setOutgoings] = useState<Outgoing[]>([]);
  const [bankAccounts, setBankAccounts] = useState<SafeBankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Quote | Invoice | null>(null);
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false);
  const [docsError, setDocsError] = useState(false);
  
  // Load failures per money-out table, shown as an error card with Retry (not an empty list).
  const [moneyOutError, setMoneyOutError] = useState<Record<'products' | 'suppliers' | 'expenses' | 'outgoings', boolean>>({ products: false, suppliers: false, expenses: false, outgoings: false });
  const setLoadError = (k: keyof typeof moneyOutError, failed: boolean) => setMoneyOutError((e) => (e[k] === failed ? e : { ...e, [k]: failed }));

  // Sample import formats for banking
  const importFormats = [
    { id: 'csv', name: 'CSV', description: 'Comma Separated Values', icon: '📄' },
    { id: 'ofx', name: 'OFX', description: 'Open Financial Exchange', icon: '💱' },
    { id: 'qif', name: 'QIF', description: 'Quicken Interchange Format', icon: '📁' },
    { id: 'pdf', name: 'PDF', description: 'Bank statement PDF', icon: '📄' }
  ];

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAccountForUpload, setSelectedAccountForUpload] = useState<string>('');

  // Load bank accounts function - using secure function
  const loadBankAccounts = async () => {
    if (!user) return;
    
    const { data: accounts, error } = await supabase
      .rpc('get_bank_accounts_safe', { p_user_id: user.id });

    if (!error && accounts) {
      setBankAccounts(accounts);
    }
  };

  // Load bank transactions function
  const loadBankTransactions = async () => {
    if (!user) return;
    
    const { data: transactions, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(50);

    if (!error && transactions) {
      setBankTransactions(transactions);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setDocsError(false);
      await Promise.all([
        loadQuotes(),
        loadInvoices(),
        loadProducts(),
        loadSuppliers(),
        loadExpenses(),
        loadOutgoings(),
        loadBankAccounts(),
        loadBankTransactions()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuotes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading quotes:', error);
      setDocsError(true);
    } else {
      setQuotes(data || []);
    }
  };

  const loadInvoices = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading invoices:', error);
      setDocsError(true);
    } else {
      setInvoices(data || []);
    }
  };

  const loadProducts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('products_services')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading products:', error);
      setLoadError('products', true);
    } else {
      setLoadError('products', false);
      setProducts(data || []);
    }
  };

  const loadSuppliers = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading suppliers:', error);
      setLoadError('suppliers', true);
    } else {
      setLoadError('suppliers', false);
      setSuppliers(data || []);
    }
  };

  const loadExpenses = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading expenses:', error);
      setLoadError('expenses', true);
    } else {
      setLoadError('expenses', false);
      setExpenses(data || []);
    }
  };

  const loadOutgoings = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('outgoings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading outgoings:', error);
      setLoadError('outgoings', true);
    } else {
      setLoadError('outgoings', false);
      setOutgoings(data || []);
    }
  };

  // Download functions
  const downloadCatalog = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Category,Price,Cost,Stock,Status\n" +
      products.map(p => `${p.name},${p.category},${p.price},${p.cost || 0},${p.stock_quantity || 'N/A'}` + (p.is_active ? ',Active' : ',Inactive')).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "product_catalog.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Product catalog downloaded");
  };

  const downloadSuppliers = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Contact Person,Email,Phone,Payment Terms,Status\n" +
      suppliers.map(s => `${s.name},${s.contact_person || ''},${s.email || ''},${s.phone || ''},${s.payment_terms},${s.is_active ? 'Active' : 'Inactive'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "suppliers_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Suppliers list downloaded");
  };

  const downloadExpenses = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Description,Category,Amount,Supplier,Status\n" +
      expenses.map(e => `${e.date},${e.description},${e.category},${e.amount},${e.supplier_id || ''},${e.status}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Expenses report downloaded");
  };

  const downloadOutgoings = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Category,Amount,Frequency,Next Payment,Status\n" +
      outgoings.map(o => `${o.name},${o.category},${o.amount},${o.frequency},${o.next_payment_date},${o.is_active ? 'Active' : 'Inactive'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "outgoings_schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Outgoings schedule downloaded");
  };

  // Generate PDF document from quote/invoice data using the user's default template
  const generatePDF = async (doc: Quote | Invoice) => {
    const docType: 'quote' | 'invoice' = 'quote_number' in doc ? 'quote' : 'invoice';
    const number = 'quote_number' in doc ? doc.quote_number : (doc as Invoice).invoice_number;

    return renderDocumentPdf(
      {
        type: docType,
        number,
        created_at: doc.created_at,
        status: doc.status,
        valid_until: 'valid_until' in doc ? (doc as Quote).valid_until : null,
        due_date: 'due_date' in doc ? (doc as Invoice).due_date : null,
        company_name: doc.company_name,
        company_address: doc.company_address,
        client_name: doc.client_name,
        client_email: doc.client_email,
        client_address: doc.client_address,
        items: doc.items,
        subtotal: Number(doc.subtotal) || 0,
        tax_rate: Number(doc.tax_rate) || 0,
        tax_amount: Number(doc.tax_amount) || 0,
        total_amount: Number(doc.total_amount) || 0,
        notes: doc.notes,
      },
      templateFor(docType),
      // The document's own currency; the PDF code is unchanged and treats a missing one as before.
      doc.currency || accountCurrency || undefined,
    );
  };

  // Handle document view
  // The preview opens from rows, cards and lists (no DialogTrigger), so focus is handed back by hand on close.
  const viewOpener = useRef<HTMLElement | null>(null);
  const handleViewDocument = (doc: Quote | Invoice) => {
    viewOpener.current = document.activeElement as HTMLElement | null;
    setSelectedDocument(doc);
    setIsDocumentViewOpen(true);
  };

  // Handle document edit
  const handleEditDocument = (doc: Quote | Invoice) => {
    setEditingDocument(doc);
    setDocumentType('quote_number' in doc ? 'quote' : 'invoice');
    setActiveTab('create');
  };

  // "New invoice" / "New quote": the existing Create tab with the type preselected (URL stays shareable).
  const startNew = (type: 'invoice' | 'quote') => {
    setEditingDocument(null);
    setDocumentType(type);
    setActiveTab('create');
    const params = new URLSearchParams(location.search);
    params.set('tab', 'create');
    params.set('type', type);
    navigate({ search: params.toString() });
  };
  const numberOf = (doc: { id: string }) => {
    const d = doc as Quote | Invoice;
    return ('quote_number' in d ? d.quote_number : d.invoice_number) || '—';
  };

  const handleSendDocument = async (doc: Quote | Invoice, type: 'quote' | 'invoice') => {
    setSendingDocument(doc.id);
    try {
      const docType = 'quote_number' in doc ? 'quote' : 'invoice';
      const number = 'quote_number' in doc ? doc.quote_number : doc.invoice_number;
      
      // Simulate sending delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`${docType.charAt(0).toUpperCase() + docType.slice(1)} ${number} sent successfully`);
    } catch (error) {
      toast.error('Failed to send document');
    } finally {
      setSendingDocument(null);
    }
  };

  const handleDocumentSaved = () => {
    setEditingDocument(null);
    fetchData();
    toast.success('Document saved successfully');
  };

  const handleDownloadDocument = async (doc: Quote | Invoice) => {
    try {
      const docType = 'quote_number' in doc ? 'quote' : 'invoice';
      const number = 'quote_number' in doc ? doc.quote_number : doc.invoice_number;
      
      const pdf = await generatePDF(doc);
      pdf.save(`${docType}_${number}.pdf`);
      
      toast.success(`${docType.charAt(0).toUpperCase() + docType.slice(1)} ${number} downloaded as PDF`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // CSV export helper
  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success(`${filename} exported successfully`);
  };

  // Money-out writes: every update and delete is filtered by id and the signed-in user (src/lib/moneyOutApi.ts).
  const moneyOut = (table: MoneyOutTable) => moneyOutApi(supabase as unknown as Parameters<typeof moneyOutApi>[0], user?.id ?? '', table);
  const moneyOutState = (k: keyof typeof moneyOutError, reload: () => Promise<void>) => ({ loading: isLoading, error: moneyOutError[k], onRetry: () => { void reload(); } });

  const TAB_GROUPS: { label: string; tabs: { value: FinanceTab; label: string }[] }[] = [
    { label: 'Overview', tabs: [{ value: 'dashboard', label: 'Overview' }, { value: 'create', label: 'Create' }] },
    { label: 'Sales', tabs: [{ value: 'quotes', label: 'Quotes' }, { value: 'invoices', label: 'Invoices' }, { value: 'templates', label: 'Templates' }] },
    { label: 'Money out', tabs: [{ value: 'expenses', label: 'Expenses' }, { value: 'outgoings', label: 'Outgoings' }, { value: 'suppliers', label: 'Suppliers' }, { value: 'products', label: 'Products' }] },
    { label: 'Banking and payroll', tabs: [{ value: 'banking', label: 'Banking' }, { value: 'payroll', label: 'Payroll (UK)' }] },
    { label: 'Insight', tabs: [{ value: 'reports', label: 'Reports' }, { value: 'analytics', label: 'Analytics' }] },
  ];
  const tabClass = 'min-h-touch shrink-0 rounded-none border-b-[3px] border-transparent px-3 pb-2 pt-2 text-body font-semibold text-brand-navy-muted shadow-none hover:text-white focus-visible:ring-[3px] focus-visible:ring-offset-0 data-[state=active]:border-nav-marker data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none';
  const docState = { loading: isLoading, error: docsError, onRetry: fetchData };

  // Tabs wraps the band, so the tab list on the band controls the panels below it.
  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceTab)} className="min-w-0">
      <div className="bg-brand-navy text-brand-navy-foreground">
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-small text-brand-navy-muted">
              <li><Link to="/dashboard" className="inline-flex min-h-touch items-center rounded-sm underline-offset-2 md:min-h-0 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{organization?.name || 'Company'}</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link to="/business-tools" className="inline-flex min-h-touch items-center rounded-sm underline-offset-2 md:min-h-0 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">Business tools</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white">Invoices &amp; quotes</li>
            </ol>
          </nav>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="text-page-title text-white">Invoices &amp; quotes</h1>
              <p className="mt-1 text-body text-brand-navy-muted">Create quotes and invoices, see what is owed, and track money in and out.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-touch focus-visible:ring-offset-brand-navy" onClick={() => startNew('invoice')}>
                <Plus className="h-4 w-4" aria-hidden="true" />New invoice
              </Button>
              <Button variant="outline" className="min-h-touch border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:ring-offset-brand-navy" onClick={() => startNew('quote')}>
                <Plus className="h-4 w-4" aria-hidden="true" />New quote
              </Button>
            </div>
          </div>
          <TabsList aria-label="Invoices and quotes sections" className="mt-4 flex h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 text-brand-navy-muted">
            {TAB_GROUPS.map((g, gi) => (
              <React.Fragment key={g.label}>
                {gi > 0 && <span aria-hidden="true" className="mx-2 h-5 w-px shrink-0 self-center bg-white/25" />}
                {g.tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className={tabClass}>{t.label}</TabsTrigger>
                ))}
              </React.Fragment>
            ))}
          </TabsList>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {isLoading && !['dashboard', 'quotes', 'invoices', 'analytics', 'reports', 'products', 'suppliers', 'expenses', 'outgoings'].includes(activeTab) ? (
          <div className="flex min-h-[300px] items-center justify-center" role="status" aria-label="Loading">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true" />
          </div>
        ) : (<>

        <TabsContent value="dashboard" className="mt-0">
          <FinanceOverview quotes={quotes} invoices={invoices} expenses={expenses} {...docState}
            numberOf={numberOf} onOpen={handleViewDocument} onNew={startNew} onOpenTab={setActiveTab} />
        </TabsContent>

        <TabsContent value="create" className="mt-0">
          {!editingDocument && (
            <div role="group" aria-label="Document type" className="mb-6 flex flex-wrap gap-2">
              <Button className="min-h-touch md:min-h-0" aria-pressed={documentType === 'quote'}
                variant={documentType === 'quote' ? 'default' : 'outline'}
                onClick={() => setDocumentType('quote')}
              >
                Create Quote
              </Button>
              <Button className="min-h-touch md:min-h-0" aria-pressed={documentType === 'invoice'}
                variant={documentType === 'invoice' ? 'default' : 'outline'}
                onClick={() => setDocumentType('invoice')}
              >
                Create Invoice
              </Button>
            </div>
          )}
          
          <QuoteInvoiceCreationSection 
            documentType={documentType}
            onDocumentSaved={handleDocumentSaved}
            editingDocument={editingDocument}
            onEditComplete={() => setEditingDocument(null)}
            onCancelEdit={() => setEditingDocument(null)}
          />
        </TabsContent>

        <TabsContent value="quotes" className="mt-0">
          <DocumentsTable kind="quote" docs={quotes} numberOf={numberOf} {...docState} onNew={() => startNew('quote')}
            onView={handleViewDocument} onEdit={handleEditDocument} onDownload={handleDownloadDocument}
            onSend={(d: Quote) => handleSendDocument(d, 'quote')} sendingId={sendingDocument} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-0">
          <DocumentsTable kind="invoice" docs={invoices} numberOf={numberOf} {...docState} onNew={() => startNew('invoice')}
            onView={handleViewDocument} onEdit={handleEditDocument} onDownload={handleDownloadDocument}
            onSend={(d: Invoice) => handleSendDocument(d, 'invoice')} sendingId={sendingDocument} />
        </TabsContent>

        <TabsContent value="products" className="mt-0">
          <ProductsTab rows={products} {...moneyOutState('products', loadProducts)} api={moneyOut('products_services')} onChanged={() => { void loadProducts(); }} onDownload={downloadCatalog} />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-0">
          <SuppliersTab rows={suppliers} {...moneyOutState('suppliers', loadSuppliers)} api={moneyOut('suppliers')} onChanged={() => { void loadSuppliers(); }} onDownload={downloadSuppliers} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-0">
          <ExpensesTab rows={expenses} suppliers={suppliers} {...moneyOutState('expenses', loadExpenses)} api={moneyOut('expenses')} onChanged={() => { void loadExpenses(); }} onDownload={downloadExpenses} />
        </TabsContent>

        <TabsContent value="outgoings" className="mt-0">
          <OutgoingsTab rows={outgoings} suppliers={suppliers} {...moneyOutState('outgoings', loadOutgoings)} api={moneyOut('outgoings')} onChanged={() => { void loadOutgoings(); }} onDownload={downloadOutgoings} />
        </TabsContent>

        <TabsContent value="banking" className="mt-0">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Bank Accounts</CardTitle>
                <CardDescription>View and manage your connected bank accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bankAccounts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No bank accounts connected. Connect your first account to get started.</p>
                  ) : (
                    bankAccounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{account.provider_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {account.account_type.toUpperCase()} • {account.account_id} • {account.currency}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(Number(account.balance), account.currency)}</p>
                          <p className="text-xs text-muted-foreground">
                            Last synced: {account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest banking transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bankTransactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No transactions found.</p>
                  ) : (
                    bankTransactions.slice(0, 10).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{transaction.description}</h3>
                          <p className="text-sm text-muted-foreground">
                            {transaction.category} • {new Date(transaction.transaction_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${transaction.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(Number(transaction.amount), transaction.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: {formatCurrency(Number(transaction.balance_after), transaction.currency)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <FinanceReports quotes={quotes} invoices={invoices} expenses={expenses} {...docState} />
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <DocumentTemplatePicker currency={accountCurrency || undefined} />
        </TabsContent>

        <TabsContent value="payroll" className="mt-0">
          <PayrollUK />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <FinanceAnalytics invoices={invoices} {...docState} onNewInvoice={() => startNew('invoice')} />
        </TabsContent>
        </>)}
      </div>

      {/* Document Preview Modal */}
      <Dialog open={isDocumentViewOpen} onOpenChange={setIsDocumentViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(e) => { if (viewOpener.current?.isConnected) { e.preventDefault(); viewOpener.current.focus(); } }}>
          <DialogHeader>
            <DialogTitle>
              {selectedDocument && 'quote_number' in selectedDocument 
                ? `Quote ${selectedDocument.quote_number}`
                : selectedDocument && 'invoice_number' in selectedDocument 
                ? `Invoice ${selectedDocument.invoice_number}`
                : 'Document Preview'
              }
            </DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-6 p-4">
              {/* Document Header */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">From:</h3>
                  {selectedDocument.company_name && <p className="font-medium">{selectedDocument.company_name}</p>}
                  {selectedDocument.company_address && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedDocument.company_address}</p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold mb-2">To:</h3>
                  {selectedDocument.client_name && <p className="font-medium">{selectedDocument.client_name}</p>}
                  {selectedDocument.client_email && <p className="text-sm">{selectedDocument.client_email}</p>}
                  {selectedDocument.client_address && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedDocument.client_address}</p>
                  )}
                </div>
              </div>

              {/* Document Details */}
              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {'quote_number' in selectedDocument ? 'Quote #' : 'Invoice #'}
                  </p>
                  <p className="font-medium">
                    {'quote_number' in selectedDocument ? selectedDocument.quote_number : selectedDocument.invoice_number}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(selectedDocument.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {'quote_number' in selectedDocument ? <QuoteStatusChip doc={selectedDocument} /> : <InvoiceStatusChip doc={selectedDocument} />}
                </div>
              </div>

              {/* Due Date / Valid Until */}
              {'due_date' in selectedDocument && selectedDocument.due_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(selectedDocument.due_date).toLocaleDateString()}</p>
                </div>
              )}
              {'valid_until' in selectedDocument && selectedDocument.valid_until && (
                <div>
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{new Date(selectedDocument.valid_until).toLocaleDateString()}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Rate</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDocument.items && Array.isArray(selectedDocument.items) ? (
                        selectedDocument.items.map((item: any, index: number) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">{item.description || 'N/A'}</td>
                            <td className="text-right p-2">{item.quantity || 0}</td>
                            <td className="text-right p-2">{formatMoney(Number(item.rate) || 0, selectedDocument.currency, { cents: true })}</td>
                            <td className="text-right p-2">{formatMoney(Number(item.amount) || 0, selectedDocument.currency, { cents: true })}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center p-4 text-muted-foreground">No items found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatMoney(Number(selectedDocument.subtotal) || 0, selectedDocument.currency, { cents: true })}</span>
                    </div>
                    {selectedDocument.tax_rate && Number(selectedDocument.tax_rate) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({selectedDocument.tax_rate}%):</span>
                        <span>{formatMoney(Number(selectedDocument.tax_amount) || 0, selectedDocument.currency, { cents: true })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatMoney(Number(selectedDocument.total_amount) || 0, selectedDocument.currency, { cents: true })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedDocument.notes && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedDocument.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleDownloadDocument(selectedDocument)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={() => handleSendDocument(selectedDocument, 'quote_number' in selectedDocument ? 'quote' : 'invoice')}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};

export default BusinessFinanceAssistant;