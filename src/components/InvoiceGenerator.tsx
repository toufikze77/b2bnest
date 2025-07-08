import React, { useState } from 'react';
import { FileText, Plus, Download, Eye, Calendar, DollarSign, Send, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid';
  notes: string;
}

const InvoiceGenerator = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    issueDate: new Date(),
    dueDate: new Date(),
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    notes: '',
    tax: 0
  });
  const { toast } = useToast();

  const generateInvoiceNumber = () => {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${year}${month}-${random}`;
  };

  const calculateItemAmount = (quantity: number, rate: number) => {
    return quantity * rate;
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    if (!newInvoice.items) return;
    
    const updatedItems = [...newInvoice.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate amount for this item
    if (field === 'quantity' || field === 'rate') {
      updatedItems[index].amount = calculateItemAmount(
        updatedItems[index].quantity,
        updatedItems[index].rate
      );
    }
    
    setNewInvoice(prev => ({ ...prev, items: updatedItems }));
  };

  const addItem = () => {
    if (!newInvoice.items) return;
    setNewInvoice(prev => ({
      ...prev,
      items: [...(prev.items || []), { description: '', quantity: 1, rate: 0, amount: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    if (!newInvoice.items || newInvoice.items.length <= 1) return;
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index) || []
    }));
  };

  const calculateTotals = () => {
    if (!newInvoice.items) return { subtotal: 0, tax: 0, total: 0 };
    
    const subtotal = newInvoice.items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * ((newInvoice.tax || 0) / 100);
    const total = subtotal + taxAmount;
    
    return { subtotal, tax: taxAmount, total };
  };

  const createInvoice = () => {
    if (!newInvoice.clientName?.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter client name.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: 3 invoices per month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.issueDate);
      return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    });

    if (monthlyInvoices.length >= 3) {
      toast({
        title: "Monthly Limit Reached",
        description: "Free plan allows 3 invoices per month. Upgrade for unlimited invoices.",
        variant: "destructive"
      });
      return;
    }

    const totals = calculateTotals();
    const invoice: Invoice = {
      id: Date.now().toString(),
      invoiceNumber: generateInvoiceNumber(),
      clientName: newInvoice.clientName!,
      clientEmail: newInvoice.clientEmail || '',
      clientAddress: newInvoice.clientAddress || '',
      issueDate: newInvoice.issueDate || new Date(),
      dueDate: newInvoice.dueDate || new Date(),
      items: newInvoice.items || [],
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status: 'draft',
      notes: newInvoice.notes || ''
    };

    setInvoices(prev => [invoice, ...prev]);
    setNewInvoice({
      clientName: '',
      clientEmail: '',
      clientAddress: '',
      issueDate: new Date(),
      dueDate: new Date(),
      items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
      notes: '',
      tax: 0
    });
    setIsCreating(false);

    toast({
      title: "Invoice Created",
      description: `Invoice ${invoice.invoiceNumber} has been created successfully.`
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getMonthlyCount = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return invoices.filter(inv => {
      const invDate = new Date(inv.issueDate);
      return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    }).length;
  };

  const totals = calculateTotals();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Invoice Generator</h1>
        <p className="text-gray-600">Create professional invoices for your clients</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: 3 invoices per month
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {getMonthlyCount()}/3
                </div>
                <p className="text-gray-600 text-sm">Invoices Used</p>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.total, 0))}
                </div>
                <p className="text-gray-600 text-sm">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Invoice Button */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Create New Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setIsCreating(true)}
              className="w-full"
              disabled={getMonthlyCount() >= 3}
            >
              <Plus className="h-4 w-4 mr-2" />
              {getMonthlyCount() >= 3 ? 'Monthly Limit Reached' : 'Create Invoice'}
            </Button>
            {getMonthlyCount() >= 3 && (
              <p className="text-sm text-orange-600 mt-2 text-center">
                Upgrade to create unlimited invoices
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Creation Form */}
      {isCreating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              New Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Client Name *</label>
                <Input
                  placeholder="Client Name"
                  value={newInvoice.clientName || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, clientName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Client Email</label>
                <Input
                  placeholder="client@example.com"
                  value={newInvoice.clientEmail || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, clientEmail: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Client Address</label>
              <Textarea
                placeholder="Client Address"
                value={newInvoice.clientAddress || ''}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, clientAddress: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Issue Date</label>
                <Input
                  type="date"
                  value={newInvoice.issueDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, issueDate: new Date(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Due Date</label>
                <Input
                  type="date"
                  value={newInvoice.dueDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: new Date(e.target.value) }))}
                />
              </div>
            </div>

            {/* Invoice Items */}
            <div>
              <label className="text-sm font-medium mb-2 block">Invoice Items</label>
              <div className="space-y-3">
                {newInvoice.items?.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        value={formatCurrency(item.amount)}
                        disabled
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={newInvoice.items?.length === 1}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Tax and Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tax Rate (%)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newInvoice.tax || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>{formatCurrency(totals.tax)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                placeholder="Payment terms, thank you note, etc."
                value={newInvoice.notes || ''}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={createInvoice} className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
              <Button onClick={() => setIsCreating(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No invoices yet. Create your first invoice above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                      <Badge 
                        variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{invoice.clientName}</p>
                      <p>Due: {invoice.dueDate.toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {formatCurrency(invoice.total)}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Need More Invoicing Power?</h4>
              <p className="text-sm text-blue-700 mb-3">
                Upgrade to get unlimited invoices, custom branding, automatic reminders, and payment tracking.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited invoices</Badge>
                <Badge variant="outline" className="text-xs">Pro: Custom branding + Reminders</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Payment integration</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceGenerator;