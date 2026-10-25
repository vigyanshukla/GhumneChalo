'use client';

import React from 'react';
import { Calendar, Plus, Edit2, Trash2 } from 'lucide-react';
import { ItineraryDayData } from './types';
import { DayWeatherPill } from '@/components/weather';
import { NormalizedWeatherDay } from '@/lib/weather/types';

interface DayHeaderProps {
  day: ItineraryDayData;
  totalDays: number;
  weatherDay?: NormalizedWeatherDay | null;
  onAddActivity: () => void;
  onEditDay: () => void;
  onDeleteDay: () => void;
}

export function DayHeader({
  day,
  totalDays,
  weatherDay,
  onAddActivity,
  onEditDay,
  onDeleteDay,
}: DayHeaderProps) {
  const dayDate = new Date(day.date);
  const formattedDate = !isNaN(dayDate.getTime())
    ? dayDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const displayTitle = day.title && day.title.trim() !== `Day ${day.dayNumber}`
    ? day.title
    : `Day ${day.dayNumber}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {displayTitle}
          </h2>
          <button
            onClick={onEditDay}
            title="Edit day title"
            id="edit-day-btn"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {totalDays > 1 && (
            <button
              onClick={onDeleteDay}
              title="Delete this day"
              id="delete-day-btn"
              className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>{formattedDate}</span>
          </div>
          <span>•</span>
          <span>
            {day.items.length} {day.items.length === 1 ? 'activity planned' : 'activities planned'}
          </span>
          {weatherDay && (
            <>
              <span>•</span>
              <DayWeatherPill day={weatherDay} />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onAddActivity}
          id="add-activity-btn"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Activity</span>
        </button>
      </div>
    </div>
  );
}
