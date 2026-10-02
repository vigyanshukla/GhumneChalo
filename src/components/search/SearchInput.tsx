'use client';

import React, { forwardRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  isLoading?: boolean;
  isOpen?: boolean;
  controlsId?: string;
  activeDescendantId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      onClear,
      onKeyDown,
      onFocus,
      isLoading = false,
      isOpen = false,
      controlsId = 'search-suggestions-listbox',
      activeDescendantId,
      placeholder = 'Search destinations, cities, or landmarks...',
      disabled = false,
      className = '',
    },
    ref
  ) {
    return (
      <div
        className={`relative flex items-center w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-slate-200/80 dark:border-zinc-800 transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${className}`}
      >
        {/* Leading Search Icon or Loading Spinner */}
        <div className="flex items-center justify-center pl-4 pr-2 text-slate-400 dark:text-zinc-500 pointer-events-none">
          {isLoading ? (
            <Loader2
              className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin"
              data-testid="search-spinner"
              aria-hidden="true"
            />
          ) : (
            <Search
              className="w-5 h-5 text-slate-400 dark:text-zinc-400"
              data-testid="search-icon"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Accessible Combobox Input */}
        <input
          ref={ref}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={controlsId}
          aria-activedescendant={activeDescendantId}
          aria-label="Search destinations, cities, or landmarks"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className="flex-1 min-h-[48px] py-3 text-sm sm:text-base text-slate-900 dark:text-white bg-transparent placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
        />

        {/* Clear Button */}
        {value.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center justify-center w-9 h-9 mr-2 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Clear search input"
            data-testid="search-clear-btn"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);
