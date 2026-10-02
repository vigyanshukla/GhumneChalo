'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps, GoogleMapsLoadError } from '@/lib/maps/loader';
import { MapLoading } from './MapLoading';
import { MapError } from './MapError';
import { MapControls, GeolocationErrorType } from './MapControls';
import { UserLocationMarker, UserLocation } from './UserLocationMarker';

export interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  showControls?: boolean;
  showUserLocationMarker?: boolean;
  onMapLoad?: (map: google.maps.Map) => void;
  onLocationFound?: (location: UserLocation) => void;
  onLocationError?: (error: GeolocationErrorType) => void;
  children?: (map: google.maps.Map | null) => React.ReactNode;
}

// Neutral default fallback center: New Delhi, India
export const DEFAULT_MAP_CENTER = { lat: 28.6139, lng: 77.2090 };
export const DEFAULT_MAP_ZOOM = 12;

export function GoogleMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  className = '',
  showControls = true,
  showUserLocationMarker = true,
  onMapLoad,
  onLocationFound,
  onLocationError,
  children,
}: GoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<GoogleMapsLoadError | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleLocationFound = useCallback(
    (loc: UserLocation) => {
      setUserLocation(loc);
      onLocationFound?.(loc);
    },
    [onLocationFound]
  );

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    setRetryCount((prev) => prev + 1);
  }, []);

  // Map Initialization Effect
  useEffect(() => {
    let active = true;

    loadGoogleMaps()
      .then(() => {
        if (!active || !containerRef.current) return;

        // Prevent duplicate map initialization
        if (!mapInstanceRef.current) {
          const mapOptions: google.maps.MapOptions = {
            center,
            zoom,
            disableDefaultUI: true, // We use custom accessible controls
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy', // Seamless touch and mobile interaction
            styles: [
              // Subtle modern styling: Clean roads and points of interest
              {
                featureType: 'poi.business',
                stylers: [{ visibility: 'simplified' }],
              },
              {
                featureType: 'transit',
                stylers: [{ visibility: 'simplified' }],
              },
            ],
          };

          const newMap = new google.maps.Map(containerRef.current, mapOptions);
          mapInstanceRef.current = newMap;
          setMap(newMap);
          onMapLoad?.(newMap);
        } else {
          // Update existing map center/zoom if changed
          mapInstanceRef.current.setCenter(center);
          mapInstanceRef.current.setZoom(zoom);
        }

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

        setLoadError(typedErr);
        setIsLoading(false);
      });

    // Clean up on component unmount
    return () => {
      active = false;
      if (mapInstanceRef.current) {
        if (typeof google !== 'undefined' && google?.maps?.event) {
          google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom, onMapLoad, retryCount]);

  // Responsive resize handler
  useEffect(() => {
    if (!containerRef.current || !map) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current && typeof google !== 'undefined' && google?.maps?.event) {
        google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  return (
    <div
      role="region"
      aria-label="Interactive map"
      className={`relative w-full h-full min-h-[400px] overflow-hidden ${className}`}
    >
      {/* Map DOM Element */}
      <div
        ref={containerRef}
        data-testid="google-map-container"
        className="absolute inset-0 w-full h-full"
        tabIndex={0}
        aria-label="Google Map Viewport"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30">
          <MapLoading />
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 z-30">
          <MapError error={loadError} onRetry={handleRetry} />
        </div>
      )}

      {/* Built-in Custom Controls */}
      {showControls && map && !isLoading && !loadError && (
        <MapControls
          map={map}
          defaultCenter={center}
          defaultZoom={zoom}
          onLocationFound={handleLocationFound}
          onLocationError={onLocationError}
        />
      )}

      {/* User Location Marker */}
      {showUserLocationMarker && map && userLocation && (
        <UserLocationMarker map={map} location={userLocation} />
      )}

      {/* Child layers and markers */}
      {typeof children === 'function' ? children(map) : children}
    </div>
  );
}
