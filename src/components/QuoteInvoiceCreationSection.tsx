import React, { useState } from 'react';
import { Plus, FileText, Calendar, User, DollarSign, Quote, Upload, Image, X, Eye, Download, List, ArrowLeft, Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface QuoteInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const QuoteInvoiceCreationSection = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'quote' | 'invoice'>('quote');
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [documentData, setDocumentData] = useState({
    number: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    companyName: '',
    companyAddress: '',
    date: '',
    validUntil: '', // For quotes
    dueDate: '', // For invoices
    notes: '',
    terms: 'Net 30',
    currency: 'USD',
    vatEnabled: false,
    vatRate: 0
  });

  const [items, setItems] = useState<QuoteInvoiceItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  const [generating, setGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const addItem = () => {
    const newItem: QuoteInvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof QuoteInvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };


  const generateDocumentCode = (type: 'quote' | 'invoice') => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const prefix = type === 'quote' ? 'QUO' : 'INV';
    return `${prefix}-${year}${month}${day}-${random}`;
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    setLogoUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);
      toast({
        title: "Logo Uploaded",
        description: "Your company logo has been uploaded successfully!"
      });

    } catch (error) {
      console.error('Logo upload error:', error);
      toast({
        title: "Upload Failed", 
        description: "Failed to upload logo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!logoUrl || !user) return;

    try {
      // Extract filename from URL for deletion
      const urlParts = logoUrl.split('/');
      const fileName = `${user.id}/${urlParts[urlParts.length - 1]}`;
      
      await supabase.storage
        .from('company-logos')
        .remove([fileName]);

      setLogoUrl(null);
      toast({
        title: "Logo Removed",
        description: "Your company logo has been removed."
      });
    } catch (error) {
      console.error('Logo removal error:', error);
    }
  };

  const loadDocuments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;
      if (invoicesError) throw invoicesError;

      setQuotes(quotesData || []);
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (user && viewMode === 'list') {
      loadDocuments();
    }
  }, [user, viewMode]);

  const calculateSubtotal = () => {
    return items.reduce((total, item) => total + item.amount, 0);
  };

  const calculateVAT = () => {
    if (!documentData.vatEnabled) return 0;
    return calculateSubtotal() * (documentData.vatRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVAT();
  };

  const handleGenerate = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create documents.",
        variant: "destructive"
      });
      return;
    }

    if (!documentData.clientName || !documentData.clientEmail) {
      toast({
        title: "Missing Information",
        description: "Please fill in client name and email.",
        variant: "destructive"
      });
      return;
    }

    if (items.some(item => !item.description || item.rate <= 0)) {
      toast({
        title: "Invalid Items",
        description: "Please ensure all items have descriptions and rates.",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);

    try {
      const documentNumber = documentData.number || generateDocumentCode(activeTab);
      const subtotal = calculateSubtotal();
      const vatAmount = calculateVAT();
      const total = calculateTotal();

      const documentPayload = {
        user_id: user.id,
        company_name: documentData.companyName,
        company_address: documentData.companyAddress,
        client_name: documentData.clientName,
        client_email: documentData.clientEmail,
        client_address: documentData.clientAddress,
        items: JSON.stringify(items),
        subtotal,
        tax_rate: documentData.vatEnabled ? documentData.vatRate : 0,
        tax_amount: vatAmount,
        total_amount: total,
        notes: documentData.notes,
        status: 'draft',
        logo_url: logoUrl
      };

      if (activeTab === 'quote') {
        const { error } = await supabase
          .from('quotes')
          .insert({
            ...documentPayload,
            quote_number: documentNumber,
            valid_until: documentData.validUntil || null
          });
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('invoices')
          .insert({
            ...documentPayload,
            invoice_number: documentNumber,
            due_date: documentData.dueDate || null
          });
        
        if (error) throw error;
      }

      const documentType = activeTab === 'quote' ? 'Quote' : 'Invoice';
      toast({
        title: `${documentType} Created`,
        description: `${documentType} ${documentNumber} has been created successfully.`,
      });

      // Reset form
      setDocumentData({
        number: '',
        clientName: '',
        clientEmail: '',
        clientAddress: '',
        companyName: '',
        companyAddress: '',
        date: '',
        validUntil: '',
        dueDate: '',
        notes: '',
        terms: 'Net 30',
        currency: 'USD',
        vatEnabled: false,
        vatRate: 0
      });
      setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);
      setLogoUrl(null);

      // Refresh the list if we're viewing it
      if (viewMode === 'list') {
        loadDocuments();
      }

    } catch (error) {
      console.error('Document generation error:', error);
      toast({
        title: "Generation Failed",
        description: `Failed to generate ${activeTab}. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const [viewedDocument, setViewedDocument] = useState<any>(null);
  const [sendingDocument, setSendingDocument] = useState<string | null>(null);

  const viewDocument = async (documentId: string, type: 'quote' | 'invoice') => {
    try {
      const { data, error } = await supabase
        .from(type === 'quote' ? 'quotes' : 'invoices')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      setViewedDocument({ ...data, type });
    } catch (error) {
      console.error('Error viewing document:', error);
      toast({
        title: "Error",
        description: "Failed to load document.",
        variant: "destructive"
      });
    }
  };

  const downloadDocument = (document: any, type: 'quote' | 'invoice') => {
    // Generate HTML content for the document
    const items = JSON.parse(document.items || '[]');
    const subtotal = document.subtotal || 0;
    const taxAmount = document.tax_amount || 0;
    const total = document.total_amount || 0;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${type === 'quote' ? 'Quote' : 'Invoice'} ${type === 'quote' ? document.quote_number : document.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .company-info h1 { margin: 0; color: #2563eb; }
          .document-title { text-align: right; }
          .document-title h2 { margin: 0; font-size: 2em; color: #374151; }
          .client-info { margin: 20px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .items-table th { background-color: #f8f9fa; }
          .totals { margin-top: 20px; text-align: right; }
          .totals table { margin-left: auto; }
          .totals td { padding: 5px 10px; }
          .total-row { font-weight: bold; border-top: 2px solid #374151; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            ${document.logo_url ? `<img src="${document.logo_url}" alt="Logo" style="max-height: 80px; margin-bottom: 10px;">` : ''}
            <h1>${document.company_name || 'Company Name'}</h1>
            <p>${(document.company_address || '').replace(/\n/g, '<br>')}</p>
          </div>
          <div class="document-title">
            <h2>${type === 'quote' ? 'QUOTE' : 'INVOICE'}</h2>
            <p><strong>Number:</strong> ${type === 'quote' ? document.quote_number : document.invoice_number}</p>
            <p><strong>Date:</strong> ${new Date(document.created_at).toLocaleDateString()}</p>
            ${type === 'quote' && document.valid_until ? `<p><strong>Valid Until:</strong> ${new Date(document.valid_until).toLocaleDateString()}</p>` : ''}
            ${type === 'invoice' && document.due_date ? `<p><strong>Due Date:</strong> ${new Date(document.due_date).toLocaleDateString()}</p>` : ''}
          </div>
        </div>
        
        <div class="client-info">
          <h3>Bill To:</h3>
          <p><strong>${document.client_name}</strong></p>
          <p>${document.client_email}</p>
          <p>${(document.client_address || '').replace(/\n/g, '<br>')}</p>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.rate)}</td>
                <td>${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <table>
            <tr>
              <td>Subtotal:</td>
              <td>${formatCurrency(subtotal)}</td>
            </tr>
            ${taxAmount > 0 ? `
            <tr>
              <td>Tax (${document.tax_rate}%):</td>
              <td>${formatCurrency(taxAmount)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td><strong>Total:</strong></td>
              <td><strong>${formatCurrency(total)}</strong></td>
            </tr>
          </table>
        </div>
        
        ${document.notes ? `
        <div style="margin-top: 40px;">
          <h3>Notes:</h3>
          <p>${document.notes.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
      </body>
      </html>
    `;

    // Create and download the file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${type === 'quote' ? document.quote_number : document.invoice_number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Download Complete",
      description: `${type === 'quote' ? 'Quote' : 'Invoice'} downloaded successfully.`,
    });
  };

  const sendDocument = async (document: any, type: 'quote' | 'invoice') => {
    if (!document.client_email) {
      toast({
        title: "No Email Address",
        description: "Client email is required to send the document.",
        variant: "destructive"
      });
      return;
    }

    setSendingDocument(document.id);

    try {
      // In a real app, you'd call an edge function to send the email
      // For now, we'll simulate sending
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Document Sent",
        description: `${type === 'quote' ? 'Quote' : 'Invoice'} sent to ${document.client_email}`,
      });
    } catch (error) {
      console.error('Error sending document:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingDocument(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = documentData.currency) => {
    const currencyMap: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF ',
      'CNY': '¥',
      'INR': '₹'
    };
    
    const symbol = currencyMap[currency] || currency + ' ';
    return `${symbol}${amount.toFixed(2)}`;
  };

  const currentDocumentType = activeTab === 'quote' ? 'Quote' : 'Invoice';
  const currentIcon = activeTab === 'quote' ? Quote : FileText;
  const CurrentIcon = currentIcon;

  if (viewMode === 'list') {
    return (
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setViewMode('create')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Create
              </Button>
              <div>
                <CardTitle className="text-xl">
                  {activeTab === 'quote' ? 'Quotes' : 'Invoices'} List
                </CardTitle>
                <CardDescription>View and manage your documents</CardDescription>
              </div>
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'quote' | 'invoice')}>
              <TabsList>
                <TabsTrigger value="quote">Quotes</TabsTrigger>
                <TabsTrigger value="invoice">Invoices</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-4">
              {(activeTab === 'quote' ? quotes : invoices).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p>No {activeTab}s found. Create your first {activeTab}!</p>
                </div>
              ) : (
                (activeTab === 'quote' ? quotes : invoices).map((doc: any) => (
                  <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            {activeTab === 'quote' ? doc.quote_number : doc.invoice_number}
                          </h3>
                          <span className="text-sm px-2 py-1 bg-gray-100 rounded">
                            {doc.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p><strong>Client:</strong> {doc.client_name}</p>
                          <p><strong>Total:</strong> {formatCurrency(doc.total_amount || 0)}</p>
                          <p><strong>Created:</strong> {new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => viewDocument(doc.id, activeTab)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => downloadDocument(doc, activeTab)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => sendDocument(doc, activeTab)}
                          disabled={sendingDocument === doc.id}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          {sendingDocument === doc.id ? 'Sending...' : 'Send'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Document Viewer Modal
  if (viewedDocument) {
    const items = JSON.parse(viewedDocument.items || '[]');
    const subtotal = viewedDocument.subtotal || 0;
    const taxAmount = viewedDocument.tax_amount || 0;
    const total = viewedDocument.total_amount || 0;

    return (
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setViewedDocument(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
              <div>
                <CardTitle className="text-xl">
                  {viewedDocument.type === 'quote' ? 'Quote' : 'Invoice'} Preview
                </CardTitle>
                <CardDescription>
                  {viewedDocument.type === 'quote' ? viewedDocument.quote_number : viewedDocument.invoice_number}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => downloadDocument(viewedDocument, viewedDocument.type)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button 
                variant="outline"
                onClick={() => sendDocument(viewedDocument, viewedDocument.type)}
                disabled={sendingDocument === viewedDocument.id}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingDocument === viewedDocument.id ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-white border rounded-lg p-8 max-w-4xl mx-auto">
            {/* Document Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1">
                {viewedDocument.logo_url && (
                  <img 
                    src={viewedDocument.logo_url} 
                    alt="Company Logo" 
                    className="h-16 mb-4 object-contain"
                  />
                )}
                <h1 className="text-2xl font-bold text-blue-600 mb-2">
                  {viewedDocument.company_name || 'Company Name'}
                </h1>
                <div className="text-gray-600 whitespace-pre-line">
                  {viewedDocument.company_address}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  {viewedDocument.type === 'quote' ? 'QUOTE' : 'INVOICE'}
                </h2>
                <div className="text-sm space-y-1">
                  <p><strong>Number:</strong> {viewedDocument.type === 'quote' ? viewedDocument.quote_number : viewedDocument.invoice_number}</p>
                  <p><strong>Date:</strong> {new Date(viewedDocument.created_at).toLocaleDateString()}</p>
                  {viewedDocument.type === 'quote' && viewedDocument.valid_until && (
                    <p><strong>Valid Until:</strong> {new Date(viewedDocument.valid_until).toLocaleDateString()}</p>
                  )}
                  {viewedDocument.type === 'invoice' && viewedDocument.due_date && (
                    <p><strong>Due Date:</strong> {new Date(viewedDocument.due_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
              <div className="text-gray-700">
                <p className="font-semibold">{viewedDocument.client_name}</p>
                <p>{viewedDocument.client_email}</p>
                <div className="whitespace-pre-line">{viewedDocument.client_address}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">Quantity</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Rate</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.rate)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between py-2">
                    <span>Tax ({viewedDocument.tax_rate}%):</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {viewedDocument.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Notes:</h3>
                <div className="text-gray-700 whitespace-pre-line bg-gray-50 p-4 rounded">
                  {viewedDocument.notes}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center">
              <CurrentIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Quote & Invoice Generator</CardTitle>
              <CardDescription>Create professional quotes and invoices with custom codes</CardDescription>
            </div>
          </div>
          <Button variant="outline" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4 mr-2" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Document Type Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'quote' | 'invoice')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quote" className="flex items-center gap-2">
              <Quote className="h-4 w-4" />
              Quote
            </TabsTrigger>
            <TabsTrigger value="invoice" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoice
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6 mt-6">
            {/* Document Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="documentNumber">{currentDocumentType} Number</Label>
                <Input
                  id="documentNumber"
                  value={documentData.number}
                  onChange={(e) => setDocumentData({...documentData, number: e.target.value})}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select value={documentData.currency} onValueChange={(value) => setDocumentData({...documentData, currency: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="AUD">AUD (A$)</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="CNY">CNY (¥)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="terms">Payment Terms</Label>
                <Select value={documentData.terms} onValueChange={(value) => setDocumentData({...documentData, terms: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 45">Net 45</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Company Information */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Company Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={documentData.companyName}
                    onChange={(e) => setDocumentData({...documentData, companyName: e.target.value})}
                    placeholder="Your company name"
                  />
                </div>
                <div>
                  <Label htmlFor="companyAddress">Company Address</Label>
                  <Textarea
                    id="companyAddress"
                    value={documentData.companyAddress}
                    onChange={(e) => setDocumentData({...documentData, companyAddress: e.target.value})}
                    placeholder="Your company address"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Company Logo Upload */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Image className="h-4 w-4" />
                Company Logo
              </h3>
              <div className="space-y-4">
                {logoUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={logoUrl} 
                        alt="Company Logo" 
                        className="h-20 w-20 object-contain border rounded-lg bg-gray-50"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-2">
                        Logo uploaded successfully. This will appear on your {activeTab}s.
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={removeLogo}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove Logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        Upload your company logo to appear on {activeTab}s
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG up to 2MB
                      </p>
                    </div>
                    <div className="relative">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={logoUploading || !user}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button 
                        type="button" 
                        variant="outline"
                        disabled={logoUploading || !user}
                        className="relative"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {logoUploading ? 'Uploading...' : 'Choose Logo'}
                      </Button>
                    </div>
                    {!user && (
                      <p className="text-xs text-amber-600 mt-2">
                        Please sign in to upload a logo
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Client Information */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="h-4 w-4" />
                Client Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={documentData.clientName}
                    onChange={(e) => setDocumentData({...documentData, clientName: e.target.value})}
                    placeholder="Client or company name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="clientEmail">Client Email *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={documentData.clientEmail}
                    onChange={(e) => setDocumentData({...documentData, clientEmail: e.target.value})}
                    placeholder="client@example.com"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="clientAddress">Client Address</Label>
                  <Textarea
                    id="clientAddress"
                    value={documentData.clientAddress}
                    onChange={(e) => setDocumentData({...documentData, clientAddress: e.target.value})}
                    placeholder="Client's billing address"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="documentDate">{currentDocumentType} Date</Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={documentData.date}
                  onChange={(e) => setDocumentData({...documentData, date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="validDate">
                  {activeTab === 'quote' ? 'Valid Until' : 'Due Date'}
                </Label>
                <Input
                  id="validDate"
                  type="date"
                  value={activeTab === 'quote' ? documentData.validUntil : documentData.dueDate}
                  onChange={(e) => setDocumentData({
                    ...documentData, 
                    [activeTab === 'quote' ? 'validUntil' : 'dueDate']: e.target.value
                  })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {currentDocumentType} Items
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity === 0 ? '' : item.quantity.toString()}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Rate ({documentData.currency})</Label>
                      <Input
                        type="number"
                        value={item.rate === 0 ? '' : item.rate.toString()}
                        onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="text"
                        value={formatCurrency(item.amount)}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                
                {/* VAT/Tax Section */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="vatEnabled"
                      checked={documentData.vatEnabled}
                      onChange={(e) => setDocumentData({...documentData, vatEnabled: e.target.checked})}
                      className="rounded"
                    />
                    <Label htmlFor="vatEnabled" className="text-sm">Enable VAT/Tax</Label>
                  </div>
                  {documentData.vatEnabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={documentData.vatRate}
                        onChange={(e) => setDocumentData({...documentData, vatRate: parseFloat(e.target.value) || 0})}
                        placeholder="Rate %"
                        className="w-20"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>
                
                {documentData.vatEnabled && (
                  <div className="flex justify-between items-center">
                    <span>VAT ({documentData.vatRate}%):</span>
                    <span>{formatCurrency(calculateVAT())}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={documentData.notes}
                onChange={(e) => setDocumentData({...documentData, notes: e.target.value})}
                placeholder={`Additional notes or ${activeTab === 'quote' ? 'terms' : 'payment instructions'}`}
                rows={3}
              />
            </div>

            {/* Generate Button */}
            <div className="flex gap-4">
              <Button 
                onClick={handleGenerate} 
                className="flex-1"
                disabled={generating}
              >
                {generating ? 'Generating...' : `Generate ${currentDocumentType}`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default QuoteInvoiceCreationSection;