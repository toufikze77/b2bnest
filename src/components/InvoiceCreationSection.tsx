
import React, { useState } from 'react';
import { Plus, FileText, Calendar, User, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

const InvoiceCreationSection = () => {
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    invoiceDate: '',
    dueDate: '',
    notes: '',
    terms: 'Net 30'
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  const [generating, setGenerating] = useState(false);

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
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

  const generateInvoiceCode = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}${day}-${random}`;
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceData.clientName || !invoiceData.clientEmail) {
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
      // Generate invoice code if not provided
      if (!invoiceData.invoiceNumber) {
        setInvoiceData(prev => ({ ...prev, invoiceNumber: generateInvoiceCode() }));
      }

      // Simulate invoice generation
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: "Invoice Generated",
        description: `Invoice ${invoiceData.invoiceNumber || generateInvoiceCode()} has been created successfully.`,
      });

      // Reset form
      setInvoiceData({
        invoiceNumber: '',
        clientName: '',
        clientEmail: '',
        clientAddress: '',
        invoiceDate: '',
        dueDate: '',
        notes: '',
        terms: 'Net 30'
      });
      setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);

    } catch (error) {
      console.error('Invoice generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Create Invoice</CardTitle>
            <CardDescription>Generate professional invoices with custom codes</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={invoiceData.invoiceNumber}
              onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
              placeholder="Auto-generated if empty"
            />
          </div>
          <div>
            <Label htmlFor="terms">Payment Terms</Label>
            <Select value={invoiceData.terms} onValueChange={(value) => setInvoiceData({...invoiceData, terms: value})}>
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
                value={invoiceData.clientName}
                onChange={(e) => setInvoiceData({...invoiceData, clientName: e.target.value})}
                placeholder="Client or company name"
                required
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Client Email *</Label>
              <Input
                id="clientEmail"
                type="email"
                value={invoiceData.clientEmail}
                onChange={(e) => setInvoiceData({...invoiceData, clientEmail: e.target.value})}
                placeholder="client@example.com"
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="clientAddress">Client Address</Label>
              <Textarea
                id="clientAddress"
                value={invoiceData.clientAddress}
                onChange={(e) => setInvoiceData({...invoiceData, clientAddress: e.target.value})}
                placeholder="Client's billing address"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="invoiceDate">Invoice Date</Label>
            <Input
              id="invoiceDate"
              type="date"
              value={invoiceData.invoiceDate}
              onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={invoiceData.dueDate}
              onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Invoice Items
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
            value={invoiceData.notes}
            onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
            placeholder="Additional notes or payment instructions"
            rows={3}
          />
        </div>

        {/* Generate Button */}
        <div className="flex gap-4">
          <Button 
            onClick={handleGenerateInvoice} 
            className="flex-1"
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Invoice'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceCreationSection;
