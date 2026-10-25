'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  MapPin,
  Clock,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { NormalizedPlace } from '@/components/search/types';
import { ItineraryItemData, ItineraryItemFormData } from './types';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ItineraryItemFormData) => Promise<void>;
  initialData?: ItineraryItemData | null;
  dayNumber: number;
}

export function AddActivityModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  dayNumber,
}: AddActivityModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [placeId, setPlaceId] = useState<string | undefined>(
    initialData?.placeId || undefined
  );
  const [latitude, setLatitude] = useState<number | null>(
    initialData?.latitude ?? null
  );
  const [longitude, setLongitude] = useState<number | null>(
    initialData?.longitude ?? null
  );
  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Places Search Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NormalizedPlace[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset/populate fields when opened or initialData changes
  useEffect(() => {
    queueMicrotask(() => {
      if (initialData) {
        setName(initialData.name);
        setPlaceId(initialData.placeId || undefined);
        setLatitude(initialData.latitude ?? null);
        setLongitude(initialData.longitude ?? null);
        setStartTime(initialData.startTime || '');
        setEndTime(initialData.endTime || '');
        setNotes(initialData.notes || '');
        setSearchQuery('');
      } else {
        setName('');
        setPlaceId(undefined);
        setLatitude(null);
        setLongitude(null);
        setStartTime('');
        setEndTime('');
        setNotes('');
        setSearchQuery('');
      }
      setError(null);
      setShowSuggestions(false);
    });
  }, [initialData, isOpen]);

  // Handle outside click for search suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced Places API search
  const handlePlaceSearch = (q: string) => {
    setSearchQuery(q);
    if (!name) {
      setName(q); // Pre-fill name if user hasn't typed one
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingPlaces(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setSuggestions(json.data);
            setShowSuggestions(true);
          }
        }
      } catch {
        // Silently handle search error
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 280);
  };

  const handleSelectPlace = (place: NormalizedPlace) => {
    setName(place.name || place.formattedAddress);
    setSearchQuery(place.name || place.formattedAddress);
    setPlaceId(place.placeId);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setShowSuggestions(false);
    setSuggestions([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide an activity or place name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        placeId: placeId || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save itinerary activity.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2
              id="activity-modal-title"
              className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50"
            >
              {initialData ? 'Edit Activity' : `Add Activity to Day ${dayNumber}`}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Plan visits to attractions, dining, sightseeing, or custom events.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Places Search Autocomplete Integration (Phase 3B reuse) */}
          <div ref={searchContainerRef} className="relative">
            <label
              htmlFor="place-search-input"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Search Destination / Attraction
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="place-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => handlePlaceSearch(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Search Places (e.g. Amber Fort, Hawa Mahal...)"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {isSearchingPlaces && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                {suggestions.map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(p)}
                    className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-blue-50/70 dark:hover:bg-zinc-700/60 border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {p.formattedAddress}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Place linked indicator */}
          {placeId && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Location linked to Google Places ({latitude?.toFixed(4)}°, {longitude?.toFixed(4)}°)</span>
            </div>
          )}

          {/* Activity / Place Title */}
          <div>
            <label
              htmlFor="activity-name-input"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Activity Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="activity-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amber Palace Guided Tour"
              maxLength={150}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Time Slots (Start Time & End Time) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="activity-start-time"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Start Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="activity-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="activity-end-time"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                End Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="activity-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Notes / Tips */}
          <div>
            <label
              htmlFor="activity-notes"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Notes / Instructions
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <textarea
                id="activity-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Booking notes, ticket details, clothing guidelines..."
                maxLength={1000}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-none"
              />
            </div>
            <p className="text-[10px] text-zinc-400 text-right mt-0.5">
              {notes.length}/1000 characters
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="save-activity-btn"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{initialData ? 'Update Activity' : 'Add Activity'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
