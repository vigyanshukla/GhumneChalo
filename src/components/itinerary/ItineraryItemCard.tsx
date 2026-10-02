'use client';

import React from 'react';
import Link from 'next/link';
import {
  Clock,
  MapPin,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Navigation,
  FileText,
} from 'lucide-react';
import { ItineraryItemData } from './types';

interface ItineraryItemCardProps {
  item: ItineraryItemData;
  index: number;
  totalItems: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isReordering?: boolean;
}

export function ItineraryItemCard({
  item,
  index,
  totalItems,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isReordering = false,
}: ItineraryItemCardProps) {
  const isFirst = index === 0;
  const isLast = index === totalItems - 1;

  // Directions URL reusing Phase 3D Routes in /explore
  const hasCoordinates =
    typeof item.latitude === 'number' && typeof item.longitude === 'number';

  const directionsUrl = hasCoordinates
    ? `/explore?destLat=${item.latitude}&destLng=${item.longitude}&destName=${encodeURIComponent(
        item.name
      )}&directions=true`
    : `/explore?q=${encodeURIComponent(item.name)}`;

  return (
    <div
      id={`itinerary-item-${item.id}`}
      className="relative flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs transition-all group"
    >
      {/* Sequence Badge / Step Number */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800 flex items-center justify-center font-bold text-xs sm:text-sm">
          {index + 1}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px] bg-zinc-200 dark:bg-zinc-800 mt-2" />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {item.name}
          </h3>

          {/* Time Slot Pill */}
          {(item.startTime || item.endTime) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shrink-0 self-start sm:self-auto">
              <Clock className="w-3 h-3 text-blue-500" />
              <span>
                {item.startTime || ''}
                {item.startTime && item.endTime ? ' – ' : ''}
                {item.endTime || ''}
              </span>
            </div>
          )}
        </div>

        {/* Location Coordinates / Place Details Indicator */}
        {hasCoordinates && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">
              {item.latitude?.toFixed(4)}°, {item.longitude?.toFixed(4)}°
            </span>
            <Link
              href={directionsUrl}
              className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
            >
              <span>Route Directions</span>
              <Navigation className="w-2.5 h-2.5" />
            </Link>
          </div>
        )}

        {/* User Notes */}
        {item.notes && (
          <div className="flex items-start gap-1.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
            <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800/80">
          {/* Reordering Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst || isReordering}
              id={`move-up-item-${index}`}
              title="Move item up"
              aria-label={`Move ${item.name} up`}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast || isReordering}
              id={`move-down-item-${index}`}
              title="Move item down"
              aria-label={`Move ${item.name} down`}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-zinc-400 ml-1">
              #{index + 1} of {totalItems}
            </span>
          </div>

          {/* Edit & Delete Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onEdit}
              id={`edit-item-${index}`}
              title="Edit activity"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              <Edit2 className="w-3 h-3 text-blue-500" />
              <span>Edit</span>
            </button>
            <button
              onClick={onDelete}
              id={`delete-item-${index}`}
              title="Delete activity"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
