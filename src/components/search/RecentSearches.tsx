'use client';

import React from 'react';
import { History, Trash2, ArrowUpRight } from 'lucide-react';
import { SearchHistoryItem } from './types';

export interface RecentSearchesProps {
  searches: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onClear: () => void;
  isLoading?: boolean;
  className?: string;
}

export function RecentSearches({
  searches,
  onSelect,
  onClear,
  isLoading = false,
  className = '',
}: RecentSearchesProps) {
  if (isLoading) {
    return (
      <div className={`p-4 space-y-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800 ${className}`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
          <div className="w-24 h-4 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 animate-pulse">
            <div className="w-1/2 h-4 rounded bg-slate-200 dark:bg-zinc-800" />
            <div className="w-4 h-4 rounded bg-slate-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  if (searches.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70 dark:bg-zinc-850/60 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
          <History className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Recent Searches</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors focus:outline-none focus:ring-1 focus:ring-red-500 rounded px-1.5 py-0.5"
          aria-label="Clear all recent searches"
          data-testid="clear-recent-searches-btn"
        >
          <Trash2 className="w-3 h-3" aria-hidden="true" />
          <span>Clear</span>
        </button>
      </div>

      {/* List */}
      <ul className="divide-y divide-slate-100 dark:divide-zinc-800/60">
        {searches.map((item, index) => (
          <li key={item.id || `${item.query}-${index}`}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors group focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-950/40"
            >
              <div className="flex items-center gap-2.5 truncate">
                <History className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                <span className="truncate font-medium">{item.placeName || item.query}</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 dark:group-hover:text-zinc-400 shrink-0 transition-colors" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
