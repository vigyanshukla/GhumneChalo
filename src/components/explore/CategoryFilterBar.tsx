'use client';

import React from 'react';
import {
  Landmark,
  UtensilsCrossed,
  Coffee,
  Bed,
  Building2,
  Trees,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { DiscoveryCategoryKey } from './types';

export interface CategoryFilterBarProps {
  activeCategory: DiscoveryCategoryKey;
  onSelectCategory: (category: DiscoveryCategoryKey) => void;
  disabled?: boolean;
  className?: string;
}

interface CategoryItem {
  key: DiscoveryCategoryKey;
  label: string;
  icon: React.ElementType;
}

export const CATEGORY_ITEMS: CategoryItem[] = [
  { key: 'attractions', label: 'Attractions', icon: Landmark },
  { key: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed },
  { key: 'cafes', label: 'Cafes', icon: Coffee },
  { key: 'hotels', label: 'Hotels', icon: Bed },
  { key: 'museums', label: 'Museums', icon: Building2 },
  { key: 'parks', label: 'Parks & Nature', icon: Trees },
  { key: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { key: 'temples', label: 'Spiritual', icon: Sparkles },
];

export function CategoryFilterBar({
  activeCategory,
  onSelectCategory,
  disabled = false,
  className = '',
}: CategoryFilterBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % CATEGORY_ITEMS.length;
      onSelectCategory(CATEGORY_ITEMS[nextIndex].key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + CATEGORY_ITEMS.length) % CATEGORY_ITEMS.length;
      onSelectCategory(CATEGORY_ITEMS[prevIndex].key);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Explore discovery categories"
      className={`flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800 ${className}`}
    >
      {CATEGORY_ITEMS.map((item, index) => {
        const Icon = item.icon;
        const isActive = activeCategory === item.key;

        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            aria-label={`${item.label} category`}
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelectCategory(item.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${
                isActive ? 'text-white' : 'text-slate-500 dark:text-zinc-400'
              }`}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
