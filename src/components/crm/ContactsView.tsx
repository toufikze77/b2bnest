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
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { currencySymbol, formatMoney } from '@/lib/money';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DataTable } from '@/components/data/DataTable';
import { StatusBadge } from '@/components/data/StatusBadge';
import { formatDueDate } from '@/lib/dashboardData';
import ContactsImportExport from './ContactsImportExport';
import { Textarea } from '@/components/ui/textarea';
import { extractLinkedIn, isUsableEmail } from '@/lib/crmContactsExcel';
import { contactStatus, contactStatusCounts } from '@/lib/crmContactCounts';
import { usePhone } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

const NoEmail = () => <span className="text-muted-foreground">Email unavailable — not verified</span>;
const EmailLink = ({ email }: { email: string | null }) => isUsableEmail(email) ? <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a> : <NoEmail />;
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
  /** The CRM page band shows Import / Export and Add contact, so the toolbar copies are hidden. */
  actionsInHeader?: boolean;
  /** Controlled Add contact dialog (opened from the page band). */
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
}

const initials = (name: string) => name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Leads' },
  { value: 'prospect', label: 'Prospects' },
  { value: 'customer', label: 'Customers' },
] as const;
const PHONE_PAGE = 25;

const ContactsView = ({ contacts, statusColors, onAddContact, onUpdateContact, onDeleteContact, onRefresh, actionsInHeader = false, addOpen, onAddOpenChange }: ContactsViewProps) => {
  const { toast } = useToast();
  // Contacts have no currency column: values are shown in the account currency (plain number if it is not set).
  const accountCurrency = useAccountCurrency();
  const valueLabel = `Potential value${currencySymbol(accountCurrency) ? ` (${currencySymbol(accountCurrency)})` : ''}`;
  const phone = usePhone();
  const [phoneShown, setPhoneShown] = useState(PHONE_PAGE);
  const [localAddOpen, setLocalAddOpen] = useState(false);
  const isDialogOpen = addOpen ?? localAddOpen;
  const setIsDialogOpen = (open: boolean) => { setLocalAddOpen(open); onAddOpenChange?.(open); };
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState<Contact | null>(null);
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
    const matchesStatus = statusFilter === 'all' || contactStatus(contact) === statusFilter;
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

    if (formData.email.trim() && !isUsableEmail(formData.email)) {
      toast({ title: "Error", description: "Enter a real email address or leave it blank.", variant: "destructive" });
      return;
    }
    const contactData = {
      ...formData,
      email: formData.email.trim() || null,
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

    if (editFormData.email.trim() && !isUsableEmail(editFormData.email)) {
      toast({ title: "Error", description: "Enter a real email address or leave it blank. Keep research notes in Notes.", variant: "destructive" });
      return;
    }
    const contactData = {
      ...editFormData,
      email: editFormData.email.trim() || null,
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
    if (isUsableEmail(contact.email)) score += 20;
    if (contact.phone) score += 20;
    if (contact.company) score += 15;
    if (contact.position) score += 15;
    if (contact.value && contact.value > 0) score += 30;
    return Math.min(score, 100);
  };

  const contactActions = (contact: Contact) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-9 md:w-9" aria-label={`Actions for ${contact.name}`}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewing(contact)}>View details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEditContact(contact)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Contact
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDeleteContact(contact.id)} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const counts = contactStatusCounts(contacts);
  const money = (v: number | null) => (v == null ? '—' : formatMoney(v, accountCurrency));
  const lastContact = (c: Contact) => (c.last_contact ? formatDueDate(c.last_contact) : '—');
  const filtered = !!searchTerm || statusFilter !== 'all';
  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all'); setPhoneShown(PHONE_PAGE); };
  const setFilter = (v: string) => { setStatusFilter(v); setPhoneShown(PHONE_PAGE); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end items-center gap-3">
        <div className={cn('flex flex-wrap gap-2', actionsInHeader && 'hidden')}>
        {!actionsInHeader && <ContactsImportExport contacts={contacts} onImported={onRefresh} />}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {!actionsInHeader && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
          )}
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
                placeholder={valueLabel} aria-label={valueLabel} 
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
        </div>

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
                placeholder={valueLabel} aria-label={valueLabel} 
                type="number" 
                value={editFormData.value}
                onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
              />
              <Input 
                placeholder="Lead Source" 
                value={editFormData.source}
                onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
              />
              <Textarea
                placeholder="Notes"
                rows={6}
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              />
              {extractLinkedIn(editFormData.notes) && (
                <p className="text-xs text-muted-foreground">LinkedIn profile (from notes): <a href={extractLinkedIn(editFormData.notes)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{extractLinkedIn(editFormData.notes)}</a></p>
              )}
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

      {/* Summary row — counted from the contacts loaded on this page */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Contact summary">
        {[
          { label: 'All contacts', value: counts.all },
          { label: 'Leads', value: counts.lead },
          { label: 'Prospects', value: counts.prospect },
          { label: 'Customers', value: counts.customer },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-card border border-border bg-card p-4">
            <p className="text-small font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="contacts-heading" className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="contacts-heading" className="text-card-title">Contacts</h2>
            <p className="text-small text-muted-foreground">Your contacts — records you created. They aren't shared as company records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-0">
            <div className="relative w-full md:w-72">
              <Search aria-hidden className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search your contacts"
                placeholder="Search name, email or company"
                className="h-11 pl-10 md:h-10"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPhoneShown(PHONE_PAGE); }}
              />
            </div>
            {!phone && (
              <Select value={statusFilter} onValueChange={setFilter}>
                <SelectTrigger className="w-40" aria-label="Status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="lead">Leads</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {phone && (
          <div role="group" aria-label="Filter by status" className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
            {STATUS_FILTERS.map((f) => {
              const n = f.value === 'all' ? counts.all : counts[f.value];
              const on = statusFilter === f.value;
              return (
                <button key={f.value} type="button" aria-pressed={on} onClick={() => setFilter(f.value)}
                  className={cn('min-h-touch shrink-0 rounded-full border px-4 text-body font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted')}>
                  {f.label} <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className="px-4 pt-3 text-small text-muted-foreground" aria-live="polite">
          {filtered ? `Showing ${filteredContacts.length} of ${contacts.length} contacts` : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}
        </p>

        {phone ? (
          filteredContacts.length === 0 ? (
            <div className="p-4">
              {filtered
                ? <div className="rounded-control border border-dashed p-6 text-center text-body text-muted-foreground">No contacts match. <button type="button" onClick={clearFilters} className="font-semibold text-link underline">Clear filters</button></div>
                : <p className="rounded-control border border-dashed p-6 text-center text-body text-muted-foreground">No contacts yet. Use “Add contact” to create your first one.</p>}
            </div>
          ) : (
            <>
              <ul aria-label="Your contacts" className="divide-y divide-border">
                {[...filteredContacts].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })).slice(0, phoneShown).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => setViewing(c)} className="flex min-h-touch min-w-0 flex-1 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                      <Avatar className="h-10 w-10 shrink-0"><AvatarFallback className="bg-primary/10 text-small font-bold text-link">{initials(c.name)}</AvatarFallback></Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">{c.name}</span>
                        <span className="block truncate text-small text-muted-foreground">{[c.position, c.company].filter(Boolean).join(' · ') || 'No company'}</span>
                        <span className="block text-small text-muted-foreground">Last contact: {lastContact(c)}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge value={contactStatus(c)} prefix="Status" />
                        <span className="text-small font-semibold tabular-nums text-foreground">{money(c.value)}</span>
                      </span>
                    </button>
                    {contactActions(c)}
                  </li>
                ))}
              </ul>
              {filteredContacts.length > phoneShown && (
                <div className="p-4"><Button variant="outline" className="min-h-touch w-full" onClick={() => setPhoneShown((n) => n + PHONE_PAGE)}>Show more ({filteredContacts.length - phoneShown} left)</Button></div>
              )}
            </>
          )
        ) : (
          <div className="p-4 pt-3">
            <DataTable
              caption="Your contacts"
              rows={filteredContacts}
              rowKey={(c) => c.id}
              filtered={filtered}
              onClearFilters={clearFilters}
              empty={<p className="rounded-control border border-dashed p-8 text-center text-sm text-muted-foreground">No contacts yet. Use “Add contact” to create your first one.</p>}
              initialSort={{ id: 'name', dir: 'asc' }}
              columns={[
                { id: 'name', header: 'Name', sortValue: (c) => c.name, cell: (c) => (
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="bg-primary/10 text-small font-bold text-link">{initials(c.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0">
                      <button type="button" onClick={() => setViewing(c)} className="block max-w-[16rem] truncate rounded-sm text-left font-semibold text-foreground hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{c.name}</button>
                      <span className="block max-w-[16rem] truncate text-small text-muted-foreground">{[c.position, c.company].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                  </span>
                ) },
                { id: 'status', header: 'Status', sortValue: (c) => contactStatus(c), cell: (c) => <StatusBadge value={contactStatus(c)} prefix="Status" /> },
                { id: 'email', header: 'Email', sortValue: (c) => c.email, cell: (c) => <EmailLink email={c.email} /> },
                { id: 'phone', header: 'Phone', sortValue: (c) => c.phone, cell: (c) => c.phone ? <a className="whitespace-nowrap text-link hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : <span className="text-muted-foreground">—</span> },
                { id: 'last', header: 'Last contact', sortValue: (c) => c.last_contact, cell: (c) => <span className="whitespace-nowrap text-muted-foreground">{lastContact(c)}</span> },
                { id: 'value', header: 'Value', className: 'text-right', sortValue: (c) => c.value ?? 0, cell: (c) => <span className="tabular-nums">{money(c.value)}</span> },
              ]}
              rowActions={contactActions}
            />
          </div>
        )}
      </section>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11"><AvatarFallback>{viewing.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
                  <div className="text-left">
                    <SheetTitle>{viewing.name}</SheetTitle>
                    <SheetDescription>{[viewing.position, viewing.company].filter(Boolean).join(' at ') || 'No company specified'}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <dl className="mt-6 grid grid-cols-[auto,1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Status</dt><dd><StatusBadge value={viewing.status || 'lead'} /></dd>
                <dt className="text-muted-foreground"><Mail className="inline h-4 w-4" aria-hidden /> Email</dt><dd><EmailLink email={viewing.email} /></dd>
                <dt className="text-muted-foreground">LinkedIn</dt><dd>{extractLinkedIn(viewing.notes) ? <a className="text-primary hover:underline break-all" href={extractLinkedIn(viewing.notes)!} target="_blank" rel="noopener noreferrer">{extractLinkedIn(viewing.notes)}</a> : '—'}</dd>
                <dt className="text-muted-foreground"><Phone className="inline h-4 w-4" aria-hidden /> Phone</dt><dd>{viewing.phone ? <a className="text-primary hover:underline" href={`tel:${viewing.phone}`}>{viewing.phone}</a> : '—'}</dd>
                <dt className="text-muted-foreground"><Target className="inline h-4 w-4" aria-hidden /> Source</dt><dd>{viewing.source || '—'}</dd>
                <dt className="text-muted-foreground">Potential value</dt><dd>{viewing.value == null ? '—' : formatMoney(viewing.value, accountCurrency)}</dd>
                <dt className="text-muted-foreground"><Star className="inline h-4 w-4" aria-hidden /> Profile</dt><dd>{calculateEngagementScore(viewing)}% complete</dd>
                <dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{viewing.notes || '—'}</dd>
              </dl>
              <div className="mt-6 flex gap-2">
                <Button onClick={() => { const c = viewing; setViewing(null); handleEditContact(c); }}><Edit className="mr-2 h-4 w-4" />Edit contact</Button>
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ContactsView;