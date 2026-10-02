'use client';

import React from 'react';
import { MapPin, Star, AlertCircle } from 'lucide-react';
import { NormalizedPlace } from './types';

export interface SearchSuggestionsProps {
  suggestions: NormalizedPlace[];
  activeIndex: number;
  isLoading: boolean;
  error?: string | null;
  query: string;
  onSelect: (place: NormalizedPlace) => void;
  listboxId?: string;
  className?: string;
}

function formatCategory(type?: string): string {
  if (!type) return '';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SearchSuggestions({
  suggestions,
  activeIndex,
  isLoading,
  error,
  query,
  onSelect,
  listboxId = 'search-suggestions-listbox',
  className = '',
}: SearchSuggestionsProps) {
  // 1. Error State
  if (error) {
    return (
      <div
        className={`p-4 text-center bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/50 ${className}`}
        role="alert"
      >
        <div className="flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // 2. Loading State Skeleton
  if (isLoading && suggestions.length === 0) {
    return (
      <div
        className={`p-3 space-y-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800 ${className}`}
        aria-busy="true"
        aria-label="Loading destination suggestions"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="w-2/3 h-4 rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="w-1/2 h-3 rounded bg-slate-100 dark:bg-zinc-850" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3. Empty State
  if (!isLoading && suggestions.length === 0 && query.trim().length >= 2) {
    return (
      <div
        className={`p-6 text-center bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800 ${className}`}
      >
        <div className="flex flex-col items-center justify-center text-slate-500 dark:text-zinc-400">
          <MapPin className="w-8 h-8 mb-2 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
            No destinations found
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Try searching for a different city, state, or landmark.
          </p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  // 4. Suggestions Listbox
  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label="Destination suggestions"
      className={`max-h-[380px] overflow-y-auto py-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800/60 ${className}`}
    >
      {suggestions.map((place, index) => {
        const isSelected = index === activeIndex;
        const optionId = `suggestion-${index}`;
        const category = formatCategory(place.primaryType || place.types?.[0]);

        return (
          <div
            key={place.placeId || index}
            id={optionId}
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onClick={() => onSelect(place)}
            className={`group flex items-start gap-3.5 px-4 py-3 cursor-pointer transition-colors duration-150 ${
              isSelected
                ? 'bg-blue-50 dark:bg-blue-950/50'
                : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            {/* Location Icon */}
            <div
              className={`flex items-center justify-center w-8 h-8 mt-0.5 rounded-lg shrink-0 transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400'
              }`}
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
            </div>

            {/* Place Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-semibold truncate ${
                    isSelected
                      ? 'text-blue-900 dark:text-blue-200'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {place.name}
                </span>

                {/* Rating if present */}
                {typeof place.rating === 'number' && (
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{place.rating.toFixed(1)}</span>
                    {place.userRatingCount && (
                      <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                        ({place.userRatingCount})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Formatted Address */}
              {place.formattedAddress && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                  {place.formattedAddress}
                </p>
              )}

              {/* Category Pill */}
              {category && (
                <div className="mt-1">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded-md">
                    {category}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
