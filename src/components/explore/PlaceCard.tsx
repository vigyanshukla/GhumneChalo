'use client';

import React from 'react';
import { MapPin, Star, Navigation } from 'lucide-react';
import { NormalizedDiscoveryPlace } from './types';

export interface PlaceCardProps {
  place: NormalizedDiscoveryPlace;
  isSelected?: boolean;
  onSelect: (place: NormalizedDiscoveryPlace) => void;
  className?: string;
}

function formatCategory(type?: string): string {
  if (!type) return '';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PlaceCard({
  place,
  isSelected = false,
  onSelect,
  className = '',
}: PlaceCardProps) {
  const category = formatCategory(place.primaryType || place.types?.[0]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(place);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${place.name}, ${category || 'Place'}, ${
        place.rating ? `rating ${place.rating.toFixed(1)} stars` : ''
      }`}
      onClick={() => onSelect(place)}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border transition-all duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isSelected
          ? 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/30 dark:bg-blue-950/20'
          : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md'
      } ${className}`}
    >
      {/* Header Row: Title + Category */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold truncate transition-colors ${
              isSelected
                ? 'text-blue-900 dark:text-blue-200'
                : 'text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'
            }`}
          >
            {place.name}
          </h3>
          {category && (
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded-md">
              {category}
            </span>
          )}
        </div>

        {/* Rating Badge */}
        {typeof place.rating === 'number' && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-md border border-amber-200/50 dark:border-amber-900/40 shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span>{place.rating.toFixed(1)}</span>
            {place.userRatingCount && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
                ({place.userRatingCount})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Address */}
      {place.formattedAddress && (
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {place.formattedAddress}
        </p>
      )}

      {/* Footer Info: Distance + Location indicator */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
        <div className="flex items-center gap-1 truncate">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">
            {place.latitude.toFixed(3)}, {place.longitude.toFixed(3)}
          </span>
        </div>

        {place.distanceFormatted && (
          <div className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 shrink-0">
            <Navigation className="w-3 h-3" aria-hidden="true" />
            <span>{place.distanceFormatted}</span>
          </div>
        )}
      </div>
    </div>
  );
}
