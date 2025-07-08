import React, { useState } from 'react';
import { Plus, Minus, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface CashFlowEntry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  date: Date;
}

const CashFlowTracker = () => {
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [newEntry, setNewEntry] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();

  const incomeCategories = [
    'Sales Revenue', 'Service Revenue', 'Investment', 'Loan', 'Grant', 'Other Income'
  ];

  const expenseCategories = [
    'Office Rent', 'Marketing', 'Software/Tools', 'Utilities', 'Salaries', 'Travel', 
    'Equipment', 'Legal/Professional', 'Insurance', 'Other Expenses'
  ];

  const addEntry = () => {
    if (!newEntry.category || !newEntry.description || newEntry.amount <= 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields with valid amounts.",
        variant: "destructive"
      });
      return;
    }

    // Free plan limitation: last 30 days only
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

    setEntries(prev => [entry, ...prev].slice(0, 50)); // Limit to 50 entries for free plan
    setNewEntry({
      type: 'income',
      category: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0]
    });

    toast({
      title: "Entry Added",
      description: `${entry.type === 'income' ? 'Income' : 'Expense'} of $${entry.amount} recorded.`
    });
  };

  const getFilteredEntries = (days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return entries.filter(entry => entry.date >= cutoffDate);
  };

  const calculateTotals = (filteredEntries: CashFlowEntry[]) => {
    const income = filteredEntries
      .filter(entry => entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const expenses = filteredEntries
      .filter(entry => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    return { income, expenses, netFlow: income - expenses };
  };

  const last30Days = getFilteredEntries(30);
  const last7Days = getFilteredEntries(7);
  const totals30 = calculateTotals(last30Days);
  const totals7 = calculateTotals(last7Days);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getCategoryTotals = (type: 'income' | 'expense') => {
    const categoryMap = new Map();
    last30Days
      .filter(entry => entry.type === type)
      .forEach(entry => {
        const current = categoryMap.get(entry.category) || 0;
        categoryMap.set(entry.category, current + entry.amount);
      });
    
    return Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5 categories
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cash Flow Tracker</h1>
        <p className="text-gray-600">Monitor your business income and expenses</p>
        <Badge variant="secondary" className="mt-2">
          Free Plan: Last 30 days • 50 entries max
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">30-Day Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-green-600 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Income
                </span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(totals30.income)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600 flex items-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  Expenses
                </span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(totals30.expenses)}
                </span>
              </div>
              <hr />
              <div className="flex justify-between items-center font-bold">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Net Flow
                </span>
                <span className={totals30.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(totals30.netFlow)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">7-Day Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-green-600">Income</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(totals7.income)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600">Expenses</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(totals7.expenses)}
                </span>
              </div>
              <hr />
              <div className="flex justify-between items-center font-bold">
                <span>Net Flow</span>
                <span className={totals7.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(totals7.netFlow)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add New Entry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={newEntry.type === 'income' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewEntry(prev => ({ ...prev, type: 'income' }))}
                  className="flex-1"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Income
                </Button>
                <Button
                  variant={newEntry.type === 'expense' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewEntry(prev => ({ ...prev, type: 'expense' }))}
                  className="flex-1"
                >
                  <Minus className="h-3 w-3 mr-1" />
                  Expense
                </Button>
              </div>
              
              <select
                className="w-full p-2 text-sm border border-gray-300 rounded-md"
                value={newEntry.category}
                onChange={(e) => setNewEntry(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="">Select category</option>
                {(newEntry.type === 'income' ? incomeCategories : expenseCategories).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              
              <Input
                placeholder="Description"
                value={newEntry.description}
                onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                className="text-sm"
              />
              
              <Input
                type="number"
                placeholder="Amount"
                value={newEntry.amount || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                className="text-sm"
              />
              
              <Input
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                className="text-sm"
              />
              
              <Button onClick={addEntry} className="w-full" size="sm">
                Add Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="entries">Recent Entries</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        
        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p>No entries yet. Add your first transaction above!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.slice(0, 20).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {entry.type === 'income' ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-semibold">{entry.description}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.category}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {entry.date.toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`text-lg font-semibold ${
                        entry.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="categories">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  Top Income Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getCategoryTotals('income').map(([category, amount]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-sm">{category}</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                  Top Expense Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getCategoryTotals('expense').map(([category, amount]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-sm">{category}</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Upgrade CTA */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Need Advanced Cash Flow Management?</h4>
              <p className="text-sm text-blue-700 mb-3">
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