import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserSettings } from '@/hooks/useUserSettings';
import { formatCurrency } from '@/utils/currencyUtils';
import { Plus, Calendar, DollarSign, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Updated interface to match database schema
interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string | null;
  contact_id: string | null;
  probability: number | null;
  close_date: string | null;
  user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DealsViewProps {
  deals: Deal[];
  onAddDeal?: (dealData: Partial<Deal>) => Promise<Deal | undefined>;
  onUpdateDeal?: (dealId: string, dealData: Partial<Deal>) => Promise<Deal | undefined>;
  onDeleteDeal?: (dealId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const DealsView = ({ deals, onAddDeal, onUpdateDeal, onDeleteDeal, onRefresh }: DealsViewProps) => {
  const { toast } = useToast();
  const { settings } = useUserSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    stage: 'prospecting',
    probability: '50',
    close_date: '',
    notes: ''
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    value: '',
    stage: 'prospecting',
    probability: '50',
    close_date: '',
    notes: ''
  });

  const stageColumns = [
    { id: 'prospecting', title: 'Prospecting', color: 'bg-gray-100' },
    { id: 'qualification', title: 'Qualification', color: 'bg-blue-100' },
    { id: 'proposal', title: 'Proposal', color: 'bg-yellow-100' },
    { id: 'negotiation', title: 'Negotiation', color: 'bg-orange-100' },
    { id: 'closed', title: 'Closed Won', color: 'bg-green-100' }
  ];

  const handleAddDeal = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Deal title is required",
        variant: "destructive"
      });
      return;
    }

    const dealData = {
      ...formData,
      value: formData.value ? parseFloat(formData.value) : 0,
      probability: parseInt(formData.probability)
    };

    const result = await onAddDeal?.(dealData);
    if (result) {
      setIsDialogOpen(false);
      setFormData({
        title: '',
        value: '',
        stage: 'prospecting',
        probability: '50',
        close_date: '',
        notes: ''
      });
      await onRefresh?.();
    }
  };

  const handleEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setEditFormData({
      title: deal.title || '',
      value: deal.value?.toString() || '',
      stage: deal.stage || 'prospecting',
      probability: deal.probability?.toString() || '50',
      close_date: deal.close_date || '',
      notes: deal.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateDeal = async () => {
    if (!editingDeal || !editFormData.title.trim()) {
      toast({
        title: "Error",
        description: "Deal title is required",
        variant: "destructive"
      });
      return;
    }

    const dealData = {
      ...editFormData,
      value: editFormData.value ? parseFloat(editFormData.value) : 0,
      probability: parseInt(editFormData.probability)
    };

    const result = await onUpdateDeal?.(editingDeal.id, dealData);
    if (result) {
      setIsEditDialogOpen(false);
      setEditingDeal(null);
      await onRefresh?.();
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (window.confirm('Are you sure you want to delete this deal?')) {
      await onDeleteDeal?.(dealId);
      await onRefresh?.();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Deal Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sales Pipeline</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Deal Title *" 
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <Input 
                placeholder="Deal Value ($)" 
                type="number" 
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
              <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecting</SelectItem>
                  <SelectItem value="qualification">Qualification</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed">Closed Won</SelectItem>
                </SelectContent>
              </Select>
              <Input 
                placeholder="Probability (%)" 
                type="number" 
                min="0" 
                max="100"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
              />
              <Input 
                placeholder="Expected Close Date" 
                type="date" 
                value={formData.close_date}
                onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
              />
              <Input 
                placeholder="Notes (optional)" 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
              <Button className="w-full" onClick={handleAddDeal}>
                Add Deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Deal Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Deal Title *" 
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
              <Input 
                placeholder="Deal Value ($)" 
                type="number" 
                value={editFormData.value}
                onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
              />
              <Select value={editFormData.stage} onValueChange={(value) => setEditFormData({ ...editFormData, stage: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecting</SelectItem>
                  <SelectItem value="qualification">Qualification</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed">Closed Won</SelectItem>
                </SelectContent>
              </Select>
              <Input 
                placeholder="Probability (%)" 
                type="number" 
                min="0" 
                max="100"
                value={editFormData.probability}
                onChange={(e) => setEditFormData({ ...editFormData, probability: e.target.value })}
              />
              <Input 
                placeholder="Expected Close Date" 
                type="date" 
                value={editFormData.close_date}
                onChange={(e) => setEditFormData({ ...editFormData, close_date: e.target.value })}
              />
              <Input 
                placeholder="Notes (optional)" 
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              />
              <Button className="w-full" onClick={handleUpdateDeal}>
                Update Deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Kanban View */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {stageColumns.map(stage => (
          <div key={stage.id} className={`${stage.color} rounded-lg p-4 min-h-[600px]`}>
            <h3 className="font-semibold mb-4 flex items-center justify-between">
              {stage.title}
              <Badge variant="secondary">
                {deals.filter(deal => deal.stage === stage.id).length}
              </Badge>
            </h3>
            <div className="space-y-3">
              {deals
                .filter(deal => deal.stage === stage.id)
                .map(deal => (
                  <Card key={deal.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{deal.title}</h4>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleEditDeal(deal)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Deal
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteDeal(deal.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Deal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {deal.contact_id ? `Contact ID: ${deal.contact_id}` : 'No contact assigned'}
                      </p>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-green-600">
                          {formatCurrency(deal.value || 0, settings?.currency_code || 'USD')}
                        </span>
                        <Badge variant="outline">{deal.probability || 0}%</Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        Close: {deal.close_date ? new Date(deal.close_date).toLocaleDateString() : 'No date set'}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DealsView;