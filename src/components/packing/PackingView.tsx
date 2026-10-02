'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Luggage,
  Sparkles,
  Plus,
  CheckCircle2,
  Circle,
  Printer,
  Trash2,
  Edit2,
  CloudSun,
  CloudRain,
  Snowflake,
  Sun,
  Search,
  AlertCircle,
  Loader2,
  Shirt,
  Sparkle,
  FileText,
  Smartphone,
  HeartPulse,
  PackageCheck,
  Compass,
  Check,
} from 'lucide-react';
import {
  PackingCategory,
  PACKING_CATEGORIES,
  PackingItemDTO,
  PackingListResponse,
} from '@/lib/packing/types';
import { AddItemModal } from './AddItemModal';

interface PackingViewProps {
  tripId: string;
  tripTitle?: string;
  destinationName?: string;
  startDate?: string;
  endDate?: string;
}

const CATEGORY_META: Record<
  PackingCategory,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  DOCUMENTS: {
    label: 'Documents & Money',
    icon: FileText,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/60',
  },
  CLOTHING: {
    label: 'Clothing & Footwear',
    icon: Shirt,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800/60',
  },
  TOILETRIES: {
    label: 'Toiletries & Hygiene',
    icon: Sparkle,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-800/60',
  },
  ELECTRONICS: {
    label: 'Electronics & Gadgets',
    icon: Smartphone,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800/60',
  },
  HEALTH: {
    label: 'Health & First Aid',
    icon: HeartPulse,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800/60',
  },
  ESSENTIALS: {
    label: 'Travel Essentials',
    icon: PackageCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/60',
  },
  WEATHER: {
    label: 'Weather Protection',
    icon: CloudSun,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800/60',
  },
  ACTIVITIES: {
    label: 'Activities & Special',
    icon: Compass,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-800/60',
  },
};

type FilterStatus = 'all' | 'unpacked' | 'packed';

export function PackingView({
  tripId,
  tripTitle,
  destinationName,
  startDate,
  endDate,
}: PackingViewProps) {
  const [data, setData] = useState<PackingListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItemDTO | null>(null);

  // Fetch packing checklist
  const fetchChecklist = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/trips/${tripId}/packing`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch packing list');
      }
      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading packing list');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchChecklist();
    });
  }, [fetchChecklist]);

  // Generate / Regenerate
  const handleGenerate = async (preserveCustom = true) => {
    try {
      setIsGenerating(true);
      setError(null);
      const res = await fetch(`/api/trips/${tripId}/packing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveCustom, forceRefreshWeather: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to generate recommendations');
      }
      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle Item Packed State
  const handleTogglePacked = async (item: PackingItemDTO) => {
    const nextPacked = !item.isPacked;

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      const updatedItems = prev.items.map((i) =>
        i.id === item.id ? { ...i, isPacked: nextPacked } : i
      );
      const packedCount = updatedItems.filter((i) => i.isPacked).length;
      const totalCount = updatedItems.length;
      return {
        ...prev,
        items: updatedItems,
        summary: {
          ...prev.summary,
          packedItems: packedCount,
          completionPercentage: totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0,
        },
      };
    });

    try {
      const res = await fetch(`/api/trips/${tripId}/packing/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPacked: nextPacked }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to update item');
      }
      setData((prev) => (prev ? { ...prev, summary: json.data.summary } : prev));
    } catch {
      fetchChecklist();
    }
  };

  // Add / Edit Item
  const handleSaveItem = async (formData: {
    name: string;
    category: PackingCategory;
    quantity: number;
    notes?: string | null;
  }) => {
    if (editingItem) {
      const res = await fetch(`/api/trips/${tripId}/packing/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to update item');
      }
    } else {
      const res = await fetch(`/api/trips/${tripId}/packing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to create item');
      }
    }
    fetchChecklist();
  };

  // Delete Item
  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/packing/${itemId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to delete item');
      }
      setData((prev) => {
        if (!prev) return prev;
        const remaining = prev.items.filter((i) => i.id !== itemId);
        return {
          ...prev,
          items: remaining,
          summary: json.data.summary,
        };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Clear Completed
  const handleClearCompleted = async () => {
    if (!window.confirm('Are you sure you want to remove all packed items?')) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/packing/clear-completed`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to clear completed items');
      }
      fetchChecklist();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Clear completed failed');
    }
  };

  // Filtered items (Direct derived state for React 19 performance)
  const itemsList = data?.items ?? [];
  const filteredItems = itemsList.filter((item) => {
    if (statusFilter === 'unpacked' && item.isPacked) return false;
    if (statusFilter === 'packed' && !item.isPacked) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      if (!matchName && !matchNotes) return false;
    }

    return true;
  });

  // Group by category
  const groupedByCategory: Record<PackingCategory, PackingItemDTO[]> = {
    DOCUMENTS: [],
    CLOTHING: [],
    TOILETRIES: [],
    ELECTRONICS: [],
    HEALTH: [],
    ESSENTIALS: [],
    WEATHER: [],
    ACTIVITIES: [],
  };

  for (const item of filteredItems) {
    if (groupedByCategory[item.category]) {
      groupedByCategory[item.category].push(item);
    } else {
      groupedByCategory.ESSENTIALS.push(item);
    }
  }

  const summary = data?.summary;
  const totalItems = summary?.totalItems ?? 0;
  const packedItems = summary?.packedItems ?? 0;
  const percentage = summary?.completionPercentage ?? 0;

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Printable Area Styling */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-packing-checklist,
          #printable-packing-checklist * {
            visibility: visible;
          }
          #printable-packing-checklist {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen View */}
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Progress Hero Card */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50/50 to-blue-50/30 p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-blue-950/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Luggage className="w-3.5 h-3.5" />
                  <span>Smart Packing Assistant</span>
                </span>

                {summary?.weatherIntegrated && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CloudSun className="w-3.5 h-3.5" />
                    <span>Weather-Synced</span>
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                {totalItems === 0
                  ? 'Your Trip Packing Checklist'
                  : `${packedItems} of ${totalItems} Items Packed`}
              </h2>

              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
                {totalItems === 0
                  ? 'Generate custom recommendations tailored to your destination, duration, and local weather forecast.'
                  : percentage === 100
                  ? 'All packed and ready for take-off! Have an incredible journey.'
                  : `${percentage}% complete. Keep packing, you are almost ready to go!`}
              </p>
            </div>

            {/* Quick Actions in Hero */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                id="generate-checklist-btn"
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Weather & Itinerary...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{totalItems === 0 ? 'Generate Smart List' : 'Regenerate List'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="add-custom-item-btn"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-zinc-200 bg-white text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-500" />
                <span>Add Item</span>
              </button>

              <button
                type="button"
                id="print-checklist-btn"
                onClick={handlePrint}
                disabled={totalItems === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-zinc-200 bg-white text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors"
                title="Print or save as PDF"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {totalItems > 0 && (
            <div className="mt-6 pt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                <span>Progress: {packedItems}/{totalItems} Packed</span>
                <span className="text-blue-600 dark:text-blue-400">{percentage}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Toolbar: Filter, Search & Clear Completed */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
              <button
                type="button"
                id="filter-all-btn"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                All ({totalItems})
              </button>
              <button
                type="button"
                id="filter-unpacked-btn"
                onClick={() => setStatusFilter('unpacked')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === 'unpacked'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                To Pack ({totalItems - packedItems})
              </button>
              <button
                type="button"
                id="filter-packed-btn"
                onClick={() => setStatusFilter('packed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === 'packed'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Packed ({packedItems})
              </button>
            </div>

            {/* Search Input & Clear Completed */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  id="packing-search-input"
                  placeholder="Filter items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {packedItems > 0 && (
                <button
                  type="button"
                  id="clear-completed-btn"
                  onClick={handleClearCompleted}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
                  title="Remove all completed items"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Packed</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-48 rounded-3xl border border-zinc-200 bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-900/60 p-6"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && totalItems === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-5 bg-white dark:bg-zinc-900/50">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
              <Luggage className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                No items in your packing checklist yet
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Let GhumneChalo automatically generate a smart packing list considering your trip duration, destination terrain, and weather forecast.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                id="empty-generate-btn"
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Destination & Weather...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Smart Checklist</span>
                  </>
                )}
              </button>
              <button
                type="button"
                id="empty-add-item-btn"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-500" />
                <span>Add Item Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* Category Sections */}
        {!isLoading && totalItems > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PACKING_CATEGORIES.map((catKey) => {
              const items = groupedByCategory[catKey];
              if (!items || items.length === 0) return null;

              const meta = CATEGORY_META[catKey];
              const Icon = meta.icon;
              const catPacked = items.filter((i) => i.isPacked).length;
              const catTotal = items.length;
              const isCategoryComplete = catTotal > 0 && catPacked === catTotal;

              return (
                <div
                  key={catKey}
                  id={`category-card-${catKey.toLowerCase()}`}
                  className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Category Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl border ${meta.bg} ${meta.color} ${meta.border}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {meta.label}
                          </h4>
                          <span className="text-xs text-zinc-400">
                            {catPacked} / {catTotal} packed
                          </span>
                        </div>
                      </div>

                      {isCategoryComplete ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <div className="w-12 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${(catPacked / catTotal) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          id={`packing-item-${item.id}`}
                          className={`group flex items-center justify-between py-2.5 px-1 transition-colors rounded-xl hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 ${
                            item.isPacked ? 'opacity-70' : 'opacity-100'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0 pr-2">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => handleTogglePacked(item)}
                              id={`toggle-item-${item.id}`}
                              className="mt-0.5 min-w-[44px] min-h-[44px] -ml-2.5 flex items-center justify-center rounded-xl text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label={`Mark ${item.name} as ${item.isPacked ? 'unpacked' : 'packed'}`}
                            >
                              {item.isPacked ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Circle className="w-5 h-5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600" />
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-sm font-medium ${
                                    item.isPacked
                                      ? 'line-through text-zinc-400 dark:text-zinc-500'
                                      : 'text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {item.name}
                                </span>

                                {item.quantity > 1 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                    ×{item.quantity}
                                  </span>
                                )}

                                {item.weatherRelevance && item.weatherRelevance !== 'GENERAL' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                                    {item.weatherRelevance === 'RAIN' ? (
                                      <CloudRain className="w-2.5 h-2.5" />
                                    ) : item.weatherRelevance === 'COLD' ? (
                                      <Snowflake className="w-2.5 h-2.5" />
                                    ) : (
                                      <Sun className="w-2.5 h-2.5" />
                                    )}
                                    <span>{item.weatherRelevance}</span>
                                  </span>
                                )}

                                {item.isCustom && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                                    Custom
                                  </span>
                                )}
                              </div>

                              {item.notes && (
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate max-w-xs sm:max-w-sm">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Hover Actions: Edit / Delete */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item);
                                setIsAddModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Edit item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. PRINT-ONLY CHECKSHEET TEMPLATE */}
      <div id="printable-packing-checklist" className="hidden print:block p-8 space-y-6">
        <div className="border-b-2 border-black pb-4 space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-black">
              GhumneChalo — Packing Checklist
            </h1>
            <span className="text-xs text-zinc-600">
              Generated: {new Date().toLocaleDateString()}
            </span>
          </div>

          <div className="text-sm text-zinc-800">
            <span className="font-semibold">{tripTitle || 'Trip Journey'}</span> —{' '}
            <span>{destinationName || data?.destinationName || 'Destination'}</span>
          </div>

          <div className="text-xs text-zinc-600">
            Dates: {startDate ? new Date(startDate).toLocaleDateString() : ''} to{' '}
            {endDate ? new Date(endDate).toLocaleDateString() : ''} (
            {data?.durationDays ?? 0} days) • Progress:{' '}
            {packedItems}/{totalItems} Packed ({percentage}%)
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-2">
          {PACKING_CATEGORIES.map((cat) => {
            const items = data?.items.filter((i) => i.category === cat) || [];
            if (items.length === 0) return null;

            return (
              <div key={cat} className="break-inside-avoid space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-black border-b border-zinc-400 pb-1">
                  {CATEGORY_META[cat]?.label || cat} ({items.length})
                </h3>
                <ul className="space-y-1 text-xs text-black">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span className="font-mono text-sm leading-none">
                        {item.isPacked ? '[X]' : '[ ]'}
                      </span>
                      <div>
                        <span className={item.isPacked ? 'line-through text-zinc-600' : 'font-medium'}>
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="ml-1 text-zinc-600 font-semibold">
                            (×{item.quantity})
                          </span>
                        )}
                        {item.notes && (
                          <span className="ml-1 text-[11px] text-zinc-500 italic">
                            — {item.notes}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Custom Item Modal */}
      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSaveItem}
        editItem={editingItem}
      />
    </div>
  );
}
