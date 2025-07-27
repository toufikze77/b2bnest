import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserSettings } from '@/hooks/useUserSettings';
import { formatCurrency } from '@/utils/currencyUtils';
import { 
  Phone, 
  Mail, 
  Plus,
  Search,
  MoreHorizontal,
  Target,
  Star,
  Edit,
  Trash2
} from 'lucide-react';

// Updated interface to match database schema
interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  status: string | null;
  value: number | null;
  last_contact: string | null;
  source: string | null;
  user_id: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ContactsViewProps {
  contacts: Contact[];
  statusColors: Record<string, string>;
  onAddContact?: (contactData: Partial<Contact>) => Promise<Contact | undefined>;
  onUpdateContact?: (contactId: string, contactData: Partial<Contact>) => Promise<Contact | undefined>;
  onDeleteContact?: (contactId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const ContactsView = ({ contacts, statusColors, onAddContact, onUpdateContact, onDeleteContact, onRefresh }: ContactsViewProps) => {
  const { toast } = useToast();
  const { settings } = useUserSettings();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    value: '',
    source: '',
    status: 'lead'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    value: '',
    source: '',
    status: 'lead',
    notes: ''
  });

  // Filter contacts based on search and status
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddContact = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Contact name is required",
        variant: "destructive"
      });
      return;
    }

    const contactData = {
      ...formData,
      value: formData.value ? parseFloat(formData.value) : 0
    };

    const result = await onAddContact?.(contactData);
    if (result) {
      setIsDialogOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        position: '',
        value: '',
        source: '',
        status: 'lead'
      });
      await onRefresh?.();
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setEditFormData({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      position: contact.position || '',
      value: contact.value?.toString() || '',
      source: contact.source || '',
      status: contact.status || 'lead',
      notes: contact.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !editFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Contact name is required",
        variant: "destructive"
      });
      return;
    }

    const contactData = {
      ...editFormData,
      value: editFormData.value ? parseFloat(editFormData.value) : 0
    };

    const result = await onUpdateContact?.(editingContact.id, contactData);
    if (result) {
      setIsEditDialogOpen(false);
      setEditingContact(null);
      await onRefresh?.();
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      await onDeleteContact?.(contactId);
      await onRefresh?.();
    }
  };

  const calculateEngagementScore = (contact: Contact) => {
    let score = 0;
    if (contact.email) score += 20;
    if (contact.phone) score += 20;
    if (contact.company) score += 15;
    if (contact.position) score += 15;
    if (contact.value && contact.value > 0) score += 30;
    return Math.min(score, 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              placeholder="Search contacts..." 
              className="pl-10 w-80" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Full Name *" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Input 
                placeholder="Email" 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Input 
                placeholder="Phone" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input 
                placeholder="Company" 
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
              <Input 
                placeholder="Position" 
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
              <Input 
                placeholder="Potential Value ($)" 
                type="number" 
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
              <Input 
                placeholder="Lead Source" 
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={handleAddContact}>
                Add Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input 
                placeholder="Full Name *" 
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
              <Input 
                placeholder="Email" 
                type="email" 
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
              <Input 
                placeholder="Phone" 
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
              <Input 
                placeholder="Company" 
                value={editFormData.company}
                onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
              />
              <Input 
                placeholder="Position" 
                value={editFormData.position}
                onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
              />
              <Input 
                placeholder="Potential Value ($)" 
                type="number" 
                value={editFormData.value}
                onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
              />
              <Input 
                placeholder="Lead Source" 
                value={editFormData.source}
                onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
              />
              <Input 
                placeholder="Notes" 
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              />
              <Select value={editFormData.status} onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={handleUpdateContact}>
                Update Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {filteredContacts.map(contact => {
          const engagementScore = calculateEngagementScore(contact);
          return (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                     <div>
                      <h3 className="font-semibold">{contact.name}</h3>
                      <p className="text-sm text-gray-600">
                        {contact.position && contact.company ? `${contact.position} at ${contact.company}` : contact.position || contact.company || 'No company specified'}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {contact.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Mail className="w-4 h-4" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="w-4 h-4" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                      {contact.source && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Target className="w-3 h-3" />
                          Source: {contact.source}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                   <div className="text-right">
                      <p className="font-semibold">{formatCurrency(contact.value || 0, settings?.currency_code || 'USD')}</p>
                      <p className="text-sm text-gray-500">Potential Value</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Star className="w-3 h-3" />
                        Score: {engagementScore}%
                      </div>
                    </div>
                    {contact.status && (
                      <Badge className={`text-white ${statusColors[contact.status] || 'bg-gray-500'}`}>
                        {contact.status}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredContacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || statusFilter !== 'all' ? 'No contacts match your filters' : 'No contacts yet. Add your first contact!'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsView;