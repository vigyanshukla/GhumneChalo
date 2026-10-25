'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Calendar,
  IndianRupee,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { TripFormData, TripStatus } from './types';
import { NormalizedPlace } from '@/components/search/types';

interface TripFormProps {
  initialData?: Partial<TripFormData>;
  isEditing?: boolean;
  onSubmit: (data: TripFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function TripForm({
  initialData,
  isEditing = false,
  onSubmit,
  onCancel,
  submitLabel,
}: TripFormProps) {
  // Form fields
  const [title, setTitle] = useState(initialData?.title || '');
  const [destinationName, setDestinationName] = useState(initialData?.destinationName || '');
  const [destinationPlaceId, setDestinationPlaceId] = useState(initialData?.destinationPlaceId || '');
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude ?? null);

  // Normalize date format to YYYY-MM-DD for <input type="date">
  const toDateInputString = (val?: string | Date) => {
    if (!val) return '';
    try {
      const d = typeof val === 'string' ? new Date(val) : val;
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const [startDate, setStartDate] = useState(toDateInputString(initialData?.startDate));
  const [endDate, setEndDate] = useState(toDateInputString(initialData?.endDate));
  const [totalBudget, setTotalBudget] = useState<string>(
    initialData?.totalBudget !== undefined && initialData?.totalBudget !== null
      ? String(initialData.totalBudget)
      : ''
  );
  const [currency, setCurrency] = useState(initialData?.currency || 'INR');
  const [status, setStatus] = useState<TripStatus>(initialData?.status || 'DRAFT');

  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState(initialData?.destinationName || '');
  const [suggestions, setSuggestions] = useState<NormalizedPlace[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Status & error tracking
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Close suggestions when clicking outside
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

  // Search Places API (Phase 3B reuse)
  const handleDestinationSearch = (q: string) => {
    setSearchQuery(q);
    setDestinationName(q); // Allow manual typing as fallback
    setErrors((prev) => ({ ...prev, destination: '' }));

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
        // Silently catch fetch failure
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 280);
  };

  const handleSelectPlace = (place: NormalizedPlace) => {
    setDestinationName(place.name || place.formattedAddress);
    setSearchQuery(place.name || place.formattedAddress);
    setDestinationPlaceId(place.placeId);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
    setShowSuggestions(false);
    setSuggestions([]);
    setErrors((prev) => ({ ...prev, destination: '' }));
  };

  const handleClearDestination = () => {
    setSearchQuery('');
    setDestinationName('');
    setDestinationPlaceId('');
    setLatitude(null);
    setLongitude(null);
    setShowSuggestions(false);
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Trip title is required';
    } else if (title.trim().length > 100) {
      newErrors.title = 'Title must be 100 characters or less';
    }

    if (!destinationName.trim()) {
      newErrors.destination = 'Destination is required';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        newErrors.endDate = 'End date cannot be earlier than start date';
      }
    }

    if (totalBudget) {
      const num = Number(totalBudget);
      if (isNaN(num) || num < 0) {
        newErrors.totalBudget = 'Budget must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TripFormData = {
        title: title.trim(),
        destinationName: destinationName.trim(),
        destinationPlaceId: destinationPlaceId || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        totalBudget: totalBudget ? Number(totalBudget) : undefined,
        currency,
        status,
      };

      await onSubmit(payload);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Duration calculation
  let durationDays: number | null = null;
  if (startDate && endDate) {
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (e >= s) {
      durationDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Trip Title */}
      <div>
        <label
          htmlFor="trip-title"
          className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
        >
          Trip Name <span className="text-rose-500">*</span>
        </label>
        <input
          id="trip-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
          }}
          placeholder="e.g. Goa Beach Escape, Leh Ladakh Expedition"
          maxLength={100}
          className={`w-full rounded-xl border px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none focus:ring-2 dark:text-zinc-100 dark:bg-zinc-800/80 ${
            errors.title
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500'
              : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700'
          }`}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'trip-title-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.title && (
          <p id="trip-title-error" className="mt-1.5 text-xs text-rose-500 font-medium">
            {errors.title}
          </p>
        )}
      </div>

      {/* Destination with Places API Autocomplete */}
      <div ref={searchContainerRef} className="relative">
        <label
          htmlFor="trip-destination"
          className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
        >
          Destination <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            {isSearchingPlaces ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <MapPin className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <input
            id="trip-destination"
            type="text"
            value={searchQuery}
            onChange={(e) => handleDestinationSearch(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Search destination (e.g., Jaipur, Manali, Kerala)..."
            className={`w-full rounded-xl border pl-10 pr-10 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none focus:ring-2 dark:text-zinc-100 dark:bg-zinc-800/80 ${
              errors.destination
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500'
                : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700'
            }`}
            aria-invalid={!!errors.destination}
            aria-describedby={errors.destination ? 'trip-destination-error' : undefined}
            disabled={isSubmitting}
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearDestination}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Clear destination"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {errors.destination && (
          <p id="trip-destination-error" className="mt-1.5 text-xs text-rose-500 font-medium">
            {errors.destination}
          </p>
        )}

        {/* Places Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-30 mt-1.5 w-full rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-800 max-h-60 overflow-y-auto"
          >
            {suggestions.map((place) => (
              <li
                key={place.placeId}
                role="option"
                aria-selected={destinationPlaceId === place.placeId}
                onClick={() => handleSelectPlace(place)}
                className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 cursor-pointer transition-colors"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {place.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {place.formattedAddress}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dates: Start & End */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="trip-start-date"
            className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
          >
            Start Date <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="trip-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: '' }));
                if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: '' }));
              }}
              className={`w-full rounded-xl border px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none focus:ring-2 dark:text-zinc-100 dark:bg-zinc-800/80 ${
                errors.startDate
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500'
                  : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700'
              }`}
              aria-invalid={!!errors.startDate}
              aria-describedby={errors.startDate ? 'trip-start-error' : undefined}
              disabled={isSubmitting}
            />
          </div>
          {errors.startDate && (
            <p id="trip-start-error" className="mt-1.5 text-xs text-rose-500 font-medium">
              {errors.startDate}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="trip-end-date"
            className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
          >
            End Date <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="trip-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: '' }));
              }}
              className={`w-full rounded-xl border px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none focus:ring-2 dark:text-zinc-100 dark:bg-zinc-800/80 ${
                errors.endDate
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500'
                  : 'border-zinc-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700'
              }`}
              aria-invalid={!!errors.endDate}
              aria-describedby={errors.endDate ? 'trip-end-error' : undefined}
              disabled={isSubmitting}
            />
          </div>
          {errors.endDate && (
            <p id="trip-end-error" className="mt-1.5 text-xs text-rose-500 font-medium">
              {errors.endDate}
            </p>
          )}
        </div>
      </div>

      {/* Duration Helper */}
      {durationDays !== null && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            Trip Duration: {durationDays} {durationDays === 1 ? 'day' : 'days'}
          </span>
        </div>
      )}

      {/* Budget & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label
            htmlFor="trip-budget"
            className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
          >
            Estimated Budget (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <IndianRupee className="w-4 h-4" />
            </div>
            <input
              id="trip-budget"
              type="number"
              min="0"
              step="100"
              value={totalBudget}
              onChange={(e) => {
                setTotalBudget(e.target.value);
                if (errors.totalBudget) setErrors((prev) => ({ ...prev, totalBudget: '' }));
              }}
              placeholder="e.g. 25000"
              className="w-full rounded-xl border border-zinc-200 pl-10 pr-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:text-zinc-100 dark:bg-zinc-800/80"
              disabled={isSubmitting}
            />
          </div>
          {errors.totalBudget && (
            <p className="mt-1.5 text-xs text-rose-500 font-medium">{errors.totalBudget}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="trip-currency"
            className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
          >
            Currency
          </label>
          <select
            id="trip-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:text-zinc-100 dark:bg-zinc-800"
            disabled={isSubmitting}
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AED">AED (د.إ)</option>
          </select>
        </div>
      </div>

      {/* Trip Status (When editing) */}
      {isEditing && (
        <div>
          <label
            htmlFor="trip-status"
            className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"
          >
            Status
          </label>
          <select
            id="trip-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TripStatus)}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:text-zinc-100 dark:bg-zinc-800"
            disabled={isSubmitting}
          >
            <option value="DRAFT">Planning (Draft)</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="ACTIVE">Active (In Progress)</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{submitLabel || (isEditing ? 'Save Changes' : 'Create Trip')}</span>
          )}
        </button>
      </div>
    </form>
  );
}
