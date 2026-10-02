'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadGoogleMaps, isGoogleMapsLoaded, GoogleMapsLoadError } from '@/lib/maps/loader';

interface MapContextValue {
  isLoaded: boolean;
  isLoading: boolean;
  error: GoogleMapsLoadError | null;
  load: () => Promise<typeof google.maps | null>;
}

const MapContext = createContext<MapContextValue>({
  isLoaded: false,
  isLoading: true,
  error: null,
  load: async () => null,
});

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(() => (typeof window !== 'undefined' ? isGoogleMapsLoaded() : false));
  const [isLoading, setIsLoading] = useState(() => (typeof window !== 'undefined' ? !isGoogleMapsLoaded() : true));
  const [error, setError] = useState<GoogleMapsLoadError | null>(null);

  const load = useCallback(async () => {
    if (isGoogleMapsLoaded()) {
      setIsLoaded(true);
      setIsLoading(false);
      return window.google.maps;
    }

    setIsLoading(true);
    setError(null);

    try {
      const maps = await loadGoogleMaps();
      setIsLoaded(true);
      setIsLoading(false);
      return maps;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const typedErr: GoogleMapsLoadError =
        msg === 'MISSING_API_KEY' ||
        msg === 'AUTH_FAILURE' ||
        msg === 'TIMEOUT' ||
        msg === 'SCRIPT_LOAD_ERROR'
          ? (msg as GoogleMapsLoadError)
          : 'SCRIPT_LOAD_ERROR';

      setError(typedErr);
      setIsLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (isGoogleMapsLoaded()) {
      return;
    }

    loadGoogleMaps()
      .then(() => {
        if (!active) return;
        setIsLoaded(true);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err);
        const typedErr: GoogleMapsLoadError =
          msg === 'MISSING_API_KEY' ||
          msg === 'AUTH_FAILURE' ||
          msg === 'TIMEOUT' ||
          msg === 'SCRIPT_LOAD_ERROR'
            ? (msg as GoogleMapsLoadError)
            : 'SCRIPT_LOAD_ERROR';
        setError(typedErr);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <MapContext.Provider value={{ isLoaded, isLoading, error, load }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}
