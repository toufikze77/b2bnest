import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, PieChart, DollarSign, Receipt, FileText, Plus, Minus, Edit3, Trash2, Quote, Upload, Image, X, Eye, Download, Send, Package, Users, CreditCard, TrendingDown, BarChart3, Building2, ShoppingCart, Star, Banknote, Landmark, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FinanceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface FinanceDocument {
  id: string;
  type: 'invoice' | 'quote';
  number: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate?: string;
  validUntil?: string;
  items: FinanceItem[];
  total: number;
  status: string;
  notes: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: 'product' | 'service';
  price: number;
  cost: number;
  stockQuantity?: number;
  isActive: boolean;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  isActive: boolean;
}

interface Expense {
  id: string;
  supplierId?: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'paid';
}

interface Outgoing {
  id: string;
  supplierId?: string;
  name: string;
  category: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
  nextPaymentDate: string;
  isActive: boolean;
}

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  sortCode: string;
  bankName: string;
  accountType: 'current' | 'savings' | 'business';
  balance: number;
  currency: string;
  isActive: boolean;
  lastSynced?: string;
}

interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category?: string;
  reference?: string;
  balance: number;
}

const BusinessFinanceAssistant = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'manage' | 'products' | 'suppliers' | 'expenses' | 'outgoings' | 'banking' | 'reports'>('dashboard');
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice');
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
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

  // UK Banks for integration
  const ukBanks = [
    { id: 'hsbc', name: 'HSBC', logo: '🏦', status: 'available' },
    { id: 'barclays', name: 'Barclays', logo: '🏦', status: 'available' },
    { id: 'lloyds', name: 'Lloyds Banking Group', logo: '🏦', status: 'available' },
    { id: 'natwest', name: 'NatWest', logo: '🏦', status: 'available' },
    { id: 'santander', name: 'Santander UK', logo: '🏦', status: 'available' },
    { id: 'halifax', name: 'Halifax', logo: '🏦', status: 'available' },
    { id: 'tesco', name: 'Tesco Bank', logo: '🏦', status: 'available' },
    { id: 'nationwide', name: 'Nationwide', logo: '🏦', status: 'available' },
    { id: 'metro', name: 'Metro Bank', logo: '🏦', status: 'available' },
    { id: 'monzo', name: 'Monzo', logo: '🏦', status: 'available' },
    { id: 'starling', name: 'Starling Bank', logo: '🏦', status: 'available' },
    { id: 'revolut', name: 'Revolut', logo: '🏦', status: 'available' }
  ];

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

  const addBankAccount = () => {
    if (!bankAccountForm.accountName || !bankAccountForm.accountNumber || !bankAccountForm.sortCode || !bankAccountForm.bankName) {
      toast({
        title: "Invalid Bank Account",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const newBankAccount: BankAccount = {
      id: Date.now().toString(),
      ...bankAccountForm,
      lastSynced: new Date().toISOString()
    };

    setBankAccounts([...bankAccounts, newBankAccount]);
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
      description: `${newBankAccount.accountName} has been added successfully.`,
    });
  };

  const connectBankFeed = async (bankId: string) => {
    setIsSyncing(true);
    setSelectedBank(bankId);

    // Simulate bank connection process
    setTimeout(() => {
      const bankName = ukBanks.find(bank => bank.id === bankId)?.name || 'Bank';
      
      // Create sample transactions for demo
      const sampleTransactions: BankTransaction[] = [
        {
          id: Date.now().toString(),
          accountId: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          description: 'Direct Debit - Office Rent',
          amount: -1200.00,
          type: 'debit',
          category: 'rent',
          reference: 'DD123456',
          balance: 8500.00
        },
        {
          id: (Date.now() + 1).toString(),
          accountId: Date.now().toString(),
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          description: 'Client Payment - Invoice #INV-001',
          amount: 2500.00,
          type: 'credit',
          category: 'revenue',
          reference: 'TRF001',
          balance: 9700.00
        },
        {
          id: (Date.now() + 2).toString(),
          accountId: Date.now().toString(),
          date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
          description: 'Card Payment - Office Supplies',
          amount: -89.99,
          type: 'debit',
          category: 'office',
          reference: 'CD123',
          balance: 7200.00
        }
      ];

      setBankTransactions(prev => [...prev, ...sampleTransactions]);
      
      toast({
        title: "Bank Connected",
        description: `Successfully connected to ${bankName} and synced transactions.`,
      });
      
      setIsSyncing(false);
      setSelectedBank('');
    }, 3000);
  };

  const syncBankAccount = (accountId: string) => {
    setIsSyncing(true);
    
    // Simulate sync process
    setTimeout(() => {
      setBankAccounts(prev => prev.map(account => 
        account.id === accountId 
          ? { ...account, lastSynced: new Date().toISOString() }
          : account
      ));
      
      toast({
        title: "Account Synced",
        description: "Latest transactions have been imported.",
      });
      
      setIsSyncing(false);
    }, 2000);
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-8">
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
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
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

              <Card>
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

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-purple-600" />
                    Annual Outgoings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${getTotalOutgoings().toFixed(2)}</div>
                  <p className="text-xs text-gray-600">Projected annual</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New Document
                </CardTitle>
                <CardDescription>Generate professional invoices and quotes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Document Type Selection */}
                <div className="flex gap-4">
                  <Button
                    variant={documentType === 'invoice' ? 'default' : 'outline'}
                    onClick={() => setDocumentType('invoice')}
                    className="h-12 flex-1"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Invoice
                  </Button>
                  <Button
                    variant={documentType === 'quote' ? 'default' : 'outline'}
                    onClick={() => setDocumentType('quote')}
                    className="h-12 flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Quote
                  </Button>
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
                            Logo uploaded successfully. This will appear on your {documentType}s.
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
                            Upload your company logo to appear on {documentType}s
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
                  <h3 className="font-semibold mb-4">Client Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clientName">Client Name *</Label>
                      <Input
                        id="clientName"
                        value={formData.clientName}
                        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                        placeholder="Client or company name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientEmail">Client Email *</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={formData.clientEmail}
                        onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                        placeholder="client@example.com"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="clientAddress">Client Address</Label>
                      <Textarea
                        id="clientAddress"
                        value={formData.clientAddress}
                        onChange={(e) => setFormData({...formData, clientAddress: e.target.value})}
                        placeholder="Client's billing address"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">
                      {documentType === 'invoice' ? 'Due Date' : 'Valid Until'}
                    </Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={documentType === 'invoice' ? formData.dueDate : formData.validUntil}
                      onChange={(e) => setFormData({
                        ...formData,
                        [documentType === 'invoice' ? 'dueDate' : 'validUntil']: e.target.value
                      })}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-base font-semibold">Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item) => (
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
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                            min="1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Rate ($)</Label>
                          <Input
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Amount</Label>
                          <Input
                            type="number"
                            value={item.amount.toFixed(2)}
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
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total:</span>
                      <span className="text-xl font-bold">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder={`Additional notes or ${documentType === 'invoice' ? 'payment instructions' : 'terms and conditions'}`}
                    rows={3}
                  />
                </div>

                <Button onClick={handleCreateDocument} className="w-full" size="lg">
                  Create {documentType === 'invoice' ? 'Invoice' : 'Quote'}
                </Button>
              </CardContent>
            </Card>
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
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Button variant="outline" size="sm">
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
                <CardHeader>
                  <CardTitle>Products & Services</CardTitle>
                  <CardDescription>{products.length} items in catalog</CardDescription>
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
                <CardHeader>
                  <CardTitle>Suppliers</CardTitle>
                  <CardDescription>{suppliers.length} suppliers in your network</CardDescription>
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
                <CardHeader>
                  <CardTitle>Recent Expenses</CardTitle>
                  <CardDescription>{expenses.length} expenses recorded</CardDescription>
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
                <CardHeader>
                  <CardTitle>Regular Outgoings</CardTitle>
                  <CardDescription>{outgoings.length} recurring payments</CardDescription>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Add Bank Account
                  </CardTitle>
                  <CardDescription>Connect your business bank accounts</CardDescription>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    Connect Bank Feed
                  </CardTitle>
                  <CardDescription>Automatically import transactions from UK banks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ukBanks.map((bank) => (
                      <div key={bank.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{bank.logo}</span>
                          <div>
                            <p className="font-medium">{bank.name}</p>
                            <p className="text-sm text-gray-600">{bank.status}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => connectBankFeed(bank.id)}
                          disabled={isSyncing && selectedBank === bank.id}
                        >
                          {isSyncing && selectedBank === bank.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Landmark className="h-4 w-4 mr-2" />
                              Connect
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => syncBankAccount(account.id)}
                                disabled={isSyncing}
                              >
                                <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                                Sync
                              </Button>
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
        </Tabs>
      </div>
    </div>
  );
};

export default BusinessFinanceAssistant;
