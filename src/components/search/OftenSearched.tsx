'use client';

import React from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { SearchHistoryItem } from './types';

export interface OftenSearchedProps {
  items: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  isLoading?: boolean;
  className?: string;
}

export function OftenSearched({
  items,
  onSelect,
  isLoading = false,
  className = '',
}: OftenSearchedProps) {
  if (isLoading) {
    return (
      <div className={`p-3 space-y-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 ${className}`}>
        <div className="w-24 h-3.5 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="flex flex-wrap gap-2 pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-7 rounded-full bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`p-3.5 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800 ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span>Often Searched Destinations</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <button
            key={item.id || `${item.query}-${idx}`}
            type="button"
            onClick={() => onSelect(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-300 rounded-full border border-slate-200/60 dark:border-zinc-700/60 transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Sparkles className="w-3 h-3 text-amber-500" aria-hidden="true" />
            <span>{item.placeName || item.query}</span>
            {item.searchCount && item.searchCount > 1 && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 bg-white/60 dark:bg-black/40 px-1 rounded-full">
                {item.searchCount}x
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
