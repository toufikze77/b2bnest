import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Save, Send, Edit, X, FileText, Upload, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/currencyUtils';
import ImageUpload from '@/components/ImageUpload';

interface QuoteInvoiceCreationSectionProps {
  documentType: 'quote' | 'invoice';
  onDocumentSaved: () => void;
  editingDocument?: any;
  onEditComplete?: () => void;
  onCancelEdit?: () => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

const QuoteInvoiceCreationSection: React.FC<QuoteInvoiceCreationSectionProps> = ({
  documentType,
  onDocumentSaved,
  editingDocument,
  onEditComplete,
  onCancelEdit
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [logoUrl, setLogoUrl] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_address: '',
    company_name: '',
    company_address: '',
    notes: '',
    tax_rate: '0',
    valid_until: '',
    due_date: '',
    status: 'draft',
    logo_url: ''
  });

  const [items, setItems] = useState([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, [user]);

  const loadProducts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('products_services')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Load editing document data
  useEffect(() => {
    if (editingDocument) {
      setFormData({
        client_name: editingDocument.client_name || '',
        client_email: editingDocument.client_email || '',
        client_address: editingDocument.client_address || '',
        company_name: editingDocument.company_name || '',
        company_address: editingDocument.company_address || '',
        notes: editingDocument.notes || '',
        tax_rate: String(editingDocument.tax_rate || 0),
        valid_until: editingDocument.valid_until || '',
        due_date: editingDocument.due_date || '',
        status: editingDocument.status || 'draft',
        logo_url: editingDocument.logo_url || ''
      });
      
      setLogoUrl(editingDocument.logo_url || '');
      
      // Set draft checkbox based on current status
      setSaveAsDraft(editingDocument.status === 'draft');
      
      if (editingDocument.items && Array.isArray(editingDocument.items)) {
        setItems(editingDocument.items.map((item: any, index: number) => ({
          id: String(index + 1),
          description: item.description || '',
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: item.amount || 0
        })));
      }
    } else {
      // Reset form for new document
      resetForm();
    }
  }, [editingDocument]);

  const resetForm = () => {
    setFormData({
      client_name: '',
      client_email: '',
      client_address: '',
      company_name: '',
      company_address: '',
      notes: '',
      tax_rate: '0',
      valid_until: '',
      due_date: '',
      status: 'draft',
      logo_url: ''
    });
    setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);
    setSaveAsDraft(true);
    setLogoUrl('');
  };

  const calculateItemAmount = (quantity: number, rate: number) => {
    return quantity * rate;
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = calculateItemAmount(updated.quantity, updated.rate);
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    const newId = String(items.length + 1);
    setItems(prev => [...prev, {
      id: newId,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }]);
  };

  const addProductAsItem = (product: Product) => {
    const newId = String(items.length + 1);
    setItems(prev => [...prev, {
      id: newId,
      description: product.name + (product.description ? ` - ${product.description}` : ''),
      quantity: 1,
      rate: product.price,
      amount: product.price
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * Number(formData.tax_rate)) / 100;
    const total = subtotal + taxAmount;
    
    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const handleSubmit = async () => {
    if (!user) return;
    
    // Basic validation
    if (!formData.client_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Client name is required",
        variant: "destructive"
      });
      return;
    }

    if (items.some(item => !item.description.trim())) {
      toast({
        title: "Validation Error", 
        description: "All items must have a description",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const documentData = {
        user_id: user.id,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_address: formData.client_address,
        company_name: formData.company_name,
        company_address: formData.company_address,
        items: items,
        subtotal: subtotal,
        tax_rate: Number(formData.tax_rate),
        tax_amount: taxAmount,
        total_amount: total,
        notes: formData.notes,
        status: saveAsDraft ? 'draft' : 'sent',
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
        ...(documentType === 'quote' && {
          valid_until: formData.valid_until || null,
          quote_number: editingDocument?.quote_number || `Q-${Date.now()}`
        }),
        ...(documentType === 'invoice' && {
          due_date: formData.due_date || null,
          invoice_number: editingDocument?.invoice_number || `INV-${Date.now()}`
        })
      };

      let result;
      if (editingDocument) {
        // Update existing document
        const { data, error } = await supabase
          .from(documentType === 'quote' ? 'quotes' : 'invoices')
          .update(documentData)
          .eq('id', editingDocument.id)
          .select()
          .single();
        result = { data, error };
      } else {
        // Create new document
        const { data, error } = await supabase
          .from(documentType === 'quote' ? 'quotes' : 'invoices')
          .insert([documentData])
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) throw result.error;

      const action = editingDocument ? 'updated' : 'created';
      const status = saveAsDraft ? 'draft' : 'sent';
      toast({
        title: "Success",
        description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} ${action} as ${status}`
      });
      
      onDocumentSaved();
      if (editingDocument && onEditComplete) {
        onEditComplete();
      }

      // Reset form if creating new document
      if (!editingDocument) {
        resetForm();
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Error",
        description: "Failed to save document",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!editingDocument || !user) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from(documentType === 'quote' ? 'quotes' : 'invoices')
        .update({ 
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingDocument.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} reverted to draft`
      });
      setSaveAsDraft(true);
      onDocumentSaved();
    } catch (error) {
      console.error('Error reverting to draft:', error);
      toast({
        title: "Error",
        description: "Failed to revert to draft",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isEditing = !!editingDocument;
  const documentTitle = isEditing 
    ? `Edit ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}` 
    : `Create ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}`;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>{documentTitle}</CardTitle>
              <CardDescription>
                {isEditing ? 'Update your existing document' : 'Generate professional quotes and invoices'}
              </CardDescription>
            </div>
          </div>
          {isEditing && (
            <div className="flex items-center gap-2">
              <Badge variant={editingDocument.status === 'draft' ? 'secondary' : 'default'}>
                {editingDocument.status}
              </Badge>
              {onCancelEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancelEdit}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Client Information</h3>
            <div>
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Enter client name"
                required
              />
            </div>
            <div>
              <Label htmlFor="client_email">Client Email</Label>
              <Input
                id="client_email"
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData(prev => ({ ...prev, client_email: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>
            <div>
              <Label htmlFor="client_address">Client Address</Label>
              <Textarea
                id="client_address"
                value={formData.client_address}
                onChange={(e) => setFormData(prev => ({ ...prev, client_address: e.target.value }))}
                placeholder="Enter client address"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Information</h3>
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Your company name"
              />
            </div>
            <div>
              <Label htmlFor="company_address">Company Address</Label>
              <Textarea
                id="company_address"
                value={formData.company_address}
                onChange={(e) => setFormData(prev => ({ ...prev, company_address: e.target.value }))}
                placeholder="Your company address"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Document Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentType === 'quote' && (
            <div>
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>
          )}
          {documentType === 'invoice' && (
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* Logo Upload */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Company Logo</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            <ImageUpload
              onImageUploaded={(url) => {
                setLogoUrl(url);
                setFormData(prev => ({ ...prev, logo_url: url }));
              }}
              bucket="user-avatars"
              currentImageUrl={logoUrl}
              accept="image/*"
              maxSize={5}
              className="w-full"
              label="Upload Company Logo"
            />
            {logoUrl && (
              <div className="mt-2">
                <img src={logoUrl} alt="Company Logo" className="h-16 w-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Items</h3>
            <div className="flex gap-2">
              {products.length > 0 && (
                <Select onValueChange={(value) => {
                  const product = products.find(p => p.id === value);
                  if (product) addProductAsItem(product);
                }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select product/service" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>{product.name} - {formatCurrency(product.price)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={addItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  <Label htmlFor={`desc-${item.id}`}>Description *</Label>
                  <Input
                    id={`desc-${item.id}`}
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                  <Input
                    id={`qty-${item.id}`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`rate-${item.id}`}>Rate</Label>
                  <Input
                    id={`rate-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`amount-${item.id}`}>Amount</Label>
                  <Input
                    id={`amount-${item.id}`}
                    value={formatCurrency(item.amount)}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    onClick={() => removeItem(item.id)}
                    variant="outline"
                    size="sm"
                    disabled={items.length === 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {Number(formData.tax_rate) > 0 && (
            <div className="flex justify-between text-sm">
              <span>Tax ({formData.tax_rate}%):</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes or terms"
            rows={3}
          />
        </div>

        {/* Draft Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="save-as-draft"
            checked={saveAsDraft}
            onCheckedChange={(checked) => setSaveAsDraft(checked as boolean)}
          />
          <Label htmlFor="save-as-draft" className="text-sm font-medium">
            Save as draft (not sent to client)
          </Label>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {isEditing && editingDocument.status === 'sent' && (
            <Button
              onClick={handleRevertToDraft}
              variant="outline"
              disabled={isLoading}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Revert to Draft
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1"
          >
            {saveAsDraft ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving Draft...' : isEditing ? 'Update Draft' : 'Save as Draft'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {isLoading ? 'Saving & Sending...' : isEditing ? 'Update & Send' : 'Save & Send'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteInvoiceCreationSection;