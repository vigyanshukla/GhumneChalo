'use client';

import React, { useEffect, useState, useRef } from 'react';
import { CategoryFilterBar } from './CategoryFilterBar';
import { PlaceCard } from './PlaceCard';
import { DiscoveryCategoryKey, NormalizedDiscoveryPlace } from './types';
import { MapPin, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

export interface DiscoveryFeedProps {
  anchorLocation: { lat: number; lng: number; name?: string };
  selectedPlaceId?: string | null;
  onSelectPlace: (place: NormalizedDiscoveryPlace) => void;
  onPlacesLoaded?: (places: NormalizedDiscoveryPlace[]) => void;
  className?: string;
}

const discoveryCache = new Map<string, { data: NormalizedDiscoveryPlace[]; timestamp: number }>();
const DISCOVERY_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function DiscoveryFeed({
  anchorLocation,
  selectedPlaceId,
  onSelectPlace,
  onPlacesLoaded,
  className = '',
}: DiscoveryFeedProps) {
  const [activeCategory, setActiveCategory] = useState<DiscoveryCategoryKey>('attractions');
  const [places, setPlaces] = useState<NormalizedDiscoveryPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stale request protection counter & stable callback ref
  const requestIdRef = useRef(0);
  const onPlacesLoadedRef = useRef(onPlacesLoaded);
  useEffect(() => {
    onPlacesLoadedRef.current = onPlacesLoaded;
  }, [onPlacesLoaded]);

  useEffect(() => {
    let ignore = false;
    const currentRequestId = ++requestIdRef.current;
    const cacheKey = `${anchorLocation.lat.toFixed(4)}_${anchorLocation.lng.toFixed(4)}_${activeCategory}`;

    async function executeDiscovery() {
      // Check in-memory cache first
      const cached = discoveryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < DISCOVERY_TTL_MS) {
        if (ignore || requestIdRef.current !== currentRequestId) return;
        setPlaces(cached.data);
        setError(null);
        setIsLoading(false);
        onPlacesLoadedRef.current?.(cached.data);
        return;
      }

      try {
        const url = `/api/places/discover?lat=${anchorLocation.lat}&lng=${anchorLocation.lng}&category=${activeCategory}&limit=10`;
        const res = await fetch(url);

        if (ignore || requestIdRef.current !== currentRequestId) return;

        if (!res.ok) {
          throw new Error('Failed to load places');
        }

        const json = await res.json();
        if (ignore || requestIdRef.current !== currentRequestId) return;

        if (json.success && Array.isArray(json.data)) {
          discoveryCache.set(cacheKey, { data: json.data, timestamp: Date.now() });
          setPlaces(json.data);
          setError(null);
          onPlacesLoadedRef.current?.(json.data);
        } else {
          setError(json.error?.message || 'Unable to discover places');
          setPlaces([]);
          onPlacesLoadedRef.current?.([]);
        }
      } catch (err) {
        if (!ignore && requestIdRef.current === currentRequestId) {
          console.error('[DiscoveryFeed] Fetch error:', err);
          setError('Unable to load places. Please check your connection.');
          setPlaces([]);
          onPlacesLoadedRef.current?.([]);
        }
      } finally {
        if (!ignore && requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    }

    void executeDiscovery();

    return () => {
      ignore = true;
    };
  }, [activeCategory, anchorLocation.lat, anchorLocation.lng]);

  const handleCategorySelect = (category: DiscoveryCategoryKey) => {
    setIsLoading(true);
    setError(null);
    setActiveCategory(category);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    // Re-trigger by touching category state or calling execute directly
    setActiveCategory((prev) => prev);
  };

  return (
    <div className={`flex flex-col h-full space-y-3 ${className}`}>
      {/* Category Filter Bar */}
      <div className="shrink-0">
        <CategoryFilterBar
          activeCategory={activeCategory}
          onSelectCategory={handleCategorySelect}
          disabled={isLoading && places.length === 0}
        />
      </div>

      {/* Discovery Context Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 shrink-0 px-1">
        <div className="flex items-center gap-1.5 truncate">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="truncate">
            Nearby <span className="font-semibold text-slate-700 dark:text-zinc-200">{anchorLocation.name || 'Current Location'}</span>
          </span>
        </div>
        {!isLoading && places.length > 0 && (
          <span className="font-medium shrink-0">
            {places.length} places found
          </span>
        )}
      </div>

      {/* Places Scrollable List / Content Area */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800 min-h-0">
        {/* 1. Loading State */}
        {isLoading && (
          <div className="space-y-3" aria-busy="true" aria-label="Loading places">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 animate-pulse space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-1/2 h-4 rounded bg-slate-200 dark:bg-zinc-800" />
                  <div className="w-12 h-4 rounded bg-slate-100 dark:bg-zinc-850" />
                </div>
                <div className="w-3/4 h-3 rounded bg-slate-100 dark:bg-zinc-850" />
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between">
                  <div className="w-20 h-3 rounded bg-slate-100 dark:bg-zinc-850" />
                  <div className="w-16 h-3 rounded bg-slate-100 dark:bg-zinc-850" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Error State */}
        {!isLoading && error && (
          <div
            role="alert"
            className="p-6 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-red-200/80 dark:border-red-900/40 shadow-sm space-y-3"
          >
            <div className="flex justify-center text-red-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">
              {error}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* 3. Empty State */}
        {!isLoading && !error && places.length === 0 && (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-2">
            <div className="flex justify-center text-slate-300 dark:text-zinc-600 mb-1">
              <MapPin className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
              No {activeCategory} found nearby
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
              Try switching categories or picking a different popular destination above.
            </p>
          </div>
        )}

        {/* 4. Discovered Place Cards */}
        {!isLoading && !error && places.length > 0 && (
          <div className="space-y-2.5">
            {places.map((place) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                isSelected={selectedPlaceId === place.placeId}
                onSelect={onSelectPlace}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
