import React, { useState } from 'react';
import { Plus, FileText, Calendar, User, DollarSign, Quote, Upload, Image, X } from 'lucide-react';
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
  const [documentData, setDocumentData] = useState({
    number: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    date: '',
    validUntil: '', // For quotes
    dueDate: '', // For invoices
    notes: '',
    terms: 'Net 30'
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

  const calculateTotal = () => {
    return items.reduce((total, item) => total + item.amount, 0);
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

  const handleGenerate = async () => {
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
      // Generate document code if not provided
      if (!documentData.number) {
        setDocumentData(prev => ({ ...prev, number: generateDocumentCode(activeTab) }));
      }

      // Simulate document generation
      await new Promise(resolve => setTimeout(resolve, 1500));

      const documentType = activeTab === 'quote' ? 'Quote' : 'Invoice';
      toast({
        title: `${documentType} Generated`,
        description: `${documentType} ${documentData.number || generateDocumentCode(activeTab)} has been created successfully.`,
      });

      // Reset form
      setDocumentData({
        number: '',
        clientName: '',
        clientEmail: '',
        clientAddress: '',
        date: '',
        validUntil: '',
        dueDate: '',
        notes: '',
        terms: 'Net 30'
      });
      setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);

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

  const currentDocumentType = activeTab === 'quote' ? 'Quote' : 'Invoice';
  const currentIcon = activeTab === 'quote' ? Quote : FileText;
  const CurrentIcon = currentIcon;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center">
            <CurrentIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Quote & Invoice Generator</CardTitle>
            <CardDescription>Create professional quotes and invoices with custom codes</CardDescription>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <Label className="text-xs">Rate ($)</Label>
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
                          ×
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