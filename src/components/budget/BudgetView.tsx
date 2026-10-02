'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, Wallet, TrendingDown, CheckCircle2,
  AlertCircle, Loader2, IndianRupee, ShoppingBag, Utensils,
  Car, Ticket, BriefcaseBusiness, HelpCircle, X, Save,
} from 'lucide-react';
import { TripSummary } from '@/components/trips/types';

type ExpenseCategory = 'ACCOMMODATION' | 'FOOD' | 'TRANSPORT' | 'ACTIVITIES' | 'SHOPPING' | 'MISCELLANEOUS';

interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
}

interface BudgetData {
  id: string;
  tripId: string;
  totalAmount: number;
  currency: string;
  expenses: Expense[];
  totalSpent: number;
  remaining: number;
}

const CATEGORIES = [
  { value: 'ACCOMMODATION' as ExpenseCategory, label: 'Accommodation', Icon: BriefcaseBusiness, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { value: 'FOOD'          as ExpenseCategory, label: 'Food & Drink',  Icon: Utensils,          color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  { value: 'TRANSPORT'     as ExpenseCategory, label: 'Transport',      Icon: Car,               color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  { value: 'ACTIVITIES'    as ExpenseCategory, label: 'Activities',     Icon: Ticket,            color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { value: 'SHOPPING'      as ExpenseCategory, label: 'Shopping',       Icon: ShoppingBag,       color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-950/40' },
  { value: 'MISCELLANEOUS' as ExpenseCategory, label: 'Other',          Icon: HelpCircle,        color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-800/60' },
];

function getCategoryMeta(cat: ExpenseCategory) { return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[5]; }

function fmt(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function BudgetSummary({ budget }: { budget: BudgetData }) {
  const pct = budget.totalAmount > 0 ? Math.min(100, (budget.totalSpent / budget.totalAmount) * 100) : 0;
  const isOver = budget.remaining < 0;
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-500" />Budget Overview
        </h3>
        <span className="text-xs text-zinc-400">{budget.currency}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">Total Budget</p>
          <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{fmt(budget.totalAmount, budget.currency)}</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30">
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Spent</p>
          <p className="font-bold text-amber-700 dark:text-amber-300 text-sm">{fmt(budget.totalSpent, budget.currency)}</p>
        </div>
        <div className={`text-center p-3 rounded-xl border ${isOver ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30'}`}>
          <p className={`text-xs mb-1 ${isOver ? 'text-rose-600' : 'text-emerald-600'}`}>{isOver ? 'Over by' : 'Remaining'}</p>
          <p className={`font-bold text-sm ${isOver ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{fmt(Math.abs(budget.remaining), budget.currency)}</p>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
          <span>{pct.toFixed(0)}% spent</span>
          <span>{budget.expenses.length} expense{budget.expenses.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {budget.expenses.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">By Category</p>
          {CATEGORIES.filter(cat => budget.expenses.some(e => e.category === cat.value)).map(cat => {
            const catTotal = budget.expenses.filter(e => e.category === cat.value).reduce((s, e) => s + e.amount, 0);
            const catPct = budget.totalAmount > 0 ? (catTotal / budget.totalAmount) * 100 : 0;
            const CatIcon = cat.Icon;
            return (
              <div key={cat.value} className="flex items-center gap-2.5 text-xs">
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${cat.bg}`}><CatIcon className={`w-3 h-3 ${cat.color}`} /></div>
                <span className="text-zinc-600 dark:text-zinc-400 flex-1 truncate">{cat.label}</span>
                <div className="w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5"><div className="h-full rounded-full bg-blue-400" style={{ width: `${catPct}%` }} /></div>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 w-20 text-right">{fmt(catTotal, budget.currency)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ExpenseFormProps {
  tripId: string; currency: string; editingExpense?: Expense | null;
  onSave: (expense: Expense) => void; onCancel: () => void;
}

function ExpenseForm({ tripId, currency, editingExpense, onSave, onCancel }: ExpenseFormProps) {
  const [category, setCategory] = useState<ExpenseCategory>(editingExpense?.category ?? 'MISCELLANEOUS');
  const [description, setDescription] = useState(editingExpense?.description ?? '');
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount) : '');
  const [expenseDate, setExpenseDate] = useState(editingExpense ? new Date(editingExpense.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) { setError('Please fill all fields with valid values.'); return; }
    setSaving(true); setError(null);
    try {
      const url = editingExpense ? `/api/trips/${tripId}/expenses/${editingExpense.id}` : `/api/trips/${tripId}/expenses`;
      const res = await fetch(url, { method: editingExpense ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, description: description.trim(), amount: numAmount, expenseDate: new Date(expenseDate) }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to save expense');
      onSave(data.data);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to save expense'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h4>
        <button type="button" onClick={onCancel} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-4 h-4" /></button>
      </div>
      {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-xs text-rose-700 dark:text-rose-300"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Category</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.Icon; const isActive = category === cat.value;
            return (
              <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${isActive ? `${cat.bg} border-current ${cat.color} ring-2 ring-blue-500/30` : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 bg-white dark:bg-zinc-900 hover:border-zinc-300'}`}>
                <CatIcon className={`w-4 h-4 ${isActive ? cat.color : ''}`} />
                <span className="leading-none">{cat.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Hotel check-in" maxLength={200} required disabled={saving} className="block w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">Amount ({currency})</label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0.01" step="0.01" required disabled={saving} className="block w-full pl-8 pr-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">Date</label>
        <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required disabled={saving} className="block w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Saving…' : 'Save Expense'}
        </button>
      </div>
    </form>
  );
}

export function BudgetView({ trip }: { trip: TripSummary }) {
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const loadBudget = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/budget`);
      if (res.status === 404) {
        setBudget(null);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Failed to load budget');
      setBudget(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [trip.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBudget();
  }, [loadBudget]);

  const handleSaveExpense = (expense: Expense) => {
    setBudget(prev => {
      if (!prev) return prev;
      const existing = prev.expenses.findIndex(e => e.id === expense.id);
      const updatedExpenses = existing >= 0 ? prev.expenses.map(e => e.id === expense.id ? expense : e) : [expense, ...prev.expenses];
      const totalSpent = updatedExpenses.reduce((s, e) => s + e.amount, 0);
      return { ...prev, expenses: updatedExpenses, totalSpent, remaining: prev.totalAmount - totalSpent };
    });
    setShowForm(false); setEditingExpense(null);
    showSuccess(editingExpense ? 'Expense updated!' : 'Expense added!');
    if (!budget) loadBudget();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setDeletingId(expenseId);
    try {
      const res = await fetch(`/api/trips/${trip.id}/expenses/${expenseId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || 'Delete failed');
      setBudget(prev => {
        if (!prev) return prev;
        const updatedExpenses = prev.expenses.filter(e => e.id !== expenseId);
        const totalSpent = updatedExpenses.reduce((s, e) => s + e.amount, 0);
        return { ...prev, expenses: updatedExpenses, totalSpent, remaining: prev.totalAmount - totalSpent };
      });
      showSuccess('Expense deleted.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete'); }
    finally { setDeletingId(null); }
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>;

  if (error) return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
      <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
      <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">{error}</p>
      <button onClick={loadBudget} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700">Retry</button>
    </div>
  );

  const currency = budget?.currency ?? trip.currency ?? 'INR';

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-sm text-emerald-700 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
        </div>
      )}

      {!budget && !trip.totalBudget ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 p-10 text-center">
          <Wallet className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-1">No Budget Set</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">Edit the trip to set an overall budget, then start tracking expenses here.</p>
        </div>
      ) : (
        <BudgetSummary budget={budget ?? { id: '', tripId: trip.id, totalAmount: Number(trip.totalBudget ?? 0), currency, expenses: [], totalSpent: 0, remaining: Number(trip.totalBudget ?? 0) }} />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-amber-500" />Expense Log
          {budget && <span className="text-xs font-normal text-zinc-400">({budget.expenses.length})</span>}
        </h3>
        {!showForm && !editingExpense && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm">
            <Plus className="w-3.5 h-3.5" />Add Expense
          </button>
        )}
      </div>

      {(showForm || editingExpense) && (
        <ExpenseForm tripId={trip.id} currency={currency} editingExpense={editingExpense} onSave={handleSaveExpense} onCancel={() => { setShowForm(false); setEditingExpense(null); }} />
      )}

      {budget && budget.expenses.length > 0 ? (
        <div className="space-y-2">
          {budget.expenses.map(expense => {
            const meta = getCategoryMeta(expense.category);
            const CatIcon = meta.Icon;
            const isDeleting = deletingId === expense.id;
            return (
              <div key={expense.id} className={`flex items-center gap-3 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 group transition-opacity ${isDeleting ? 'opacity-40' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}><CatIcon className={`w-4 h-4 ${meta.color}`} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{expense.description}</p>
                  <p className="text-xs text-zinc-400">{meta.label} · {new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 shrink-0">{fmt(expense.amount, currency)}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => { setEditingExpense(expense); setShowForm(false); }} disabled={isDeleting} className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDeleteExpense(expense.id)} disabled={isDeleting} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50" title="Delete">
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !showForm && !editingExpense && (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-8 text-center">
          <TrendingDown className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">No expenses logged yet.</p>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" />Log First Expense
          </button>
        </div>
      )}
    </div>
  );
}
