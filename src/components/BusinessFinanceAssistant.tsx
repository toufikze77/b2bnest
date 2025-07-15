import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, PieChart, DollarSign, Receipt, FileText, Plus, Minus, Edit3, Trash2, Quote, Upload, Image, X, Eye, Download, Send, Package, Users, CreditCard, TrendingDown, BarChart3, Building2, ShoppingCart, Star, Banknote, Landmark, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import QuoteInvoiceCreationSection from '@/components/QuoteInvoiceCreationSection';
import DocumentList from '@/components/DocumentList';
import { formatCurrency } from '@/utils/currencyUtils';
import { Tables } from '@/integrations/supabase/types';

// Type definitions
type FinanceDocument = Tables<'quotes'> | Tables<'invoices'>;
type Product = Tables<'products_services'>;
type Supplier = Tables<'suppliers'>;
type Expense = Tables<'expenses'>;
type Outgoing = Tables<'outgoings'>;
type BankAccount = Tables<'bank_accounts'>;
type BankTransaction = Tables<'bank_transactions'>;

interface FinanceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const BusinessFinanceAssistant = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'manage' | 'products' | 'suppliers' | 'expenses' | 'outgoings' | 'banking' | 'reports' | 'analytics'>('dashboard');
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('quote');
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
  const [quotes, setQuotes] = useState<Tables<'quotes'>[]>([]);
  const [invoices, setInvoices] = useState<Tables<'invoices'>[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [outgoings, setOutgoings] = useState<Outgoing[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    date: '',
    dueDate: '',
    validUntil: '',
    notes: '',
    terms: 'Net 30'
  });

  const [items, setItems] = useState<FinanceItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  // Product form state
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category: 'product' as 'product' | 'service',
    price: 0,
    cost: 0,
    stockQuantity: 0,
    isActive: true
  });

  // Supplier form state
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    paymentTerms: 'Net 30',
    isActive: true
  });

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    supplierId: '',
    category: 'office',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'pending' as 'pending' | 'approved' | 'paid'
  });

  // Outgoing form state
  const [outgoingForm, setOutgoingForm] = useState({
    supplierId: '',
    name: '',
    category: 'rent',
    amount: 0,
    frequency: 'monthly' as 'monthly' | 'quarterly' | 'annually',
    nextPaymentDate: new Date().toISOString().split('T')[0],
    isActive: true
  });

  // Bank account form state
  const [bankAccountForm, setBankAccountForm] = useState({
    accountName: '',
    accountNumber: '',
    sortCode: '',
    bankName: '',
    accountType: 'current' as 'current' | 'savings' | 'business',
    balance: 0,
    currency: 'GBP',
    isActive: true
  });

  // Supported statement formats
  const supportedFormats = [
    { id: 'csv', name: 'CSV', description: 'Comma-separated values', icon: '📊' },
    { id: 'ofx', name: 'OFX', description: 'Open Financial Exchange', icon: '💾' },
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
      const mappedAccounts = accounts.map(acc => ({
        id: acc.id,
        accountName: acc.provider_name || acc.account_number,
        accountNumber: acc.account_number || '****',
        sortCode: acc.sort_code || '',
        bankName: acc.provider_name || 'Manual Entry',
        accountType: acc.account_type as 'current' | 'savings' | 'business',
        balance: acc.balance || 0,
        currency: acc.currency,
        isActive: acc.is_active,
        lastSynced: acc.last_synced_at
      }));
      setBankAccounts(mappedAccounts);
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
      const mappedTransactions = transactions.map(trans => ({
        id: trans.id,
        accountId: trans.bank_account_id,
        date: trans.transaction_date,
        description: trans.description || '',
        amount: trans.amount,
        type: trans.transaction_type as 'credit' | 'debit',
        category: trans.category,
        reference: trans.transaction_id,
        balance: trans.balance_after || 0
      }));
      setBankTransactions(mappedTransactions);
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
      setLoading(true);
      const [quotesData, invoicesData, productsData, suppliersData, expensesData, outgoingsData] = await Promise.all([
        fetchQuotes(),
        fetchInvoices(),
        fetchProducts(),
        fetchSuppliers(),
        fetchExpenses(),
        fetchOutgoings()
      ]);

      setQuotes(quotesData || []);
      setInvoices(invoicesData || []);
      setProducts(productsData || []);
      setSuppliers(suppliersData || []);
      setExpenses(expensesData || []);
      setOutgoings(outgoingsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotes = async () => {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
      return [];
    }
    return data;
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
    return data;
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products_services')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data;
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suppliers:', error);
      return [];
    }
    return data;
  };

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching expenses:', error);
      return [];
    }
    return data;
  };

  const fetchOutgoings = async () => {
    const { data, error } = await supabase
      .from('outgoings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching outgoings:', error);
      return [];
    }
    return data;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return ['csv', 'ofx', 'qif', 'pdf'].includes(extension || '');
    });

    if (newFiles.length === 0) {
      toast({
        title: "Invalid File Format",
        description: "Please upload CSV, OFX, QIF, or PDF files only.",
        variant: "destructive"
      });
      return;
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast({
      title: "Files Added",
      description: `${newFiles.length} file(s) ready for processing.`,
    });
  };

  const processStatements = async () => {
    if (uploadedFiles.length === 0 || !selectedAccountForUpload) {
      toast({
        title: "Missing Information",
        description: "Please upload statement files and select a bank account.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to process statements.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      let totalTransactions = 0;
      let totalAccounts = 0;

      for (const file of uploadedFiles) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        
        if (fileExtension === 'csv') {
          // Parse CSV file
          const text = await file.text();
          const { transactions } = parseCSVStatement(text, file.name);
          
          // Insert transactions linked to the selected bank account
          for (const transaction of transactions) {
            const { error } = await supabase.from('bank_transactions').insert({
              user_id: user.id,
              bank_account_id: selectedAccountForUpload,
              transaction_id: `upload_${Date.now()}_${transaction.date}_${Math.abs(transaction.amount)}`,
              amount: transaction.amount,
              currency: 'GBP',
              description: transaction.description,
              transaction_type: transaction.amount >= 0 ? 'credit' : 'debit',
              category: transaction.category,
              merchant_name: transaction.merchant,
              transaction_date: transaction.date,
              timestamp: new Date(transaction.date).toISOString(),
              balance_after: transaction.balance
            });

            if (!error) {
              totalTransactions++;
            }
          }

          // Update the account balance with the latest transaction balance
          if (transactions.length > 0) {
            const latestBalance = transactions[transactions.length - 1].balance;
            await supabase
              .from('bank_accounts')
              .update({ 
                balance: latestBalance,
                available_balance: latestBalance,
                last_synced_at: new Date().toISOString()
              })
              .eq('id', selectedAccountForUpload);
          }
        } else {
          // For other formats, show a message that parsing is not yet implemented
          toast({
            title: "Format Not Implemented",
            description: `${fileExtension?.toUpperCase()} parsing will be implemented soon. Please use CSV format for now.`,
            variant: "destructive"
          });
        }
      }

      // Reload bank accounts and transactions
      await loadBankAccounts();
      await loadBankTransactions();

      toast({
        title: "Statements Processed Successfully",
        description: `Imported ${totalTransactions} transactions to the selected bank account.`,
      });

      setUploadedFiles([]);
      setSelectedAccountForUpload('');
    } catch (error) {
      console.error('Error processing statements:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process statement files. Please check the file format.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Simple CSV parser for bank statements
  const parseCSVStatement = (csvText: string, fileName: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const transactions: any[] = [];
    
    // Try to detect CSV format and parse accordingly
    const headers = lines[0].toLowerCase().split(',');
    
    // Common bank statement formats
    let dateIndex = headers.findIndex(h => h.includes('date') || h.includes('transaction'));
    let descIndex = headers.findIndex(h => h.includes('description') || h.includes('details') || h.includes('narrative'));
    let amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('credit') || h.includes('debit'));
    let balanceIndex = headers.findIndex(h => h.includes('balance'));

    // Fallback to positional parsing if headers not found
    if (dateIndex === -1) dateIndex = 0;
    if (descIndex === -1) descIndex = 1;
    if (amountIndex === -1) amountIndex = 2;
    if (balanceIndex === -1) balanceIndex = 3;

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      if (columns.length < 3) continue;

      const date = columns[dateIndex]?.replace(/"/g, '').trim();
      const description = columns[descIndex]?.replace(/"/g, '').trim();
      const amountStr = columns[amountIndex]?.replace(/"/g, '').replace(/[£$,]/g, '').trim();
      const balanceStr = columns[balanceIndex]?.replace(/"/g, '').replace(/[£$,]/g, '').trim();

      if (date && description && amountStr) {
        transactions.push({
          date: formatDate(date),
          description: description,
          amount: parseFloat(amountStr) || 0,
          balance: parseFloat(balanceStr) || 0,
          category: categorizeTransaction(description),
          merchant: extractMerchant(description)
        });
      }
    }

    return { transactions };
  };

  // Helper functions
  const formatDate = (dateStr: string): string => {
    // Try various date formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,    // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/     // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const [, a, b, c] = match;
        // Assume YYYY-MM-DD if year is first, otherwise DD/MM/YYYY
        if (c.length === 4) {
          return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        } else {
          return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        }
      }
    }
    
    return new Date().toISOString().split('T')[0]; // Fallback to today
  };

  const categorizeTransaction = (description: string): string => {
    const desc = description.toLowerCase();
    if (desc.includes('salary') || desc.includes('payroll')) return 'salary';
    if (desc.includes('grocery') || desc.includes('supermarket')) return 'groceries';
    if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('gas')) return 'fuel';
    if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('food')) return 'dining';
    if (desc.includes('transfer') || desc.includes('payment')) return 'transfer';
    if (desc.includes('fee') || desc.includes('charge')) return 'fees';
    return 'other';
  };

  const extractMerchant = (description: string): string => {
    // Extract merchant name from description
    const parts = description.split(' ');
    return parts.slice(0, 3).join(' '); // Take first 3 words as merchant
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const viewDocument = (doc: FinanceDocument) => {
    // Open document in a new window/tab for viewing
    toast({
      title: "Document Viewer",
      description: `Opening ${doc.type} ${doc.number} for viewing...`,
    });
    // Here you would typically open a PDF viewer or detailed view modal
  };

  const downloadDocument = (doc: FinanceDocument) => {
    // Generate and download PDF
    toast({
      title: "Downloading Document",
      description: `Preparing ${doc.type} ${doc.number} for download...`,
    });
    // Here you would typically generate a PDF and trigger download
  };

  const sendDocument = (doc: FinanceDocument) => {
    // Send document via email
    toast({
      title: "Send Document",
      description: `Sending ${doc.type} ${doc.number} to ${doc.clientEmail}...`,
    });
    // Here you would typically send the document via email
  };

  const downloadCatalog = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Category,Price,Cost,Stock,Status\n" +
      products.map(p => `${p.name},${p.category},${p.price},${p.cost || 0},${p.stock_quantity || 'N/A'}` + (p.is_active ? ',Active' : ',Inactive')).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "products-catalog.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "Products catalog downloaded as CSV file.",
    });
  };

  const downloadSuppliers = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Contact Person,Email,Phone,Payment Terms,Status\n" +
      suppliers.map(s => `${s.name},${s.contact_person || ''},${s.email || ''},${s.phone || ''},${s.payment_terms},${s.is_active ? 'Active' : 'Inactive'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "suppliers-list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "Suppliers list downloaded as CSV file.",
    });
  };

  const downloadExpenses = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Description,Category,Amount,Supplier,Status\n" +
      expenses.map(e => `${e.date},${e.description},${e.category},${e.amount},${e.supplier_id || ''},${e.status}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses-report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "Expenses report downloaded as CSV file.",
    });
  };

  const downloadOutgoings = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Category,Amount,Frequency,Next Payment,Status\n" +
      outgoings.map(o => `${o.name},${o.category},${o.amount},${o.frequency},${o.next_payment_date},${o.is_active ? 'Active' : 'Inactive'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "outgoings-schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "Outgoings schedule downloaded as CSV file.",
    });
  };

  const addItem = () => {
    const newItem: FinanceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof FinanceItem, value: string | number) => {
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

  const calculateTotal = () => {
    return items.reduce((total, item) => total + item.amount, 0);
  };

  const generateDocumentNumber = (type: 'invoice' | 'quote') => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const prefix = type === 'quote' ? 'QUO' : 'INV';
    return `${prefix}-${year}${month}${day}-${random}`;
  };

  const handleCreateDocument = () => {
    if (!formData.clientName || !formData.clientEmail) {
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

    const newDocument: FinanceDocument = {
      id: Date.now().toString(),
      type: documentType,
      number: generateDocumentNumber(documentType),
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
      date: formData.date || new Date().toISOString().split('T')[0],
      dueDate: documentType === 'invoice' ? formData.dueDate : undefined,
      validUntil: documentType === 'quote' ? formData.validUntil : undefined,
      items: [...items],
      total: calculateTotal(),
      status: documentType === 'invoice' ? 'pending' : 'draft',
      notes: formData.notes
    };

    setDocuments([...documents, newDocument]);
    
    // Reset form
    setFormData({
      clientName: '',
      clientEmail: '',
      clientAddress: '',
      date: '',
      dueDate: '',
      validUntil: '',
      notes: '',
      terms: 'Net 30'
    });
    setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);

    toast({
      title: `${documentType === 'invoice' ? 'Invoice' : 'Quote'} Created`,
      description: `${newDocument.number} has been created successfully.`,
    });

    setActiveTab('manage');
  };

  const deleteDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
    toast({
      title: "Document Deleted",
      description: "Document has been removed successfully.",
    });
  };

  const addProduct = () => {
    if (!productForm.name || productForm.price <= 0) {
      toast({
        title: "Invalid Product",
        description: "Please provide a name and valid price.",
        variant: "destructive"
      });
      return;
    }

    const newProduct: Product = {
      id: Date.now().toString(),
      ...productForm
    };

    setProducts([...products, newProduct]);
    setProductForm({
      name: '',
      description: '',
      category: 'product',
      price: 0,
      cost: 0,
      stockQuantity: 0,
      isActive: true
    });

    toast({
      title: "Product Added",
      description: `${newProduct.name} has been added successfully.`,
    });
  };

  const addSupplier = () => {
    if (!supplierForm.name || !supplierForm.email) {
      toast({
        title: "Invalid Supplier",
        description: "Please provide a name and email.",
        variant: "destructive"
      });
      return;
    }

    const newSupplier: Supplier = {
      id: Date.now().toString(),
      ...supplierForm
    };

    setSuppliers([...suppliers, newSupplier]);
    setSupplierForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      paymentTerms: 'Net 30',
      isActive: true
    });

    toast({
      title: "Supplier Added",
      description: `${newSupplier.name} has been added successfully.`,
    });
  };

  const addExpense = () => {
    if (!expenseForm.description || expenseForm.amount <= 0) {
      toast({
        title: "Invalid Expense",
        description: "Please provide a description and valid amount.",
        variant: "destructive"
      });
      return;
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      ...expenseForm
    };

    setExpenses([...expenses, newExpense]);
    setExpenseForm({
      supplierId: '',
      category: 'office',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    });

    toast({
      title: "Expense Added",
      description: "Expense has been recorded successfully.",
    });
  };

  const addOutgoing = () => {
    if (!outgoingForm.name || outgoingForm.amount <= 0) {
      toast({
        title: "Invalid Outgoing",
        description: "Please provide a name and valid amount.",
        variant: "destructive"
      });
      return;
    }

    const newOutgoing: Outgoing = {
      id: Date.now().toString(),
      ...outgoingForm
    };

    setOutgoings([...outgoings, newOutgoing]);
    setOutgoingForm({
      supplierId: '',
      name: '',
      category: 'rent',
      amount: 0,
      frequency: 'monthly',
      nextPaymentDate: new Date().toISOString().split('T')[0],
      isActive: true
    });

    toast({
      title: "Outgoing Added",
      description: "Regular outgoing has been added successfully.",
    });
  };

  const addBankAccount = async () => {
    if (!bankAccountForm.accountName || !bankAccountForm.accountNumber || !bankAccountForm.sortCode || !bankAccountForm.bankName) {
      toast({
        title: "Invalid Bank Account",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add bank accounts.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user.id,
          account_id: bankAccountForm.accountNumber,
          provider_id: 'manual_entry',
          provider_name: bankAccountForm.bankName,
          account_type: bankAccountForm.accountType,
          account_number: bankAccountForm.accountNumber,
          sort_code: bankAccountForm.sortCode,
          currency: bankAccountForm.currency,
          balance: bankAccountForm.balance,
          available_balance: bankAccountForm.balance,
          last_synced_at: new Date().toISOString(),
          is_active: bankAccountForm.isActive
        });

      if (error) throw error;

      // Reload bank accounts
      await loadBankAccounts();

      setBankAccountForm({
        accountName: '',
        accountNumber: '',
        sortCode: '',
        bankName: '',
        accountType: 'current',
        balance: 0,
        currency: 'GBP',
        isActive: true
      });

      toast({
        title: "Bank Account Added",
        description: `${bankAccountForm.accountName} has been added successfully.`,
      });
    } catch (error) {
      console.error('Error adding bank account:', error);
      toast({
        title: "Failed to Add Account",
        description: "There was an error adding the bank account.",
        variant: "destructive"
      });
    }
  };

  const getTotalRevenue = () => {
    return documents
      .filter(doc => doc.type === 'invoice' && doc.status === 'paid')
      .reduce((total, doc) => total + doc.total, 0);
  };

  const getPendingInvoices = () => {
    return documents.filter(doc => doc.type === 'invoice' && doc.status === 'pending').length;
  };

  const getActiveQuotes = () => {
    return documents.filter(doc => doc.type === 'quote' && doc.status === 'draft').length;
  };

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  };

  const getTotalOutgoings = () => {
    return outgoings
      .filter(outgoing => outgoing.isActive)
      .reduce((total, outgoing) => {
        const multiplier = outgoing.frequency === 'monthly' ? 12 : 
                         outgoing.frequency === 'quarterly' ? 4 : 1;
        return total + (outgoing.amount * multiplier);
      }, 0);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

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

      const { error: uploadError } = await supabase.storage
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

  const handleViewQuotesInvoices = (type) => {
    setDocumentType(type);
    setViewingDocuments(true);
  };

  const handleDownloadDocument = (document, type) => {
    try {
      const items = JSON.parse(document.items || '[]');
      const subtotal = document.subtotal || 0;
      const taxAmount = document.tax_amount || 0;
      const total = document.total_amount || 0;
      const currency = document.currency || 'USD';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${type === 'quote' ? 'Quote' : 'Invoice'} ${type === 'quote' ? document.quote_number : document.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; align-items: flex-start; }
            .company-info h1 { margin: 0; color: #2563eb; font-size: 28px; }
            .company-info p { margin: 5px 0; color: #666; }
            .document-title { text-align: right; }
            .document-title h2 { margin: 0; font-size: 2.5em; color: #374151; font-weight: bold; }
            .document-title p { margin: 5px 0; font-size: 14px; }
            .client-info { margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .client-info h3 { margin: 0 0 15px 0; color: #374151; }
            .client-info p { margin: 3px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .items-table th { background-color: #f1f5f9; font-weight: 600; color: #374151; }
            .items-table .text-right { text-align: right; }
            .items-table .text-center { text-align: center; }
            .totals { margin: 30px 0; }
            .totals-table { margin-left: auto; min-width: 300px; }
            .totals-table td { padding: 8px 15px; border: none; }
            .totals-table .subtotal-row { border-bottom: 1px solid #ddd; }
            .totals-table .total-row { border-top: 2px solid #374151; font-weight: bold; font-size: 18px; }
            .notes { margin: 40px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
            .notes h3 { margin: 0 0 15px 0; color: #374151; }
            .logo { max-height: 80px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              ${document.logo_url ? `<img src="${document.logo_url}" alt="Logo" class="logo">` : ''}
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
                <th class="text-center">Quantity</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(item.rate, currency)}</td>
                  <td class="text-right">${formatCurrency(item.amount, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <table class="totals-table">
              <tr class="subtotal-row">
                <td>Subtotal:</td>
                <td class="text-right">${formatCurrency(subtotal, currency)}</td>
              </tr>
              ${taxAmount > 0 ? `
              <tr class="subtotal-row">
                <td>Tax (${document.tax_rate}%):</td>
                <td class="text-right">${formatCurrency(taxAmount, currency)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td><strong>Total:</strong></td>
                <td class="text-right"><strong>${formatCurrency(total, currency)}</strong></td>
              </tr>
            </table>
          </div>
          
          ${document.notes ? `
          <div class="notes">
            <h3>Notes:</h3>
            <p>${document.notes.replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}
        </body>
        </html>
      `;

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
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSendDocument = async (document, type) => {
    setSendingDocument(document.id);
    try {
      // Here you would implement the actual sending logic
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Document Sent",
        description: `${type === 'quote' ? 'Quote' : 'Invoice'} sent successfully to ${document.client_email}.`,
      });
    } catch (error) {
      console.error('Send error:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingDocument(null);
    }
  };

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast({
        title: "No Data",
        description: "No data available to download.",
        variant: "destructive"
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Download Complete",
      description: `${filename} downloaded successfully.`,
    });
  };

  const [viewingDocuments, setViewingDocuments] = useState(false);
  const [sendingDocument, setSendingDocument] = useState(null);
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-lg">Loading Business Finance Assistant...</div>
      </div>
    );
  }

  if (viewingDocuments) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <DocumentList
          activeTab={documentType}
          quotes={quotes}
          invoices={invoices}
          loading={loading}
          sendingDocument={sendingDocument}
          onTabChange={(tab) => setDocumentType(tab)}
          onBack={() => setViewingDocuments(false)}
          onView={(id, type) => console.log('View document:', id, type)}
          onDownload={handleDownloadDocument}
          onSend={handleSendDocument}
        />
      </div>
    );
  }

  const activeQuotes = quotes.filter(q => q.status === 'active' || q.status === 'sent').length;
  const pendingInvoices = invoices.filter(i => i.status === 'pending').length;
  const totalRevenue = invoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Business Finance Assistant</h1>
            <p className="text-gray-600">Complete financial management for your business</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manage
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="outgoings" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Outgoings
            </TabsTrigger>
            <TabsTrigger value="banking" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Banking
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow" 
                onClick={() => handleViewQuotesInvoices('quote')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${getTotalRevenue().toFixed(2)}</div>
                  <p className="text-xs text-gray-600">From paid invoices</p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow" 
                onClick={() => handleViewQuotesInvoices('invoice')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-orange-600" />
                    Pending Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{getPendingInvoices()}</div>
                  <p className="text-xs text-gray-600">Awaiting payment</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Active Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{getActiveQuotes()}</div>
                  <p className="text-xs text-gray-600">Pending approval</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-red-600" />
                    Total Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${getTotalExpenses().toFixed(2)}</div>
                  <p className="text-xs text-gray-600">YTD expenses</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Documents</CardTitle>
                  <CardDescription>Your latest invoices and quotes</CardDescription>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No documents created yet</p>
                      <Button 
                        className="mt-2"
                        onClick={() => setActiveTab('create')}
                      >
                        Create Your First Document
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.slice(-5).reverse().map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              doc.type === 'invoice' ? 'bg-orange-100' : 'bg-blue-100'
                            }`}>
                              {doc.type === 'invoice' ? (
                                <Receipt className="h-4 w-4 text-orange-600" />
                              ) : (
                                <FileText className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{doc.number}</p>
                              <p className="text-sm text-gray-600">{doc.clientName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={doc.status === 'paid' ? 'default' : 'secondary'}>
                              {doc.status}
                            </Badge>
                            <span className="font-medium">${doc.total.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common business finance tasks</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2 flex-1"
                    onClick={() => setActiveTab('create')}
                  >
                    <Plus className="h-6 w-6" />
                    Create Invoice
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2 flex-1"
                    onClick={() => setActiveTab('expenses')}
                  >
                    <CreditCard className="h-6 w-6" />
                    Add Expense
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2 flex-1"
                    onClick={() => setActiveTab('products')}
                  >
                    <Package className="h-6 w-6" />
                    Add Product
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2 flex-1"
                    onClick={() => setActiveTab('reports')}
                  >
                    <BarChart3 className="h-6 w-6" />
                    View Reports
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-6 mt-6">
            <QuoteInvoiceCreationSection />
          </TabsContent>

          <TabsContent value="manage" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Management</CardTitle>
                <CardDescription>View and manage all your invoices and quotes</CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No documents found</p>
                    <Button 
                      className="mt-2"
                      onClick={() => setActiveTab('create')}
                    >
                      Create Your First Document
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <Card key={doc.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                doc.type === 'invoice' ? 'bg-orange-100' : 'bg-blue-100'
                              }`}>
                                {doc.type === 'invoice' ? (
                                  <Receipt className="h-5 w-5 text-orange-600" />
                                ) : (
                                  <FileText className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{doc.number}</h3>
                                  <Badge variant={doc.status === 'paid' ? 'default' : 'secondary'}>
                                    {doc.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{doc.clientName} • {doc.date}</p>
                                <p className="text-sm font-medium">${doc.total.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => viewDocument(doc)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => downloadDocument(doc)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => sendDocument(doc)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Send
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => deleteDocument(doc.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Add Product/Service
                  </CardTitle>
                  <CardDescription>Manage your product and service catalog</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={productForm.category === 'product' ? 'default' : 'outline'}
                      onClick={() => setProductForm({...productForm, category: 'product'})}
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Product
                    </Button>
                    <Button
                      variant={productForm.category === 'service' ? 'default' : 'outline'}
                      onClick={() => setProductForm({...productForm, category: 'service'})}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Service
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor="productName">Name *</Label>
                    <Input
                      id="productName"
                      value={productForm.name}
                      onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                      placeholder="Product or service name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="productDescription">Description</Label>
                    <Textarea
                      id="productDescription"
                      value={productForm.description}
                      onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                      placeholder="Product or service description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="productPrice">Sale Price *</Label>
                      <Input
                        id="productPrice"
                        type="number"
                        value={productForm.price || ''}
                        onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="productCost">Cost</Label>
                      <Input
                        id="productCost"
                        type="number"
                        value={productForm.cost || ''}
                        onChange={(e) => setProductForm({...productForm, cost: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  {productForm.category === 'product' && (
                    <div>
                      <Label htmlFor="stockQuantity">Stock Quantity</Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        value={productForm.stockQuantity || ''}
                        onChange={(e) => setProductForm({...productForm, stockQuantity: parseInt(e.target.value) || 0})}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  )}

                  <Button onClick={addProduct} className="w-full">
                    Add {productForm.category}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Products & Services</CardTitle>
                    <CardDescription>{products.length} items in catalog</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={downloadCatalog}
                    disabled={products.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No products or services added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              product.category === 'product' ? 'bg-blue-100' : 'bg-purple-100'
                            }`}>
                              {product.category === 'product' ? (
                                <Package className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Star className="h-4 w-4 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-gray-600">
                                {product.category} • ${product.price.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={product.isActive ? 'default' : 'secondary'}>
                              {product.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {product.category === 'product' && (
                              <span className="text-sm text-gray-500">
                                Stock: {product.stockQuantity}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Add Supplier
                  </CardTitle>
                  <CardDescription>Manage your supplier contacts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="supplierName">Company Name *</Label>
                    <Input
                      id="supplierName"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                      placeholder="Supplier company name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      value={supplierForm.contactPerson}
                      onChange={(e) => setSupplierForm({...supplierForm, contactPerson: e.target.value})}
                      placeholder="Contact person name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplierEmail">Email *</Label>
                      <Input
                        id="supplierEmail"
                        type="email"
                        value={supplierForm.email}
                        onChange={(e) => setSupplierForm({...supplierForm, email: e.target.value})}
                        placeholder="supplier@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplierPhone">Phone</Label>
                      <Input
                        id="supplierPhone"
                        value={supplierForm.phone}
                        onChange={(e) => setSupplierForm({...supplierForm, phone: e.target.value})}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="supplierAddress">Address</Label>
                    <Textarea
                      id="supplierAddress"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({...supplierForm, address: e.target.value})}
                      placeholder="Supplier address"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Select 
                      value={supplierForm.paymentTerms} 
                      onValueChange={(value) => setSupplierForm({...supplierForm, paymentTerms: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                        <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={addSupplier} className="w-full">
                    Add Supplier
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Suppliers</CardTitle>
                    <CardDescription>{suppliers.length} suppliers in your network</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={downloadSuppliers}
                    disabled={suppliers.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  {suppliers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No suppliers added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suppliers.map((supplier) => (
                        <div key={supplier.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{supplier.name}</p>
                              <p className="text-sm text-gray-600">
                                {supplier.contactPerson} • {supplier.paymentTerms}
                              </p>
                            </div>
                          </div>
                          <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                            {supplier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Record Expense
                  </CardTitle>
                  <CardDescription>Track business expenses and receipts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="expenseSupplier">Supplier (Optional)</Label>
                    <Select 
                      value={expenseForm.supplierId} 
                      onValueChange={(value) => setExpenseForm({...expenseForm, supplierId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expenseCategory">Category</Label>
                    <Select 
                      value={expenseForm.category} 
                      onValueChange={(value) => setExpenseForm({...expenseForm, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office">Office Supplies</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="software">Software/Subscriptions</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="meals">Meals & Entertainment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expenseDescription">Description *</Label>
                    <Input
                      id="expenseDescription"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                      placeholder="Expense description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expenseAmount">Amount *</Label>
                      <Input
                        id="expenseAmount"
                        type="number"
                        value={expenseForm.amount || ''}
                        onChange={(e) => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expenseDate">Date</Label>
                      <Input
                        id="expenseDate"
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="expenseStatus">Status</Label>
                    <Select 
                      value={expenseForm.status} 
                      onValueChange={(value) => setExpenseForm({...expenseForm, status: value as any})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={addExpense} className="w-full">
                    Record Expense
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Expenses</CardTitle>
                    <CardDescription>{expenses.length} expenses recorded</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={downloadExpenses}
                    disabled={expenses.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  {expenses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No expenses recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {expenses.slice(-10).reverse().map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                              <CreditCard className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium">{expense.description}</p>
                              <p className="text-sm text-gray-600">
                                {expense.category} • {expense.date}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={
                              expense.status === 'paid' ? 'default' :
                              expense.status === 'approved' ? 'secondary' : 'outline'
                            }>
                              {expense.status}
                            </Badge>
                            <span className="font-medium">${expense.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="outgoings" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    Add Regular Outgoing
                  </CardTitle>
                  <CardDescription>Track recurring payments and commitments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="outgoingSupplier">Supplier (Optional)</Label>
                    <Select 
                      value={outgoingForm.supplierId} 
                      onValueChange={(value) => setOutgoingForm({...outgoingForm, supplierId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="outgoingName">Name *</Label>
                    <Input
                      id="outgoingName"
                      value={outgoingForm.name}
                      onChange={(e) => setOutgoingForm({...outgoingForm, name: e.target.value})}
                      placeholder="e.g., Office Rent, Software License"
                    />
                  </div>

                  <div>
                    <Label htmlFor="outgoingCategory">Category</Label>
                    <Select 
                      value={outgoingForm.category} 
                      onValueChange={(value) => setOutgoingForm({...outgoingForm, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="subscriptions">Subscriptions</SelectItem>
                        <SelectItem value="loan">Loan Payments</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="outgoingAmount">Amount *</Label>
                      <Input
                        id="outgoingAmount"
                        type="number"
                        value={outgoingForm.amount || ''}
                        onChange={(e) => setOutgoingForm({...outgoingForm, amount: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="outgoingFrequency">Frequency</Label>
                      <Select 
                        value={outgoingForm.frequency} 
                        onValueChange={(value) => setOutgoingForm({...outgoingForm, frequency: value as any})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="nextPaymentDate">Next Payment Date</Label>
                    <Input
                      id="nextPaymentDate"
                      type="date"
                      value={outgoingForm.nextPaymentDate}
                      onChange={(e) => setOutgoingForm({...outgoingForm, nextPaymentDate: e.target.value})}
                    />
                  </div>

                  <Button onClick={addOutgoing} className="w-full">
                    Add Outgoing
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Regular Outgoings</CardTitle>
                    <CardDescription>{outgoings.length} recurring payments</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={downloadOutgoings}
                    disabled={outgoings.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  {outgoings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No regular outgoings added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {outgoings.map((outgoing) => (
                        <div key={outgoing.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <TrendingDown className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium">{outgoing.name}</p>
                              <p className="text-sm text-gray-600">
                                {outgoing.category} • {outgoing.frequency} • Next: {outgoing.nextPaymentDate}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={outgoing.isActive ? 'default' : 'secondary'}>
                              {outgoing.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="font-medium">${outgoing.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="banking" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Bank Statements
                  </CardTitle>
                  <CardDescription>Import transactions from statement files</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-2">Upload bank statement files</p>
                    <p className="text-xs text-gray-500 mb-4">
                      Supported formats: CSV, OFX, QIF, PDF
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
                      {supportedFormats.map((format) => (
                        <div key={format.id} className="flex items-center gap-1">
                          <span>{format.icon}</span>
                          <span>{format.name} - {format.description}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="accountSelect">Link to Bank Account *</Label>
                        <Select value={selectedAccountForUpload} onValueChange={setSelectedAccountForUpload}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bank account for these statements" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.accountName} - {account.bankName} (***{account.accountNumber.slice(-4)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Input
                          type="file"
                          multiple
                          accept=".csv,.ofx,.qif,.pdf"
                          onChange={handleFileUpload}
                          className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                          id="statement-upload"
                        />
                      </div>
                    </div>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Files to process:</p>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        onClick={processStatements} 
                        disabled={isProcessing || !selectedAccountForUpload}
                        className="w-full"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Process {uploadedFiles.length} File(s)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Add Bank Account
                  </CardTitle>
                  <CardDescription>Manually add bank account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="accountName">Account Name *</Label>
                    <Input
                      id="accountName"
                      value={bankAccountForm.accountName}
                      onChange={(e) => setBankAccountForm({...bankAccountForm, accountName: e.target.value})}
                      placeholder="e.g., Business Current Account"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input
                        id="accountNumber"
                        value={bankAccountForm.accountNumber}
                        onChange={(e) => setBankAccountForm({...bankAccountForm, accountNumber: e.target.value})}
                        placeholder="12345678"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sortCode">Sort Code *</Label>
                      <Input
                        id="sortCode"
                        value={bankAccountForm.sortCode}
                        onChange={(e) => setBankAccountForm({...bankAccountForm, sortCode: e.target.value})}
                        placeholder="12-34-56"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={bankAccountForm.bankName}
                      onChange={(e) => setBankAccountForm({...bankAccountForm, bankName: e.target.value})}
                      placeholder="e.g., HSBC, Barclays"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="accountType">Account Type</Label>
                      <Select 
                        value={bankAccountForm.accountType} 
                        onValueChange={(value: 'current' | 'savings' | 'business') => 
                          setBankAccountForm({...bankAccountForm, accountType: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current Account</SelectItem>
                          <SelectItem value="business">Business Account</SelectItem>
                          <SelectItem value="savings">Savings Account</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="balance">Current Balance</Label>
                      <Input
                        id="balance"
                        type="number"
                        value={bankAccountForm.balance}
                        onChange={(e) => setBankAccountForm({...bankAccountForm, balance: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <Button onClick={addBankAccount} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bank Account
                  </Button>
                </CardContent>
              </Card>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Bank Accounts
                  </CardTitle>
                  <CardDescription>Manage your connected accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  {bankAccounts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Banknote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No bank accounts added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bankAccounts.map((account) => (
                        <div key={account.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{account.accountName}</h4>
                            <Badge variant={account.isActive ? "default" : "secondary"}>
                              {account.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>{account.bankName}</p>
                            <p>Account: ***{account.accountNumber.slice(-4)} | Sort: {account.sortCode}</p>
                            <p className="flex items-center justify-between">
                              <span>Balance: £{account.balance.toFixed(2)}</span>
                              <span className="text-xs">Manual Entry</span>
                            </p>
                            {account.lastSynced && (
                              <p className="text-xs">
                                Last synced: {new Date(account.lastSynced).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Recent Transactions
                  </CardTitle>
                  <CardDescription>Latest bank transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {bankTransactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No transactions synced yet</p>
                      <p className="text-xs mt-1">Connect a bank feed to see transactions</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bankTransactions.slice(-10).reverse().map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              transaction.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              {transaction.type === 'credit' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{transaction.description}</p>
                              <p className="text-xs text-gray-600">
                                {transaction.date} • {transaction.reference}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${
                              transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'credit' ? '+' : '-'}£{Math.abs(transaction.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">
                              Balance: £{transaction.balance.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Profit & Loss Summary
                  </CardTitle>
                  <CardDescription>Financial performance overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium">Total Revenue</span>
                    <span className="text-green-600 font-bold">${getTotalRevenue().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-medium">Total Expenses</span>
                    <span className="text-red-600 font-bold">-${getTotalExpenses().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border-t-2">
                    <span className="font-semibold">Net Profit</span>
                    <span className={`font-bold ${getTotalRevenue() - getTotalExpenses() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${(getTotalRevenue() - getTotalExpenses()).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Invoicing Trends</CardTitle>
                  <CardDescription>Invoice status breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Paid Invoices</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">
                          {documents.filter(d => d.type === 'invoice' && d.status === 'paid').length}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          ${documents.filter(d => d.type === 'invoice' && d.status === 'paid')
                            .reduce((sum, d) => sum + d.total, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Pending Invoices</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {documents.filter(d => d.type === 'invoice' && d.status === 'pending').length}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          ${documents.filter(d => d.type === 'invoice' && d.status === 'pending')
                            .reduce((sum, d) => sum + d.total, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Draft Quotes</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {documents.filter(d => d.type === 'quote' && d.status === 'draft').length}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          ${documents.filter(d => d.type === 'quote' && d.status === 'draft')
                            .reduce((sum, d) => sum + d.total, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Products & Services</CardTitle>
                  <CardDescription>Best performing items</CardDescription>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No products/services to analyze</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {products.slice(0, 5).map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              product.category === 'product' ? 'bg-blue-100' : 'bg-purple-100'
                            }`}>
                              {product.category === 'product' ? (
                                <Package className="h-3 w-3 text-blue-600" />
                              ) : (
                                <Star className="h-3 w-3 text-purple-600" />
                              )}
                            </div>
                            <span className="text-sm">{product.name}</span>
                          </div>
                          <div className="text-sm font-medium">${product.price.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Customers</CardTitle>
                  <CardDescription>Highest value clients</CardDescription>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No customer data to analyze</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.from(
                        documents.reduce((acc, doc) => {
                          const existing = acc.get(doc.clientName) || { name: doc.clientName, total: 0, count: 0 };
                          existing.total += doc.total;
                          existing.count += 1;
                          acc.set(doc.clientName, existing);
                          return acc;
                        }, new Map())
                      )
                      .sort(([,a], [,b]) => b.total - a.total)
                      .slice(0, 5)
                      .map(([name, data]) => (
                        <div key={name} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                              <Users className="h-3 w-3 text-green-600" />
                            </div>
                            <span className="text-sm">{data.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">${data.total.toFixed(2)}</div>
                            <div className="text-xs text-gray-500">{data.count} invoices</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue, 'USD')}</div>
                  <p className="text-sm text-gray-600">Total from invoices</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses, 'USD')}</div>
                  <p className="text-sm text-gray-600">Total expenses</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Net Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalRevenue - totalExpenses, 'USD')}</div>
                  <p className="text-sm text-gray-600">Revenue - Expenses</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Quotes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{quotes.length}</div>
                  <p className="text-sm text-gray-600">Active: {activeQuotes}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BusinessFinanceAssistant;
