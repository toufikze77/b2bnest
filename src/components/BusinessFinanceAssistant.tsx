
import React, { useState } from 'react';
import { Calculator, TrendingUp, PieChart, DollarSign, Receipt, FileText, Plus, Minus, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

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

const BusinessFinanceAssistant = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'manage'>('dashboard');
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice');
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
  
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    date: '',
    dueDate: '',
    validUntil: '',
    notes: '',
    terms: 'Net 30'
  });

  const [items, setItems] = useState<FinanceItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Business Finance Assistant</h1>
            <p className="text-gray-600">Manage invoices, quotes, and financial documents</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Document
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manage Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>

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
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={documentType === 'invoice' ? 'default' : 'outline'}
                    onClick={() => setDocumentType('invoice')}
                    className="h-12"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Invoice
                  </Button>
                  <Button
                    variant={documentType === 'quote' ? 'default' : 'outline'}
                    onClick={() => setDocumentType('quote')}
                    className="h-12"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Quote
                  </Button>
                </div>

                {/* Client Information */}
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
                                <Edit3 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => deleteDocument(doc.id)}
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
        </Tabs>
      </div>
    </div>
  );
};

export default BusinessFinanceAssistant;
