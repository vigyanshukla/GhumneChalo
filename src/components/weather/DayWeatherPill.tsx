'use client';

import React from 'react';
import { NormalizedWeatherDay } from '@/lib/weather/types';
import { WeatherIcon } from './WeatherIcon';

interface DayWeatherPillProps {
  day?: NormalizedWeatherDay | null;
  className?: string;
}

export function DayWeatherPill({ day, className = '' }: DayWeatherPillProps) {
  if (!day || day.status !== 'available') {
    return null;
  }

  return (
    <div
      data-testid="day-weather-pill"
      className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 ${className}`}
      title={`${day.condition} • Rain chance: ${day.formattedPrecipitation}`}
    >
      <WeatherIcon category={day.conditionCategory} className="w-3.5 h-3.5" />
      <span>{day.formattedTemp}</span>
      <span className="text-zinc-400">•</span>
      <span className="truncate max-w-[100px]">{day.condition}</span>
    </div>
  );
}
