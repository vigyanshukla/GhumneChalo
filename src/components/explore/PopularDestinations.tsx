'use client';

import React from 'react';
import { Flame, Compass } from 'lucide-react';
import { POPULAR_DESTINATIONS, PopularDestination } from './types';

export interface PopularDestinationsProps {
  activeDestinationId?: string | null;
  onSelectDestination: (dest: PopularDestination) => void;
  className?: string;
}

export function PopularDestinations({
  activeDestinationId,
  onSelectDestination,
  className = '',
}: PopularDestinationsProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        <Flame className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        <span>Popular Destinations</span>
      </div>

      <div
        role="region"
        aria-label="Popular destinations"
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800"
      >
        {(Array.isArray(POPULAR_DESTINATIONS) ? POPULAR_DESTINATIONS : []).map((dest, idx) => {
          if (!dest || typeof dest !== 'object') return null;
          const isActive = activeDestinationId === dest.id;

          return (
            <button
              key={dest.id || dest.name || idx}
              type="button"
              onClick={() => onSelectDestination(dest)}
              aria-pressed={isActive}
              aria-label={`Explore ${dest.name || ''}, ${dest.region || ''}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 shrink-0 border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-transparent shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Compass
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive
                    ? 'text-white dark:text-black'
                    : 'text-blue-600 dark:text-blue-400'
                }`}
                aria-hidden="true"
              />
              <span className="font-semibold">{dest.name || ''}</span>
              <span
                className={`text-[10px] ${
                  isActive
                    ? 'text-slate-300 dark:text-zinc-600'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}
              >
                {dest.region || ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
