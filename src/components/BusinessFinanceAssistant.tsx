
import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, PieChart, DollarSign, Receipt, FileText, Plus, Minus, Edit3, Trash2, Quote, Upload, Image, X, Eye, Download, Send } from 'lucide-react';
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

const BusinessFinanceAssistant = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'manage'>('dashboard');
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice');
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
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
        </Tabs>
      </div>
    </div>
  );
};

export default BusinessFinanceAssistant;
