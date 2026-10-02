'use client';

import React from 'react';
import { Droplets, Wind, AlertCircle, Clock } from 'lucide-react';
import { NormalizedWeatherDay } from '@/lib/weather/types';
import { WeatherIcon } from './WeatherIcon';

interface WeatherCardProps {
  day: NormalizedWeatherDay;
  isToday?: boolean;
}

export function WeatherCard({ day, isToday }: WeatherCardProps) {
  const dateObj = new Date(`${day.date}T00:00:00Z`);
  const dayName = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    : '';
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : day.date;

  const isUnavailable = day.status === 'past_unavailable' || day.status === 'future_unavailable';

  return (
    <div
      data-testid={`weather-day-card-${day.date}`}
      className={`relative flex flex-col justify-between rounded-2xl p-4 sm:p-5 transition-all border ${
        isToday
          ? 'bg-blue-50/70 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700 shadow-sm'
          : isUnavailable
          ? 'bg-zinc-50/50 border-zinc-200/80 dark:bg-zinc-900/30 dark:border-zinc-800/80 opacity-80'
          : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Top Header: Day & Date */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {day.dayNumber ? `Day ${day.dayNumber}` : dayName}
            </span>
            {isToday && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-600 text-white uppercase tracking-wider">
                Today
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {dayName ? `${dayName}, ${formattedDate}` : formattedDate}
          </p>
        </div>

        <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/70">
          <WeatherIcon category={day.conditionCategory} className="w-6 h-6" />
        </div>
      </div>

      {/* Main Condition & Temp */}
      {isUnavailable ? (
        <div className="my-3 py-3 px-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/50 text-center space-y-1">
          <div className="flex items-center justify-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {day.status === 'past_unavailable' ? (
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>{day.statusMessage || 'Unavailable'}</span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {day.status === 'past_unavailable'
              ? 'Past date outside active forecast window'
              : 'Forecast data available ~16 days prior'}
          </p>
        </div>
      ) : (
        <div className="my-2 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {day.formattedTemp}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {day.formattedTempRange}
            </span>
          </div>

          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {day.condition}
          </p>
        </div>
      )}

      {/* Bottom Metrics: Rain & Wind */}
      {!isUnavailable && (
        <div className="pt-3 mt-1 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1.5" title="Precipitation Probability">
            <Droplets
              className={`w-3.5 h-3.5 ${
                (day.precipitationProbability ?? 0) >= 30
                  ? 'text-blue-500'
                  : 'text-zinc-400'
              }`}
            />
            <span
              className={
                (day.precipitationProbability ?? 0) >= 30
                  ? 'font-semibold text-blue-600 dark:text-blue-400'
                  : ''
              }
            >
              {day.formattedPrecipitation}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Max Wind Speed">
            <Wind className="w-3.5 h-3.5 text-zinc-400" />
            <span>{day.formattedWind}</span>
          </div>
        </div>
      )}
    </div>
  );
}
