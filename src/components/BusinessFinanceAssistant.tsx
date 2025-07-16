import React, { useState } from 'react';
import { Plus, Trash2, Edit, Calendar, DollarSign, TrendingDown, Repeat } from 'lucide-react';

const BusinessFinanceAssistant = () => {
  const [activeTab, setActiveTab] = useState('expenses');
  const [expenses, setExpenses] = useState([]);
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingRecurring, setEditingRecurring] = useState(null);

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'food',
    date: new Date().toISOString().split('T')[0]
  });

  const [recurringForm, setRecurringForm] = useState({
    description: '',
    amount: '',
    category: 'utilities',
    frequency: 'monthly',
    nextPayment: new Date().toISOString().split('T')[0]
  });

  const expenseCategories = [
    { value: 'food', label: 'Food & Dining' },
    { value: 'transport', label: 'Transportation' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'health', label: 'Health & Medical' },
    { value: 'other', label: 'Other' }
  ];

  const frequencies = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  const handleAddExpense = () => {
    if (expenseForm.description && expenseForm.amount) {
      const newExpense = {
        id: Date.now(),
        ...expenseForm,
        amount: parseFloat(expenseForm.amount)
      };
      setExpenses([...expenses, newExpense]);
      setExpenseForm({
        description: '',
        amount: '',
        category: 'food',
        date: new Date().toISOString().split('T')[0]
      });
      setShowExpenseForm(false);
    }
  };

  const handleUpdateExpense = () => {
    if (expenseForm.description && expenseForm.amount) {
      setExpenses(expenses.map(exp => 
        exp.id === editingExpense.id ? { ...editingExpense, ...expenseForm, amount: parseFloat(expenseForm.amount) } : exp
      ));
      setEditingExpense(null);
      setShowExpenseForm(false);
      setExpenseForm({
        description: '',
        amount: '',
        category: 'food',
        date: new Date().toISOString().split('T')[0]
      });
    }
  };

  const handleAddRecurring = () => {
    if (recurringForm.description && recurringForm.amount) {
      const newRecurring = {
        id: Date.now(),
        ...recurringForm,
        amount: parseFloat(recurringForm.amount)
      };
      setRecurringPayments([...recurringPayments, newRecurring]);
      setRecurringForm({
        description: '',
        amount: '',
        category: 'utilities',
        frequency: 'monthly',
        nextPayment: new Date().toISOString().split('T')[0]
      });
      setShowRecurringForm(false);
    }
  };

  const handleUpdateRecurring = () => {
    if (recurringForm.description && recurringForm.amount) {
      setRecurringPayments(recurringPayments.map(rec => 
        rec.id === editingRecurring.id ? { ...editingRecurring, ...recurringForm, amount: parseFloat(recurringForm.amount) } : rec
      ));
      setEditingRecurring(null);
      setShowRecurringForm(false);
      setRecurringForm({
        description: '',
        amount: '',
        category: 'utilities',
        frequency: 'monthly',
        nextPayment: new Date().toISOString().split('T')[0]
      });
    }
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  const deleteRecurring = (id) => {
    setRecurringPayments(recurringPayments.filter(rec => rec.id !== id));
  };

  const editExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date
    });
    setShowExpenseForm(true);
  };

  const editRecurring = (recurring) => {
    setEditingRecurring(recurring);
    setRecurringForm({
      description: recurring.description,
      amount: recurring.amount.toString(),
      category: recurring.category,
      frequency: recurring.frequency,
      nextPayment: recurring.nextPayment
    });
    setShowRecurringForm(true);
  };

  const cancelExpenseForm = () => {
    setShowExpenseForm(false);
    setEditingExpense(null);
    setExpenseForm({
      description: '',
      amount: '',
      category: 'food',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const cancelRecurringForm = () => {
    setShowRecurringForm(false);
    setEditingRecurring(null);
    setRecurringForm({
      description: '',
      amount: '',
      category: 'utilities',
      frequency: 'monthly',
      nextPayment: new Date().toISOString().split('T')[0]
    });
  };

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  };

  const getTotalRecurring = () => {
    return recurringPayments.reduce((total, payment) => total + payment.amount, 0);
  };

  const getCategoryLabel = (value) => {
    const category = expenseCategories.find(cat => cat.value === value);
    return category ? category.label : value;
  };

  const getFrequencyLabel = (value) => {
    const frequency = frequencies.find(freq => freq.value === value);
    return frequency ? frequency.label : value;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-card rounded-lg shadow-lg">
          <div className="border-b border-border">
            <div className="flex space-x-1 p-1">
              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'expenses'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingDown size={20} />
                <span>Expenses</span>
              </button>
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'outgoing'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Repeat size={20} />
                <span>Outgoing</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'expenses' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Expenses</h2>
                    <p className="text-muted-foreground">Total: ${getTotalExpenses().toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
                  >
                    <Plus size={20} />
                    <span>Add Expense</span>
                  </button>
                </div>

                {showExpenseForm && (
                  <div className="bg-muted p-6 rounded-lg mb-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={expenseForm.description}
                          onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Enter expense description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Category
                        </label>
                        <select
                          value={expenseForm.category}
                          onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {expenseCategories.map(category => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={expenseForm.date}
                          onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-3 mt-4">
                      <button
                        onClick={editingExpense ? handleUpdateExpense : handleAddExpense}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                      >
                        {editingExpense ? 'Update' : 'Add'} Expense
                      </button>
                      <button
                        onClick={cancelExpenseForm}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {expenses.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <DollarSign size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                      <p>No expenses recorded yet.</p>
                      <p className="text-sm">Click "Add Expense" to get started.</p>
                    </div>
                  ) : (
                    expenses.map(expense => (
                      <div key={expense.id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{expense.description}</h4>
                            <div className="flex space-x-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center">
                                <Calendar size={16} className="mr-1" />
                                {expense.date}
                              </span>
                              <span>{getCategoryLabel(expense.category)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-semibold text-destructive">
                              -${expense.amount.toFixed(2)}
                            </span>
                            <button
                              onClick={() => editExpense(expense)}
                              className="text-primary hover:text-primary/80"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'outgoing' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Recurring Payments</h2>
                    <p className="text-muted-foreground">Total Monthly: ${getTotalRecurring().toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => setShowRecurringForm(true)}
                    className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors flex items-center space-x-2"
                  >
                    <Plus size={20} />
                    <span>Add Recurring Payment</span>
                  </button>
                </div>

                {showRecurringForm && (
                  <div className="bg-muted p-6 rounded-lg mb-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {editingRecurring ? 'Edit Recurring Payment' : 'Add New Recurring Payment'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={recurringForm.description}
                          onChange={(e) => setRecurringForm({...recurringForm, description: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Enter payment description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={recurringForm.amount}
                          onChange={(e) => setRecurringForm({...recurringForm, amount: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Category
                        </label>
                        <select
                          value={recurringForm.category}
                          onChange={(e) => setRecurringForm({...recurringForm, category: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {expenseCategories.map(category => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Frequency
                        </label>
                        <select
                          value={recurringForm.frequency}
                          onChange={(e) => setRecurringForm({...recurringForm, frequency: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {frequencies.map(frequency => (
                            <option key={frequency.value} value={frequency.value}>
                              {frequency.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Next Payment Date
                        </label>
                        <input
                          type="date"
                          value={recurringForm.nextPayment}
                          onChange={(e) => setRecurringForm({...recurringForm, nextPayment: e.target.value})}
                          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-3 mt-4">
                      <button
                        onClick={editingRecurring ? handleUpdateRecurring : handleAddRecurring}
                        className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors"
                      >
                        {editingRecurring ? 'Update' : 'Add'} Payment
                      </button>
                      <button
                        onClick={cancelRecurringForm}
                        className="bg-muted text-muted-foreground px-4 py-2 rounded-md hover:bg-muted/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {recurringPayments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Repeat size={48} className="mx-auto mb-4 text-muted-foreground/50" />
                      <p>No recurring payments set up yet.</p>
                      <p className="text-sm">Click "Add Recurring Payment" to get started.</p>
                    </div>
                  ) : (
                    recurringPayments.map(payment => (
                      <div key={payment.id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{payment.description}</h4>
                            <div className="flex space-x-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center">
                                <Calendar size={16} className="mr-1" />
                                Next: {payment.nextPayment}
                              </span>
                              <span>{getCategoryLabel(payment.category)}</span>
                              <span className="capitalize">{getFrequencyLabel(payment.frequency)}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-semibold text-secondary">
                              ${payment.amount.toFixed(2)}
                            </span>
                            <button
                              onClick={() => editRecurring(payment)}
                              className="text-primary hover:text-primary/80"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => deleteRecurring(payment.id)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessFinanceAssistant;