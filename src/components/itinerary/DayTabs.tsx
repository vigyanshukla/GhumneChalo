'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { ItineraryDayData } from './types';

interface DayTabsProps {
  days: ItineraryDayData[];
  activeDayId: string;
  onSelectDay: (dayId: string) => void;
  onAddDay: () => void;
  isAddingDay?: boolean;
}

export function DayTabs({
  days,
  activeDayId,
  onSelectDay,
  onAddDay,
  isAddingDay = false,
}: DayTabsProps) {
  return (
    <div className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 rounded-2xl p-2 sm:p-3 shadow-sm">
      <div
        className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-0.5"
        role="tablist"
        aria-label="Trip Itinerary Days"
      >
        {days.map((day) => {
          const isActive = day.id === activeDayId;
          const dayDate = new Date(day.date);
          const formattedDate = !isNaN(dayDate.getTime())
            ? dayDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : '';

          const itemCount = day.items?.length || 0;

          return (
            <button
              key={day.id}
              role="tab"
              aria-selected={isActive}
              id={`day-tab-${day.dayNumber}`}
              onClick={() => onSelectDay(day.id)}
              className={`flex flex-col items-start min-w-[120px] sm:min-w-[140px] px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500/70 dark:text-blue-100 shadow-xs ring-2 ring-blue-500/20'
                  : 'border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs sm:text-sm font-bold tracking-tight">
                  Day {day.dayNumber}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive
                      ? 'bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {itemCount} {itemCount === 1 ? 'place' : 'places'}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate max-w-full">
                {formattedDate}
              </span>
            </button>
          );
        })}

        {/* Add Day Button */}
        <button
          onClick={onAddDay}
          disabled={isAddingDay}
          id="add-day-btn"
          title="Add another day to this itinerary"
          className="flex items-center justify-center gap-1.5 min-w-[110px] px-3 py-2.5 rounded-xl border border-dashed border-zinc-300 hover:border-blue-400 hover:bg-blue-50/50 text-zinc-600 hover:text-blue-600 dark:border-zinc-700 dark:hover:border-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
        >
          {isAddingDay ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>Add Day</span>
        </button>
      </div>
    </div>
  );
}
