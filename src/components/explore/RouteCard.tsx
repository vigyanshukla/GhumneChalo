'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Car,
  Footprints,
  Bus,
  Bike,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Navigation,
  LocateFixed,
  Search,
  ArrowUpDown,
  MapPin,
  Pencil,
} from 'lucide-react';
import { TravelMode, NormalizedRoute, RouteCoordinate } from '@/lib/maps/routes';
import { NormalizedPlace } from '@/components/search/types';

export interface RouteCardProps {
  origin: RouteCoordinate | null;
  destination: RouteCoordinate;
  route: NormalizedRoute | null;
  isLoading: boolean;
  error: string | null;
  travelMode: TravelMode;
  onSelectTravelMode: (mode: TravelMode) => void;
  onClose: () => void;
  onRetry?: () => void;
  onChangeOrigin?: (origin: RouteCoordinate) => void;
  onSwap?: () => void;
  className?: string;
}

const TRAVEL_MODES: Array<{
  mode: TravelMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { mode: 'DRIVE', label: 'Drive', icon: Car },
  { mode: 'TWO_WHEELER', label: 'Two-Wheeler', icon: Bike },
  { mode: 'WALK', label: 'Walk', icon: Footprints },
  { mode: 'TRANSIT', label: 'Transit', icon: Bus },
];

export function RouteCard({
  origin,
  destination,
  route,
  isLoading,
  error,
  travelMode,
  onSelectTravelMode,
  onClose,
  onRetry,
  onChangeOrigin,
  onSwap,
  className = '',
}: RouteCardProps) {
  // Origin Search / Geolocation State
  const [isEditingOrigin, setIsEditingOrigin] = useState(false);
  const [originQuery, setOriginQuery] = useState(origin?.name || '');
  const [suggestions, setSuggestions] = useState<NormalizedPlace[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep origin query in sync with origin prop when not editing
  useEffect(() => {
    if (!isEditingOrigin) {
      setOriginQuery(origin?.name || '');
    }
  }, [origin?.name, isEditingOrigin]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingOrigin) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isEditingOrigin]);

  // Close search suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsEditingOrigin(false);
        setSuggestions([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Request browser GPS position
  const handleUseCurrentLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingGps(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingGps(false);
        setIsEditingOrigin(false);
        const newOrigin: RouteCoordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Your Current Location',
        };
        onChangeOrigin?.(newOrigin);
      },
      (geoErr) => {
        setIsLocatingGps(false);
        let msg = 'Unable to retrieve your location.';
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser or search a starting location below.';
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable. Please search your starting location.';
        } else if (geoErr.code === geoErr.TIMEOUT) {
          msg = 'Location request timed out. Please try again or search.';
        }
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [onChangeOrigin]);

  // Debounced Place Search
  const handleSearchChange = (q: string) => {
    setOriginQuery(q);
    setLocationError(null);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    setIsSearchingPlaces(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSuggestions(json.data);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 280);
  };

  // Select place from autocomplete
  const handleSelectPlace = (place: NormalizedPlace) => {
    const newOrigin: RouteCoordinate = {
      lat: place.latitude,
      lng: place.longitude,
      name: place.name || place.formattedAddress,
    };
    onChangeOrigin?.(newOrigin);
    setIsEditingOrigin(false);
    setSuggestions([]);
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Route directions and information"
      className={`fixed sm:absolute bottom-3 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-auto sm:w-[420px] max-w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 dark:border-zinc-800 p-3.5 sm:p-4 z-30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${className}`}
    >
      {/* CASE 1: Location is OFF or Origin not yet selected */}
      {!origin ? (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
              <span className="text-slate-500 dark:text-zinc-400 font-medium shrink-0">To:</span>
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {destination?.name || 'Destination'}
              </span>
            </div>
            <button
              type="button"
              id="route-card-close-btn"
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
              aria-label="Close directions"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Location Off Prompt */}
          <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <LocateFixed className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold">Location Access Needed</h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Turn on location access to get accurate directions from your current spot to{' '}
                  <strong className="font-semibold">{destination?.name || 'your destination'}</strong>, or search a starting city.
                </p>
              </div>
            </div>
          </div>

          {locationError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium px-1">
              {locationError}
            </p>
          )}

          {/* Action 1: Turn On Location Button */}
          <div className="space-y-2">
            <button
              type="button"
              id="btn-turn-on-location"
              onClick={handleUseCurrentLocation}
              disabled={isLocatingGps}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-60"
            >
              {isLocatingGps ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
              <span>{isLocatingGps ? 'Detecting Location...' : 'Turn On Location (Use GPS)'}</span>
            </button>

            {/* Action 2: Or Search Starting City */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  id="input-search-origin-fallback"
                  value={originQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Or search starting city, station, or address..."
                  className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isSearchingPlaces && (
                  <Loader2 className="w-3.5 h-3.5 absolute right-2.5 text-blue-600 animate-spin" />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div
                  id="origin-fallback-suggestions"
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-700 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-zinc-700/60 max-h-48 overflow-y-auto"
                >
                  {suggestions.map((p) => (
                    <button
                      key={p.placeId || `${p.latitude}-${p.longitude}`}
                      type="button"
                      data-testid="origin-suggestion-item"
                      onClick={() => handleSelectPlace(p)}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium truncate">{p.name}</div>
                        {p.formattedAddress && (
                          <div className="text-[10px] text-slate-400 dark:text-zinc-400 truncate">
                            {p.formattedAddress}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CASE 2: Origin is Selected -> Standard Route Display */
        <>
          {/* Header with Origin -> Destination indicator & Controls */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Origin Section */}
              <div className="relative">
                {!isEditingOrigin ? (
                  <div className="flex items-center justify-between gap-2 group">
                    <div
                      onClick={() => setIsEditingOrigin(true)}
                      className="flex items-center gap-2 text-xs flex-1 min-w-0 cursor-pointer p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors"
                      title="Click to change starting location"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                      <span className="text-slate-500 dark:text-zinc-400 font-medium shrink-0">From:</span>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                        {origin.name || `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
                      </span>
                      <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick GPS Location button */}
                      <button
                        type="button"
                        id="route-card-gps-btn"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocatingGps}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer disabled:opacity-60"
                        title="Use my current GPS location"
                      >
                        {isLocatingGps ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LocateFixed className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">GPS</span>
                      </button>

                      {/* Swap From / To */}
                      {onSwap && (
                        <button
                          type="button"
                          id="route-card-swap-btn"
                          onClick={onSwap}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Swap starting point and destination"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Inline Origin Search Input */
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={originQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search city, station, or address..."
                        className="w-full pl-8 pr-16 py-1.5 text-xs rounded-xl border border-blue-500 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <div className="absolute right-1.5 flex items-center gap-1">
                        {isSearchingPlaces && (
                          <Loader2 className="w-3 h-3 text-blue-600 animate-spin mr-1" />
                        )}
                        <button
                          type="button"
                          onClick={() => setIsEditingOrigin(false)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Suggestions Dropdown */}
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-700 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-zinc-700/60 max-h-48 overflow-y-auto">
                      {/* Current Location Option */}
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocatingGps}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 flex items-center gap-2 cursor-pointer"
                      >
                        {isLocatingGps ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LocateFixed className="w-3.5 h-3.5" />
                        )}
                        <span>Use My Current Location</span>
                      </button>

                      {suggestions.map((p) => (
                        <button
                          key={p.placeId || `${p.latitude}-${p.longitude}`}
                          type="button"
                          onClick={() => handleSelectPlace(p)}
                          className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <div className="truncate">
                            <div className="font-medium truncate">{p.name}</div>
                            {p.formattedAddress && (
                              <div className="text-[10px] text-slate-400 dark:text-zinc-400 truncate">
                                {p.formattedAddress}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}

                      {originQuery.trim().length >= 2 && !isSearchingPlaces && suggestions.length === 0 && (
                        <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-zinc-500 italic">
                          No matching places found. Try another city or station name.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {locationError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                  {locationError}
                </p>
              )}

              {/* Destination */}
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                <span className="text-slate-500 dark:text-zinc-400 font-medium shrink-0">To:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate">
                  {destination?.name || (destination ? `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}` : 'Destination')}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="route-card-close-btn-active"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close and clear route"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Travel Mode Selector Tabs */}
          <div
            role="tablist"
            aria-label="Travel modes"
            className="flex items-center gap-1.5 py-3 border-b border-slate-100 dark:border-zinc-800 overflow-x-auto no-scrollbar"
          >
            {TRAVEL_MODES.map((item) => {
              const Icon = item.icon;
              const isSelected = travelMode === item.mode;
              return (
                <button
                  key={item.mode}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  disabled={isLoading}
                  onClick={() => onSelectTravelMode(item.mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Route Content Area */}
          <div className="pt-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-4 text-xs font-medium text-slate-500 dark:text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Calculating best route...</span>
              </div>
            ) : error ? (
              <div className="py-2 space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">Unable to find route</p>
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">{error}</p>
                  </div>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry route calculation</span>
                  </button>
                )}
              </div>
            ) : route ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {route.durationText}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                      ({route.distanceText})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
                    <Navigation className="w-3 h-3" />
                    <span>Fastest</span>
                  </div>
                </div>

                {route.description && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">
                    via {route.description}
                  </p>
                )}

                {route.warnings && route.warnings.length > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-normal">
                    {route.warnings[0]}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
