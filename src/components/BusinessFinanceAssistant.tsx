import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Download, Eye, Send, FileText, DollarSign, TrendingUp, Users, Package, Truck, Receipt, CreditCard, BarChart3, PieChart, Home, Building, Calendar, ShoppingCart, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuoteInvoiceCreationSection from '@/components/QuoteInvoiceCreationSection';
import { formatCurrency } from '@/utils/currencyUtils';
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'quotes' | 'invoices' | 'products' | 'suppliers' | 'expenses' | 'outgoings' | 'banking' | 'reports' | 'analytics'>('dashboard');
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('quote');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [outgoings, setOutgoings] = useState<Outgoing[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Quote | Invoice | null>(null);
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false);

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

  // Load bank accounts function
  const loadBankAccounts = async () => {
    if (!user) return;
    
    const { data: accounts, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

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
    } else {
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
    } else {
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
    } else {
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
    } else {
      setOutgoings(data || []);
    }
  };

  // Calculate dashboard stats
  const getStats = () => {
    const activeQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent');
    const pendingInvoices = invoices.filter(i => i.status === 'pending');
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total_amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    return {
      activeQuotes: activeQuotes.length,
      pendingInvoices: pendingInvoices.length,
      totalRevenue,
      totalExpenses,
      totalProducts: products.length,
      totalSuppliers: suppliers.length
    };
  };

  const stats = getStats();

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

  // Generate PDF document from quote/invoice data
  const generatePDF = async (doc: Quote | Invoice) => {
    const docType = 'quote_number' in doc ? 'quote' : 'invoice';
    const number = 'quote_number' in doc ? doc.quote_number : doc.invoice_number;
    
    // Create PDF
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(24);
    pdf.text(docType.charAt(0).toUpperCase() + docType.slice(1), 20, 30);
    
    // Document info
    pdf.setFontSize(12);
    pdf.text(`${docType.charAt(0).toUpperCase() + docType.slice(1)} #: ${number}`, 20, 50);
    pdf.text(`Date: ${new Date(doc.created_at).toLocaleDateString()}`, 20, 60);
    pdf.text(`Status: ${doc.status}`, 20, 70);
    
    if ('valid_until' in doc && doc.valid_until) {
      pdf.text(`Valid Until: ${new Date(doc.valid_until).toLocaleDateString()}`, 20, 80);
    }
    if ('due_date' in doc && doc.due_date) {
      pdf.text(`Due Date: ${new Date(doc.due_date).toLocaleDateString()}`, 20, 80);
    }
    
    // Company info
    pdf.text('From:', 20, 100);
    if (doc.company_name) pdf.text(doc.company_name, 20, 110);
    if (doc.company_address) pdf.text(doc.company_address, 20, 120);
    
    // Client info
    pdf.text('To:', 20, 140);
    if (doc.client_name) pdf.text(doc.client_name, 20, 150);
    if (doc.client_email) pdf.text(doc.client_email, 20, 160);
    if (doc.client_address) pdf.text(doc.client_address, 20, 170);
    
    // Items table header
    pdf.text('Items:', 20, 190);
    pdf.text('Description', 20, 200);
    pdf.text('Qty', 100, 200);
    pdf.text('Rate', 130, 200);
    pdf.text('Amount', 160, 200);
    
    // Items
    let yPosition = 210;
    if (doc.items && Array.isArray(doc.items)) {
      doc.items.forEach((item: any) => {
        pdf.text(item.description || '', 20, yPosition);
        pdf.text(String(item.quantity || 0), 100, yPosition);
        pdf.text(formatCurrency(item.rate || 0), 130, yPosition);
        pdf.text(formatCurrency(item.amount || 0), 160, yPosition);
        yPosition += 10;
      });
    }
    
    // Totals
    yPosition += 10;
    pdf.text(`Subtotal: ${formatCurrency(Number(doc.subtotal) || 0)}`, 130, yPosition);
    if (doc.tax_rate && Number(doc.tax_rate) > 0) {
      yPosition += 10;
      pdf.text(`Tax (${doc.tax_rate}%): ${formatCurrency(Number(doc.tax_amount) || 0)}`, 130, yPosition);
    }
    yPosition += 10;
    pdf.setFontSize(14);
    pdf.text(`Total: ${formatCurrency(Number(doc.total_amount) || 0)}`, 130, yPosition);
    
    // Notes
    if (doc.notes) {
      yPosition += 20;
      pdf.setFontSize(12);
      pdf.text('Notes:', 20, yPosition);
      const notes = pdf.splitTextToSize(doc.notes, 170);
      pdf.text(notes, 20, yPosition + 10);
    }
    
    return pdf;
  };

  // Handle document view
  const handleViewDocument = (doc: Quote | Invoice) => {
    setSelectedDocument(doc);
    setIsDocumentViewOpen(true);
  };

  const handleSendDocument = (doc: Quote | Invoice) => {
    const docType = 'quote_number' in doc ? 'quote' : 'invoice';
    const number = 'quote_number' in doc ? doc.quote_number : doc.invoice_number;
    toast.success(`${docType.charAt(0).toUpperCase() + docType.slice(1)} ${number} sent successfully`);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Finance Assistant</h1>
          <p className="text-muted-foreground">Manage your quotes, invoices, and financial data</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-11">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create
          </TabsTrigger>
          <TabsTrigger value="quotes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quotes
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Suppliers
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="outgoings" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Outgoings
          </TabsTrigger>
          <TabsTrigger value="banking" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Banking
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab('quotes')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeQuotes}</div>
                <p className="text-xs text-muted-foreground">Pending responses</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab('invoices')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
                <p className="text-xs text-muted-foreground">Awaiting payment</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">From paid invoices</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalExpenses)}</div>
                <p className="text-xs text-muted-foreground">This period</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest financial activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quotes.slice(0, 3).map((quote) => (
                    <div key={quote.id} className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Quote {quote.quote_number}</p>
                        <p className="text-xs text-muted-foreground">Created {new Date(quote.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline">{quote.status}</Badge>
                    </div>
                  ))}
                  {invoices.slice(0, 2).map((invoice) => (
                    <div key={invoice.id} className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Invoice {invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">Created {new Date(invoice.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline">{invoice.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Overview of your business data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Products/Services</span>
                  <span className="font-medium">{stats.totalProducts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Suppliers</span>
                  <span className="font-medium">{stats.totalSuppliers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Profit Margin</span>
                  <span className="font-medium">
                    {stats.totalRevenue > 0 
                      ? `${(((stats.totalRevenue - stats.totalExpenses) / stats.totalRevenue) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Revenue vs Expenses</span>
                    <span>{stats.totalRevenue > stats.totalExpenses ? 'Profit' : 'Loss'}</span>
                  </div>
                  <Progress value={stats.totalRevenue > 0 ? (stats.totalExpenses / stats.totalRevenue) * 100 : 0} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Document</CardTitle>
              <CardDescription>Generate quotes and invoices for your clients</CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteInvoiceCreationSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
              <CardDescription>Manage your quotes and proposals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quotes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No quotes found. Create your first quote to get started.</p>
                ) : (
                  quotes.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">Quote {quote.quote_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {quote.client_name} • {formatCurrency(Number(quote.total_amount))} • {new Date(quote.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{quote.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleViewDocument(quote)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(quote)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => handleSendDocument(quote)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Track and manage your invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No invoices found. Create your first invoice to get started.</p>
                ) : (
                  invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">Invoice {invoice.invoice_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {invoice.client_name} • {formatCurrency(Number(invoice.total_amount))} • {new Date(invoice.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{invoice.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleViewDocument(invoice)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(invoice)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => handleSendDocument(invoice)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Products & Services</CardTitle>
                <CardDescription>Manage your product catalog and service offerings</CardDescription>
              </div>
              <Button onClick={downloadCatalog} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Catalog
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No products found. Add your first product to get started.</p>
                ) : (
                  products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {product.category} • {formatCurrency(Number(product.price))} • Stock: {product.stock_quantity || 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Suppliers</CardTitle>
                <CardDescription>Manage your supplier relationships and contacts</CardDescription>
              </div>
              <Button onClick={downloadSuppliers} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download List
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suppliers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No suppliers found. Add your first supplier to get started.</p>
                ) : (
                  suppliers.map((supplier) => (
                    <div key={supplier.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {supplier.contact_person} • {supplier.email} • {supplier.payment_terms}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={supplier.is_active ? "default" : "secondary"}>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>Track and categorize your business expenses</CardDescription>
              </div>
              <Button onClick={downloadExpenses} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expenses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No expenses found. Add your first expense to get started.</p>
                ) : (
                  expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{expense.description}</h3>
                        <p className="text-sm text-muted-foreground">
                          {expense.category} • {formatCurrency(Number(expense.amount))} • {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{expense.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outgoings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recurring Outgoings</CardTitle>
                <CardDescription>Manage your scheduled payments and subscriptions</CardDescription>
              </div>
              <Button onClick={downloadOutgoings} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Schedule
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {outgoings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No outgoings found. Add your first recurring payment to get started.</p>
                ) : (
                  outgoings.map((outgoing) => (
                    <div key={outgoing.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium">{outgoing.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {outgoing.category} • {formatCurrency(Number(outgoing.amount))} • {outgoing.frequency} • Next: {new Date(outgoing.next_payment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={outgoing.is_active ? "default" : "secondary"}>
                          {outgoing.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking">
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
                            {account.account_type.toUpperCase()} • ****{account.account_number?.slice(-4)} • {account.currency}
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

        <TabsContent value="reports">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
                <CardDescription>Overview of your financial performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Revenue</span>
                  <span className="font-medium text-green-600">{formatCurrency(stats.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Expenses</span>
                  <span className="font-medium text-red-600">{formatCurrency(stats.totalExpenses)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-medium">Net Profit</span>
                  <span className={`font-bold ${stats.totalRevenue - stats.totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(stats.totalRevenue - stats.totalExpenses)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Document Status</CardTitle>
                <CardDescription>Status breakdown of your documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Draft Quotes</span>
                  <span className="font-medium">{quotes.filter(q => q.status === 'draft').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sent Quotes</span>
                  <span className="font-medium">{quotes.filter(q => q.status === 'sent').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Invoices</span>
                  <span className="font-medium">{invoices.filter(i => i.status === 'pending').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Invoices</span>
                  <span className="font-medium text-green-600">{invoices.filter(i => i.status === 'paid').length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Analytics</CardTitle>
                <CardDescription>Insights into your business performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Analytics Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Advanced analytics and reporting features will be available soon.
                    Connect your bank accounts and add more data to get detailed insights.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Document Preview Modal */}
      <Dialog open={isDocumentViewOpen} onOpenChange={setIsDocumentViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  <Badge variant="outline">{selectedDocument.status}</Badge>
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
                            <td className="text-right p-2">{formatCurrency(item.rate || 0)}</td>
                            <td className="text-right p-2">{formatCurrency(item.amount || 0)}</td>
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
                      <span>{formatCurrency(Number(selectedDocument.subtotal) || 0)}</span>
                    </div>
                    {selectedDocument.tax_rate && Number(selectedDocument.tax_rate) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({selectedDocument.tax_rate}%):</span>
                        <span>{formatCurrency(Number(selectedDocument.tax_amount) || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(Number(selectedDocument.total_amount) || 0)}</span>
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
                <Button onClick={() => handleSendDocument(selectedDocument)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessFinanceAssistant;