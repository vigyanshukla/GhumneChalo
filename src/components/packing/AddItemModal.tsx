'use client';

import React, { useState } from 'react';
import { X, Plus, Edit2, Loader2 } from 'lucide-react';
import { PackingCategory, PACKING_CATEGORIES, PackingItemDTO } from '@/lib/packing/types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    category: PackingCategory;
    quantity: number;
    notes?: string | null;
  }) => Promise<void>;
  editItem?: PackingItemDTO | null;
}

const CATEGORY_LABELS: Record<PackingCategory, string> = {
  CLOTHING: 'Clothing',
  TOILETRIES: 'Toiletries',
  DOCUMENTS: 'Documents',
  ELECTRONICS: 'Electronics',
  HEALTH: 'Health & First Aid',
  ESSENTIALS: 'Travel Essentials',
  WEATHER: 'Weather Protection',
  ACTIVITIES: 'Activities & Special',
};

interface FormContentProps {
  editItem?: PackingItemDTO | null;
  onClose: () => void;
  onSubmit: AddItemModalProps['onSubmit'];
}

function FormContent({ editItem, onClose, onSubmit }: FormContentProps) {
  const [name, setName] = useState(editItem?.name ?? '');
  const [category, setCategory] = useState<PackingCategory>(editItem?.category ?? 'ESSENTIALS');
  const [quantity, setQuantity] = useState(editItem?.quantity ?? 1);
  const [notes, setNotes] = useState(editItem?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        category,
        quantity: Math.max(1, quantity),
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      {error && (
        <div className="p-3 text-xs rounded-xl bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
          Item Name *
        </label>
        <input
          type="text"
          required
          id="item-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hiking boots, Waterproof camera, Sunglasses"
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
            Category
          </label>
          <select
            id="item-category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as PackingCategory)}
            className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {PACKING_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
            Quantity
          </label>
          <div className="flex items-center">
            <input
              type="number"
              id="item-quantity-input"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
          Notes (Optional)
        </label>
        <input
          type="text"
          id="item-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Keep in carry-on bag, check battery before flight"
          maxLength={200}
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          id="save-item-submit-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{editItem ? 'Update Item' : 'Add Item'}</span>
          )}
        </button>
      </div>
    </form>
  );
}

export function AddItemModal({ isOpen, onClose, onSubmit, editItem }: AddItemModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              {editItem ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editItem ? 'Edit Packing Item' : 'Add Custom Packing Item'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {editItem ? 'Modify details of your item' : 'Add any specific item you need for this journey'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <FormContent
          key={editItem?.id || 'new-item-form'}
          editItem={editItem}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
