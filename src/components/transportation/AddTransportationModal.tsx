'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  MapPin,
  Clock,
  IndianRupee,
  Tag,
  Calendar,
  FileText,
  Loader2,
  Navigation,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { NormalizedPlace } from '@/components/search/types';
import {
  TransportationData,
  TransportationFormData,
  TransportationType,
  TRANSPORTATION_TYPE_CONFIG,
  RouteCoordinate,
} from './types';

interface ItineraryDayOption {
  id: string;
  dayNumber: number;
  date: string | Date;
  title?: string | null;
}

interface AddTransportationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransportationFormData) => Promise<void>;
  initialData?: TransportationData | null;
  itineraryDays: ItineraryDayOption[];
  tripCurrency?: string;
}

export function AddTransportationModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  itineraryDays,
  tripCurrency = 'INR',
}: AddTransportationModalProps) {
  const [type, setType] = useState<TransportationType>(initialData?.type || 'FLIGHT');
  const [origin, setOrigin] = useState(initialData?.origin || '');
  const [destination, setDestination] = useState(initialData?.destination || '');

  const [originCoords, setOriginCoords] = useState<RouteCoordinate | null>(
    initialData?.originCoordinates || null
  );
  const [destCoords, setDestCoords] = useState<RouteCoordinate | null>(
    initialData?.destinationCoordinates || null
  );

  // Date-Time strings for <input type="datetime-local" />
  const toLocalInputString = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const [departureTime, setDepartureTime] = useState(
    toLocalInputString(initialData?.departureTime)
  );
  const [arrivalTime, setArrivalTime] = useState(
    toLocalInputString(initialData?.arrivalTime)
  );

  const [provider, setProvider] = useState(initialData?.provider || '');
  const [bookingReference, setBookingReference] = useState(
    initialData?.bookingReference || ''
  );
  const [cost, setCost] = useState(
    initialData?.cost !== null && initialData?.cost !== undefined
      ? String(initialData.cost)
      : ''
  );
  const [itineraryDayId, setItineraryDayId] = useState(
    initialData?.itineraryDayId || ''
  );
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Route preview metrics
  const [distanceMeters, setDistanceMeters] = useState<number | null>(
    initialData?.distanceMeters ?? null
  );
  const [durationSeconds, setDurationSeconds] = useState<number | null>(
    initialData?.durationSeconds ?? null
  );
  const [formattedDistance, setFormattedDistance] = useState<string | null>(
    initialData?.formattedDistance ?? null
  );
  const [formattedDuration, setFormattedDuration] = useState<string | null>(
    initialData?.formattedDuration ?? null
  );
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Origin Places Autocomplete
  const [originSuggestions, setOriginSuggestions] = useState<NormalizedPlace[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const originDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const originContainerRef = useRef<HTMLDivElement>(null);

  // Destination Places Autocomplete
  const [destSuggestions, setDestSuggestions] = useState<NormalizedPlace[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const destDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const destContainerRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state on initialData or isOpen change
  useEffect(() => {
    queueMicrotask(() => {
      if (initialData) {
        setType(initialData.type);
        setOrigin(initialData.origin);
        setDestination(initialData.destination);
        setOriginCoords(initialData.originCoordinates || null);
        setDestCoords(initialData.destinationCoordinates || null);
        setDepartureTime(toLocalInputString(initialData.departureTime));
        setArrivalTime(toLocalInputString(initialData.arrivalTime));
        setProvider(initialData.provider || '');
        setBookingReference(initialData.bookingReference || '');
        setCost(initialData.cost !== null ? String(initialData.cost) : '');
        setItineraryDayId(initialData.itineraryDayId || '');
        setNotes(initialData.notes || '');
        setDistanceMeters(initialData.distanceMeters ?? null);
        setDurationSeconds(initialData.durationSeconds ?? null);
        setFormattedDistance(initialData.formattedDistance ?? null);
        setFormattedDuration(initialData.formattedDuration ?? null);
      } else {
        setType('FLIGHT');
        setOrigin('');
        setDestination('');
        setOriginCoords(null);
        setDestCoords(null);
        setDepartureTime('');
        setArrivalTime('');
        setProvider('');
        setBookingReference('');
        setCost('');
        setItineraryDayId('');
        setNotes('');
        setDistanceMeters(null);
        setDurationSeconds(null);
        setFormattedDistance(null);
        setFormattedDuration(null);
      }
      setShowOriginSuggestions(false);
      setShowDestSuggestions(false);
      setError(null);
    });
  }, [initialData, isOpen]);

  // Click outside listener for suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        originContainerRef.current &&
        !originContainerRef.current.contains(e.target as Node)
      ) {
        setShowOriginSuggestions(false);
      }
      if (
        destContainerRef.current &&
        !destContainerRef.current.contains(e.target as Node)
      ) {
        setShowDestSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Origin Places Search
  const handleOriginSearch = (q: string) => {
    setOrigin(q);
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (!q || q.trim().length < 2) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }
    setIsSearchingOrigin(true);
    originDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setOriginSuggestions(json.data);
            setShowOriginSuggestions(true);
          }
        }
      } catch {
        // Silently catch
      } finally {
        setIsSearchingOrigin(false);
      }
    }, 280);
  };

  const handleSelectOriginPlace = (place: NormalizedPlace) => {
    setOrigin(place.name || place.formattedAddress);
    setOriginCoords({ lat: place.latitude, lng: place.longitude, name: place.name });
    setShowOriginSuggestions(false);
    setOriginSuggestions([]);
    triggerRouteCalculation(
      { lat: place.latitude, lng: place.longitude },
      destCoords
    );
  };

  // Destination Places Search
  const handleDestSearch = (q: string) => {
    setDestination(q);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    if (!q || q.trim().length < 2) {
      setDestSuggestions([]);
      setShowDestSuggestions(false);
      return;
    }
    setIsSearchingDest(true);
    destDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setDestSuggestions(json.data);
            setShowDestSuggestions(true);
          }
        }
      } catch {
        // Silently catch
      } finally {
        setIsSearchingDest(false);
      }
    }, 280);
  };

  const handleSelectDestPlace = (place: NormalizedPlace) => {
    setDestination(place.name || place.formattedAddress);
    setDestCoords({ lat: place.latitude, lng: place.longitude, name: place.name });
    setShowDestSuggestions(false);
    setDestSuggestions([]);
    triggerRouteCalculation(
      originCoords,
      { lat: place.latitude, lng: place.longitude }
    );
  };

  // Route calculation helper reusing /api/routes (Phase 3D)
  const triggerRouteCalculation = async (
    from: RouteCoordinate | null,
    to: RouteCoordinate | null
  ) => {
    if (!from || !to) return;
    setIsCalculatingRoute(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: from.lat, lng: from.lng },
          destination: { lat: to.lat, lng: to.lng },
          travelMode: type === 'BUS' ? 'TRANSIT' : 'DRIVE',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDistanceMeters(json.data.distanceMeters ?? null);
          setDurationSeconds(json.data.durationSeconds ?? null);
          setFormattedDistance(json.data.distanceText ?? null);
          setFormattedDuration(json.data.durationText ?? null);
        }
      }
    } catch {
      // Graceful fallback on route calculation error
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim()) {
      setError('Origin is required.');
      return;
    }
    if (!destination.trim()) {
      setError('Destination is required.');
      return;
    }

    if (departureTime && arrivalTime) {
      const depDate = new Date(departureTime);
      const arrDate = new Date(arrivalTime);
      if (arrDate < depDate) {
        setError('Arrival time must be after departure time.');
        return;
      }
    }

    if (cost.trim()) {
      const numCost = parseFloat(cost.trim());
      if (isNaN(numCost) || numCost < 0) {
        setError('Cost cannot be negative.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        type,
        origin: origin.trim(),
        destination: destination.trim(),
        departureTime: departureTime ? new Date(departureTime).toISOString() : undefined,
        arrivalTime: arrivalTime ? new Date(arrivalTime).toISOString() : undefined,
        cost: cost.trim() ? parseFloat(cost.trim()) : null,
        currency: tripCurrency,
        notes: notes.trim() || undefined,
        provider: provider.trim() || undefined,
        bookingReference: bookingReference.trim() || undefined,
        itineraryDayId: itineraryDayId || null,
        originCoordinates: originCoords || undefined,
        destinationCoordinates: destCoords || undefined,
        distanceMeters: distanceMeters ?? undefined,
        durationSeconds: durationSeconds ?? undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save transportation record.'
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
      aria-labelledby="transportation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2
              id="transportation-modal-title"
              className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50"
            >
              {initialData ? 'Edit Journey' : 'Add Transportation'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Track flights, trains, buses, car rides, and ferries for this trip.
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

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Transportation Mode
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(
                ['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'FERRY', 'OTHER'] as TransportationType[]
              ).map((m) => {
                const conf = TRANSPORTATION_TYPE_CONFIG[m];
                const Icon = conf.icon;
                const isSelected = type === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setType(m)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      isSelected
                        ? `${conf.bgColor} ${conf.color} ${conf.borderColor} ring-2 ring-blue-500/20 shadow-xs`
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Journey Section: Origin & Destination with Places Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Origin */}
            <div ref={originContainerRef} className="relative">
              <label
                htmlFor="transport-origin-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Origin Place / Station <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-origin-input"
                  type="text"
                  required
                  value={origin}
                  onChange={(e) => handleOriginSearch(e.target.value)}
                  onFocus={() => {
                    if (originSuggestions.length > 0) setShowOriginSuggestions(true);
                  }}
                  placeholder="e.g. Mumbai Airport / CSMT"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {isSearchingOrigin && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
              </div>

              {/* Origin Suggestions Dropdown */}
              {showOriginSuggestions && originSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                  {originSuggestions.map((p) => (
                    <button
                      key={p.placeId}
                      type="button"
                      onClick={() => handleSelectOriginPlace(p)}
                      className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-blue-50/70 dark:hover:bg-zinc-700/60 border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0 text-xs transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {p.formattedAddress}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination */}
            <div ref={destContainerRef} className="relative">
              <label
                htmlFor="transport-dest-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Destination Place / Station <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-dest-input"
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => handleDestSearch(e.target.value)}
                  onFocus={() => {
                    if (destSuggestions.length > 0) setShowDestSuggestions(true);
                  }}
                  placeholder="e.g. Goa Dabolim / Madgaon"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {isSearchingDest && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
              </div>

              {/* Destination Suggestions Dropdown */}
              {showDestSuggestions && destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                  {destSuggestions.map((p) => (
                    <button
                      key={p.placeId}
                      type="button"
                      onClick={() => handleSelectDestPlace(p)}
                      className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-blue-50/70 dark:hover:bg-zinc-700/60 border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0 text-xs transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {p.formattedAddress}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Route Metrics Preview Pill (Requirement 8 & 9) */}
          {(formattedDistance || formattedDuration || isCalculatingRoute) && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 text-xs border border-blue-200/70 dark:border-blue-800/60 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                {isCalculatingRoute ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    Calculating driving/transit route metrics...
                  </span>
                ) : (
                  <span>
                    Calculated Route: <strong>{formattedDistance}</strong> (Est. Duration: <strong>{formattedDuration}</strong>)
                  </span>
                )}
              </div>
              {originCoords && destCoords && !isCalculatingRoute && (
                <button
                  type="button"
                  onClick={() => triggerRouteCalculation(originCoords, destCoords)}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Recalculate
                </button>
              )}
            </div>
          )}

          {/* Schedule: Departure & Arrival */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="transport-departure-time"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Departure Date & Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-departure-time"
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="transport-arrival-time"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Arrival Date & Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-arrival-time"
                  type="datetime-local"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Provider, PNR, Cost & Itinerary Day Association */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Provider */}
            <div>
              <label
                htmlFor="transport-provider"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Operator / Airline / Agency
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-provider"
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. IndiGo, IRCTC, Uber"
                  maxLength={100}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Booking Reference */}
            <div>
              <label
                htmlFor="transport-reference"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Booking Ref / PNR
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-reference"
                  type="text"
                  value={bookingReference}
                  onChange={(e) => setBookingReference(e.target.value)}
                  placeholder="e.g. 6E-5432 / PNR12345"
                  maxLength={100}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>

            {/* Cost */}
            <div>
              <label
                htmlFor="transport-cost"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Cost ({tripCurrency})
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  id="transport-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="e.g. 3500"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Itinerary Day Link */}
            <div>
              <label
                htmlFor="transport-itinerary-day"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Link to Itinerary Day
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <select
                  id="transport-itinerary-day"
                  value={itineraryDayId}
                  onChange={(e) => setItineraryDayId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">General Trip Journey (No Day Linked)</option>
                  {itineraryDays.map((d) => (
                    <option key={d.id} value={d.id}>
                      Day {d.dayNumber} {d.title ? `— ${d.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="transport-notes"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Notes / Instructions
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
              <textarea
                id="transport-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate number, baggage allowance, terminal info..."
                maxLength={500}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs sm:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
              id="save-transportation-btn"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{initialData ? 'Update Journey' : 'Save Transportation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
