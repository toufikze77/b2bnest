import React, { useState, useEffect } from 'react';
import { Plus, Minus, TrendingUp, TrendingDown, DollarSign, Calendar, Zap, Pencil, Trash2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUserSettings } from '@/hooks/useUserSettings';
import { formatCurrencyWithLocale } from '@/utils/currencyUtils';

interface CashFlowEntry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  date: Date;
}

const incomeCategories = [
  'Sales Revenue', 'Service Revenue', 'Investment', 'Loan', 'Grant', 'Other Income'
];

const expenseCategories = [
  'Office Rent', 'Marketing', 'Software/Tools', 'Utilities', 'Salaries', 'Travel',
  'Equipment', 'Legal/Professional', 'Insurance', 'Other Expenses'
];

const CashFlowTracker = () => {
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [newEntry, setNewEntry] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    type: 'income' | 'expense';
    category: string;
    description: string;
    amount: number;
    date: string;
  } | null>(null);
  const { toast } = useToast();
  const { settings } = useUserSettings();
  const currencyCode = settings?.currency_code || 'USD';

  const formatCurrency = (amount: number) => formatCurrencyWithLocale(amount, currencyCode);

  const addEntry = () => {
    if (!newEntry.category || !newEntry.description || newEntry.amount <= 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields with valid amounts.",
        variant: "destructive"
      });
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const entryDate = new Date(newEntry.date);
    if (entryDate < thirtyDaysAgo) {
      toast({
        title: "Date Limitation",
        description: "Free plan only tracks the last 30 days. Upgrade for unlimited history.",
        variant: "destructive"
      });
      return;
    }

    const entry: CashFlowEntry = {
      id: Date.now().toString(),
      type: newEntry.type,
      category: newEntry.category,
      description: newEntry.description,
      amount: newEntry.amount,
      date: entryDate
    };

    setEntries(prev => [entry, ...prev].slice(0, 50));
    setNewEntry({
      type: 'income',
      category: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0]
    });

    toast({
      title: "Entry Added",
      description: `${entry.type === 'income' ? 'Income' : 'Expense'} of ${formatCurrency(entry.amount)} recorded.`
    });
  };

  const startEdit = (entry: CashFlowEntry) => {
    setEditingId(entry.id);
    setEditDraft({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      date: entry.date.toISOString().split('T')[0]
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = (id: string) => {
    if (!editDraft) return;
    if (!editDraft.category || !editDraft.description || editDraft.amount <= 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields with valid amounts.",
        variant: "destructive"
      });
      return;
    }
    setEntries(prev => prev.map(e => e.id === id ? {
      ...e,
      type: editDraft.type,
      category: editDraft.category,
      description: editDraft.description,
      amount: editDraft.amount,
      date: new Date(editDraft.date)
    } : e));
    setEditingId(null);
    setEditDraft(null);
    toast({ title: "Entry Updated", description: "Your changes have been saved." });
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    if (editingId === id) cancelEdit();
    toast({ title: "Entry Deleted", description: "The transaction has been removed." });
  };

  const getFilteredEntries = (days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return entries.filter(entry => entry.date >= cutoffDate);
  };

  const calculateTotals = (filteredEntries: CashFlowEntry[]) => {
    const income = filteredEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expenses = filteredEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expenses, netFlow: income - expenses };
  };

  const last30Days = getFilteredEntries(30);
  const last7Days = getFilteredEntries(7);
  const totals30 = calculateTotals(last30Days);
  const totals7 = calculateTotals(last7Days);

  const getCategoryTotals = (type: 'income' | 'expense') => {
    const categoryMap = new Map<string, number>();
    last30Days.filter(e => e.type === type).forEach(e => {
      categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + e.amount);
    });
    return Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cash Flow Tracker</h1>
        <p className="text-muted-foreground">Monitor your business income and expenses</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="secondary">Free Plan: Last 30 days • 50 entries max</Badge>
          <Badge variant="outline">Currency: {currencyCode}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">30-Day Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-green-600 flex items-center gap-1"><TrendingUp className="h-4 w-4" />Income</span>
                <span className="font-semibold text-green-600">{formatCurrency(totals30.income)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600 flex items-center gap-1"><TrendingDown className="h-4 w-4" />Expenses</span>
                <span className="font-semibold text-red-600">{formatCurrency(totals30.expenses)}</span>
              </div>
              <hr />
              <div className="flex justify-between items-center font-bold">
                <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />Net Flow</span>
                <span className={totals30.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(totals30.netFlow)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">7-Day Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-green-600">Income</span>
                <span className="font-semibold text-green-600">{formatCurrency(totals7.income)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600">Expenses</span>
                <span className="font-semibold text-red-600">{formatCurrency(totals7.expenses)}</span>
              </div>
              <hr />
              <div className="flex justify-between items-center font-bold">
                <span>Net Flow</span>
                <span className={totals7.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(totals7.netFlow)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Add Entry</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button variant={newEntry.type === 'income' ? 'default' : 'outline'} size="sm" onClick={() => setNewEntry(p => ({ ...p, type: 'income' }))} className="flex-1">
                  <Plus className="h-3 w-3 mr-1" />Income
                </Button>
                <Button variant={newEntry.type === 'expense' ? 'default' : 'outline'} size="sm" onClick={() => setNewEntry(p => ({ ...p, type: 'expense' }))} className="flex-1">
                  <Minus className="h-3 w-3 mr-1" />Expense
                </Button>
              </div>

              <select
                className="w-full p-2 text-sm border border-input bg-background rounded-md"
                value={newEntry.category}
                onChange={(e) => setNewEntry(p => ({ ...p, category: e.target.value }))}
              >
                <option value="">Select category</option>
                {(newEntry.type === 'income' ? incomeCategories : expenseCategories).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <Input placeholder="Description" value={newEntry.description} onChange={(e) => setNewEntry(p => ({ ...p, description: e.target.value }))} className="text-sm" />
              <Input type="number" placeholder="Amount" value={newEntry.amount || ''} onChange={(e) => setNewEntry(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="text-sm" />
              <Input type="date" value={newEntry.date} onChange={(e) => setNewEntry(p => ({ ...p, date: e.target.value }))} className="text-sm" />

              <Button onClick={addEntry} className="w-full" size="sm">Add Entry</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="entries">Recent Entries</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No entries yet. Add your first transaction above!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.slice(0, 20).map((entry) => {
                    const isEditing = editingId === entry.id;
                    if (isEditing && editDraft) {
                      return (
                        <div key={entry.id} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                          <div className="flex gap-2">
                            <Button variant={editDraft.type === 'income' ? 'default' : 'outline'} size="sm" onClick={() => setEditDraft(d => d && ({ ...d, type: 'income', category: '' }))} className="flex-1">
                              <Plus className="h-3 w-3 mr-1" />Income
                            </Button>
                            <Button variant={editDraft.type === 'expense' ? 'default' : 'outline'} size="sm" onClick={() => setEditDraft(d => d && ({ ...d, type: 'expense', category: '' }))} className="flex-1">
                              <Minus className="h-3 w-3 mr-1" />Expense
                            </Button>
                          </div>
                          <select
                            className="w-full p-2 text-sm border border-input bg-background rounded-md"
                            value={editDraft.category}
                            onChange={(e) => setEditDraft(d => d && ({ ...d, category: e.target.value }))}
                          >
                            <option value="">Select category</option>
                            {(editDraft.type === 'income' ? incomeCategories : expenseCategories).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <Input value={editDraft.description} onChange={(e) => setEditDraft(d => d && ({ ...d, description: e.target.value }))} placeholder="Description" />
                          <Input type="number" value={editDraft.amount || ''} onChange={(e) => setEditDraft(d => d && ({ ...d, amount: parseFloat(e.target.value) || 0 }))} placeholder="Amount" />
                          <Input type="date" value={editDraft.date} onChange={(e) => setEditDraft(d => d && ({ ...d, date: e.target.value }))} />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={cancelEdit}><X className="h-4 w-4 mr-1" />Cancel</Button>
                            <Button size="sm" onClick={() => saveEdit(entry.id)}><Check className="h-4 w-4 mr-1" />Save</Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.type === 'income' ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                            <span className="font-semibold">{entry.description}</span>
                            <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{entry.date.toLocaleDateString()}</div>
                        </div>
                        <div className={`text-lg font-semibold whitespace-nowrap ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(entry)} aria-label="Edit entry">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteEntry(entry.id)} aria-label="Delete entry">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600"><TrendingUp className="h-5 w-5" />Top Income Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getCategoryTotals('income').map(([category, amount]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-sm">{category}</span>
                      <span className="font-semibold text-green-600">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600"><TrendingDown className="h-5 w-5" />Top Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getCategoryTotals('expense').map(([category, amount]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-sm">{category}</span>
                      <span className="font-semibold text-red-600">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Need Advanced Cash Flow Management?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Upgrade to get unlimited history, forecasting, multi-currency support, and advanced reporting.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Starter: Unlimited entries</Badge>
                <Badge variant="outline" className="text-xs">Pro: Forecasting + Reports</Badge>
                <Badge variant="outline" className="text-xs">Enterprise: Multi-currency</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashFlowTracker;
