'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudSun,
  RefreshCw,
  AlertTriangle,
  Droplets,
  Thermometer,
  Calendar,
  Compass,
} from 'lucide-react';
import { NormalizedTripWeather } from '@/lib/weather/types';
import { WeatherCard } from './WeatherCard';
import { WeatherIcon } from './WeatherIcon';
import { getStoredItem, setStoredItem } from '@/lib/cache/client-cache';
import { getTripOfflineSnapshot } from '@/lib/offline/offline-storage';

interface WeatherViewProps {
  trip: {
    id: string;
    destinationName: string;
    startDate: string | Date;
    endDate: string | Date;
    latitude?: number | null;
    longitude?: number | null;
  };
}

export function WeatherView({ trip }: WeatherViewProps) {
  const clientCacheKey = `gc_cache_weather_${trip.id}`;

  const [weather, setWeather] = useState<NormalizedTripWeather | null>(() => {
    const cached = getStoredItem<NormalizedTripWeather>(clientCacheKey);
    return cached?.data || null;
  });
  const [isLoading, setIsLoading] = useState(!weather);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(
    async (forceRefresh = false) => {
      // 1. If offline, try offline snapshot from IndexedDB
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsLoading(true);
        try {
          const snapshot = await getTripOfflineSnapshot(trip.id);
          if (snapshot?.weather) {
            setWeather(snapshot.weather as NormalizedTripWeather);
            setIsOfflineData(true);
            setIsLoading(false);
            return;
          }
        } catch {}
      }

      if (forceRefresh) {
        setIsRefreshing(true);
      } else if (!weather) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const url = `/api/trips/${trip.id}/weather${forceRefresh ? '?refresh=true' : ''}`;
        const res = await fetch(url);

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error?.message || `Failed to fetch weather (${res.status})`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          setWeather(json.data);
          setIsOfflineData(false);
          // Store in client cache with 15 min TTL
          setStoredItem(clientCacheKey, json.data, 15 * 60 * 1000);
        } else {
          throw new Error(json?.error?.message || 'Invalid weather response format.');
        }
      } catch (err: unknown) {
        // Fallback to offline snapshot on error
        try {
          const snapshot = await getTripOfflineSnapshot(trip.id);
          if (snapshot?.weather) {
            setWeather(snapshot.weather as NormalizedTripWeather);
            setIsOfflineData(true);
            return;
          }
        } catch {}

        if (!weather) {
          setError(err instanceof Error ? err.message : 'Unable to load weather forecast.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [trip.id, clientCacheKey, weather]
  );

  useEffect(() => {
    // Only re-fetch if not cached or force refreshing
    const cached = getStoredItem<NormalizedTripWeather>(clientCacheKey);
    if (!cached || cached.isStale) {
      queueMicrotask(() => {
        fetchWeather(false);
      });
    }
  }, [fetchWeather, clientCacheKey]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6" data-testid="weather-view-container">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CloudSun className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Weather & Forecast
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Real-time conditions and day-wise weather forecast for{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {trip.destinationName}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchWeather(true)}
            disabled={isLoading || isRefreshing}
            data-testid="refresh-weather-btn"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-200 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Stale Warning Banner */}
      {weather?.isStale && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            {weather.warning || 'Displaying cached weather snapshot. Live update will resume shortly.'}
          </span>
        </div>
      )}

      {/* Offline Data Banner */}
      {isOfflineData && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <span>Offline — displaying saved forecast snapshot. Live forecast will refresh when reconnected.</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
            Weather Forecast Unavailable
          </h3>
          <p className="text-sm text-rose-700 dark:text-rose-300 max-w-md mx-auto">
            {error}
          </p>
          <button
            onClick={() => fetchWeather(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Weather Content */}
      {!isLoading && !error && weather && (
        <div className="space-y-6">
          {/* Summary / Hero Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Thermometer className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">Temperature Range</span>
                <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {weather.summary.tempRange}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">Across trip dates</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <WeatherIcon category={weather.current?.conditionCategory || 'clear'} className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">General Condition</span>
                <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {weather.summary.predominantCondition}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">Most common forecast</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl ${
                  weather.summary.hasRainExpected
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block">Rain Probability</span>
                <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {weather.summary.hasRainExpected
                    ? `Up to ${weather.summary.maxRainChance}%`
                    : 'Low Chance (< 30%)'}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  {weather.summary.hasRainExpected ? 'Pack an umbrella' : 'Clear outdoor weather'}
                </span>
              </div>
            </div>
          </div>

          {/* Current Weather Banner (if available) */}
          {weather.current && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <WeatherIcon category={weather.current.conditionCategory} className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                      Current Conditions
                    </span>
                    <span className="text-xs text-blue-200">• {trip.destinationName}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold">{weather.current.formattedTemp}</span>
                    <span className="text-sm font-medium text-blue-100">{weather.current.condition}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs text-blue-100 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/20">
                {typeof weather.current.windSpeed === 'number' && (
                  <div>
                    <span className="text-blue-200 block">Wind</span>
                    <span className="font-semibold text-white">{weather.current.windSpeed} km/h</span>
                  </div>
                )}
                {typeof weather.current.apparentTemperature === 'number' && (
                  <div>
                    <span className="text-blue-200 block">Feels Like</span>
                    <span className="font-semibold text-white">
                      {Math.round(weather.current.apparentTemperature)}°C
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Day-wise Forecast Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Day-by-Day Itinerary Forecast
                </h3>
              </div>
              <span className="text-xs text-zinc-400">
                {weather.days.length} {weather.days.length === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {weather.days.map((day) => (
                <WeatherCard key={day.date} day={day} isToday={day.date === todayStr} />
              ))}
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>
                Coordinates: {weather.latitude.toFixed(4)}° N, {weather.longitude.toFixed(4)}° E (
                {weather.timezone})
              </span>
            </div>
            <div className="mt-1 sm:mt-0">
              <span>Forecast powered by Open-Meteo • </span>
              {weather.isCached ? (
                <span className="text-zinc-500 dark:text-zinc-400">Cached snapshot</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Live data</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
