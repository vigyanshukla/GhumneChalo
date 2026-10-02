'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchInput } from './SearchInput';
import { SearchSuggestions } from './SearchSuggestions';
import { RecentSearches } from './RecentSearches';
import { OftenSearched } from './OftenSearched';
import { NormalizedPlace, SearchHistoryItem } from './types';

const GUEST_STORAGE_KEY = 'ghumnechalo_guest_recent_searches';
const DEBOUNCE_DELAY_MS = 350;
const CACHE_TTL_MS = 60000;

let historyCachePromise: Promise<{ recent: SearchHistoryItem[]; often: SearchHistoryItem[] }> | null = null;
let cachedHistoryData: { recent: SearchHistoryItem[]; often: SearchHistoryItem[]; timestamp: number } | null = null;

export function invalidateSearchHistoryCache(): void {
  historyCachePromise = null;
  cachedHistoryData = null;
}

async function fetchSharedSearchHistory(): Promise<{ recent: SearchHistoryItem[]; often: SearchHistoryItem[] }> {
  const now = Date.now();
  if (cachedHistoryData && now - cachedHistoryData.timestamp < CACHE_TTL_MS) {
    return { recent: cachedHistoryData.recent, often: cachedHistoryData.often };
  }
  if (historyCachePromise) {
    return historyCachePromise;
  }

  historyCachePromise = (async () => {
    try {
      const [recentRes, oftenRes] = await Promise.allSettled([
        fetch('/api/search/recent?limit=6'),
        fetch('/api/search/often?limit=5'),
      ]);

      let recent: SearchHistoryItem[] = [];
      let often: SearchHistoryItem[] = [];
      let loadedRecent = false;

      if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
        const json = await recentRes.value.json();
        if (json.success && Array.isArray(json.data)) {
          recent = json.data;
          loadedRecent = recent.length > 0;
        }
      }

      if (oftenRes.status === 'fulfilled' && oftenRes.value.ok) {
        const json = await oftenRes.value.json();
        if (json.success && Array.isArray(json.data)) {
          often = json.data;
        }
      }

      if (!loadedRecent && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(GUEST_STORAGE_KEY);
          if (raw) {
            const guestItems = JSON.parse(raw);
            if (Array.isArray(guestItems)) {
              recent = guestItems.slice(0, 6);
            }
          }
        } catch {
          // ignore localStorage parsing errors
        }
      }

      cachedHistoryData = { recent, often, timestamp: Date.now() };
      return { recent, often };
    } finally {
      historyCachePromise = null;
    }
  })();

  return historyCachePromise;
}

export interface SearchBoxProps {
  onSelectPlace: (place: NormalizedPlace) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBox({
  onSelectPlace,
  placeholder = 'Search destinations, cities, or landmarks...',
  className = '',
}: SearchBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NormalizedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  // History state
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [oftenSearched, setOftenSearched] = useState<SearchHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch recent & often searched on demand with deduplication
  const loadSearchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchSharedSearchHistory();
      setRecentSearches(data.recent);
      setOftenSearched(data.often);
    } catch (err) {
      console.warn('[SearchBox] Unable to load search history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Click outside listener to dismiss suggestion dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced Place Search Effect
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(trimmed)}&limit=8`);
        if (!res.ok) {
          throw new Error('Search request failed');
        }
        const json = await res.json();
        if (json.success) {
          setSuggestions(json.data || []);
          setActiveIndex(-1);
        } else {
          setError(json.error?.message || 'Search error');
          setSuggestions([]);
        }
      } catch (err) {
        console.error('[SearchBox] Search error:', err);
        setError('Unable to load destinations. Check your connection.');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Record Search in History
  const recordSearch = useCallback(async (place: NormalizedPlace) => {
    try {
      // 1. Attempt server-side save
      const res = await fetch('/api/search/recent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: place.name,
          placeId: place.placeId,
          placeName: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
        }),
      });

      if (res.ok) {
        // Invalidate cache and refresh authenticated history
        invalidateSearchHistoryCache();
        loadSearchHistory();
        return;
      }
    } catch {
      // Network or unauthenticated
    }

    // 2. Fallback to guest localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(GUEST_STORAGE_KEY);
        const current: SearchHistoryItem[] = raw ? JSON.parse(raw) : [];
        const filtered = current.filter((item) => item.placeId !== place.placeId && item.query !== place.name);
        const updated: SearchHistoryItem[] = [
          {
            query: place.name,
            placeId: place.placeId,
            placeName: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            searchedAt: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, 10);

        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
        setRecentSearches(updated.slice(0, 6));
      } catch {
        // LocalStorage quota or access denied
      }
    }
  }, [loadSearchHistory]);

  // Handle Place Selection
  const handleSelectPlace = useCallback(
    (place: NormalizedPlace) => {
      setQuery(place.name);
      setIsOpen(false);
      setActiveIndex(-1);
      setSuggestions([]);
      recordSearch(place);
      onSelectPlace(place);
    },
    [onSelectPlace, recordSearch]
  );

  // Handle selecting from Recent Searches
  const handleSelectRecent = useCallback(
    (item: SearchHistoryItem) => {
      if (item.latitude != null && item.longitude != null && item.placeId) {
        handleSelectPlace({
          placeId: item.placeId,
          name: item.placeName || item.query,
          formattedAddress: item.query,
          latitude: item.latitude,
          longitude: item.longitude,
        });
      } else {
        setQuery(item.query);
        setIsOpen(true);
      }
    },
    [handleSelectPlace]
  );

  // Clear Recent Searches
  const handleClearRecent = useCallback(async () => {
    invalidateSearchHistoryCache();
    // 1. Try server clear
    try {
      await fetch('/api/search/history', { method: 'DELETE' });
    } catch {
      // ignore
    }

    // 2. Clear guest storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    setRecentSearches([]);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelectPlace(suggestions[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    },
    [isOpen, activeIndex, suggestions, handleSelectPlace]
  );

  const showSuggestions = isOpen && query.trim().length >= 2;
  const showHistory = isOpen && query.trim().length < 2 && (recentSearches.length > 0 || oftenSearched.length > 0);

  return (
    <div ref={containerRef} className={`relative w-full max-w-xl ${className}`}>
      {/* Search Input Box */}
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={(val) => {
          setQuery(val);
          setIsOpen(true);
        }}
        onClear={() => {
          setQuery('');
          setSuggestions([]);
          setActiveIndex(-1);
          setIsOpen(false);
          inputRef.current?.focus();
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsOpen(true);
          void loadSearchHistory();
        }}
        isOpen={isOpen}
        activeDescendantId={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
        placeholder={placeholder}
      />

      {/* Floating Suggestions / History Panel */}
      <div className="absolute left-0 right-0 top-full mt-2 z-30 space-y-2">
        {showSuggestions && (
          <SearchSuggestions
            suggestions={suggestions}
            activeIndex={activeIndex}
            isLoading={isLoading}
            error={error}
            query={query}
            onSelect={handleSelectPlace}
          />
        )}

        {showHistory && (
          <div className="space-y-2">
            {recentSearches.length > 0 && (
              <RecentSearches
                searches={recentSearches}
                onSelect={handleSelectRecent}
                onClear={handleClearRecent}
                isLoading={isLoadingHistory}
              />
            )}

            {oftenSearched.length > 0 && (
              <OftenSearched
                items={oftenSearched}
                onSelect={handleSelectRecent}
                isLoading={isLoadingHistory}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
