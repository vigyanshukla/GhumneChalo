'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Minus, LocateFixed, Compass, Loader2 } from 'lucide-react';
import { UserLocation } from './UserLocationMarker';

export type GeolocationErrorType =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED';

export interface MapControlsProps {
  map: google.maps.Map | null;
  defaultCenter: { lat: number; lng: number };
  defaultZoom?: number;
  onLocationFound?: (location: UserLocation) => void;
  onLocationError?: (error: GeolocationErrorType) => void;
  className?: string;
}

export function MapControls({
  map,
  defaultCenter,
  defaultZoom = 12,
  onLocationFound,
  onLocationError,
  className = '',
}: MapControlsProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const showTemporaryNotice = useCallback((msg: string) => {
    setGeoNotice(msg);
    const timer = setTimeout(() => {
      setGeoNotice(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    const current = map.getZoom() || defaultZoom;
    map.setZoom(current + 1);
  }, [map, defaultZoom]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    const current = map.getZoom() || defaultZoom;
    map.setZoom(Math.max(1, current - 1));
  }, [map, defaultZoom]);

  const handleRecenter = useCallback(() => {
    if (!map) return;
    map.panTo(defaultCenter);
    map.setZoom(defaultZoom);
  }, [map, defaultCenter, defaultZoom]);

  const handleUseMyLocation = useCallback(() => {
    if (!map) return;

    if (typeof window === 'undefined' || !navigator?.geolocation) {
      onLocationError?.('NOT_SUPPORTED');
      showTemporaryNotice('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const loc: UserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        // Center and zoom in smoothly to user
        map.panTo({ lat: loc.lat, lng: loc.lng });
        map.setZoom(15);

        onLocationFound?.(loc);
      },
      (error) => {
        setIsLocating(false);
        let errorType: GeolocationErrorType = 'POSITION_UNAVAILABLE';
        let userMessage = 'Unable to determine your location.';

        if (error.code === error.PERMISSION_DENIED) {
          errorType = 'PERMISSION_DENIED';
          userMessage = 'Location access was denied in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorType = 'POSITION_UNAVAILABLE';
          userMessage = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorType = 'TIMEOUT';
          userMessage = 'Location request timed out. Please retry.';
        }

        onLocationError?.(errorType);
        showTemporaryNotice(userMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [map, onLocationFound, onLocationError, showTemporaryNotice]);

  return (
    <div
      role="region"
      aria-label="Map controls"
      className={`absolute bottom-6 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto ${className}`}
    >
      {/* Geolocation Feedback Notice */}
      {geoNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mb-1 px-3 py-2 text-xs font-medium bg-slate-900/90 dark:bg-zinc-800/95 text-white rounded-xl shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 max-w-[220px] text-right"
        >
          {geoNotice}
        </div>
      )}

      {/* Control Buttons Group */}
      <div className="flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/80 dark:border-zinc-800 overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/80">
        {/* Recenter Map */}
        <button
          type="button"
          onClick={handleRecenter}
          disabled={!map}
          aria-label="Recenter map"
          title="Recenter map"
          className="flex items-center justify-center w-11 h-11 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:z-10 disabled:opacity-50"
        >
          <Compass className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Use My Location */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={!map || isLocating}
          aria-label="Use my location"
          title="Use my location"
          className="flex items-center justify-center w-11 h-11 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:z-10 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" aria-hidden="true" />
          ) : (
            <LocateFixed className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={!map}
          aria-label="Zoom in"
          title="Zoom in"
          className="flex items-center justify-center w-11 h-11 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:z-10 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={!map}
          aria-label="Zoom out"
          title="Zoom out"
          className="flex items-center justify-center w-11 h-11 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:z-10 disabled:opacity-50"
        >
          <Minus className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
