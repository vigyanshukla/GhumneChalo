'use client';
// Interactive Route & Directions with dynamic origin detection

import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Compass, ArrowLeft, MapPin, List, Map as MapIcon, Navigation, Luggage } from 'lucide-react';
import type { UserLocation } from '@/components/maps/UserLocationMarker';
import { MapMarker } from '@/components/maps/MapMarker';
import { MapRoutePolyline } from '@/components/maps/MapRoutePolyline';
import { MapLoading } from '@/components/maps/MapLoading';
import { SearchBox, PlaceDetailsCard, NormalizedPlace } from '@/components/search';

const GoogleMap = dynamic(
  () => import('@/components/maps/GoogleMap').then((m) => m.GoogleMap),
  {
    loading: () => <MapLoading />,
    ssr: false,
  }
);
import {
  PopularDestinations,
  DiscoveryFeed,
  RouteCard,
  NormalizedDiscoveryPlace,
  PopularDestination,
} from '@/components/explore';
import { TravelMode, NormalizedRoute, RouteCoordinate } from '@/lib/maps/routes';

// Default initial location: New Delhi, India
const DEFAULT_ANCHOR = {
  lat: 28.6139,
  lng: 77.209,
  name: 'New Delhi',
};

function ExploreContent() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<NormalizedPlace | null>(null);
  const [anchorLocation, setAnchorLocation] = useState(DEFAULT_ANCHOR);
  const [discoveredPlaces, setDiscoveredPlaces] = useState<NormalizedDiscoveryPlace[]>([]);
  const [activePopularId, setActivePopularId] = useState<string | null>('delhi');
  const [mobileViewMode, setMobileViewMode] = useState<'map' | 'list'>('map');

  // Route state
  const [isDirectionsActive, setIsDirectionsActive] = useState<boolean>(false);
  const [routeMode, setRouteMode] = useState<TravelMode>('DRIVE');
  const [activeRoute, setActiveRoute] = useState<NormalizedRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<RouteCoordinate | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const routeFetchIdRef = useRef<number>(0);
  const routeAbortControllerRef = useRef<AbortController | null>(null);

  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance;
    setMap(mapInstance);
  }, []);

  // Fetch route helper with abort and sequence protection
  const fetchRoute = useCallback(
    async (
      originCoord: RouteCoordinate,
      destCoord: RouteCoordinate,
      mode: TravelMode
    ) => {
      if (routeAbortControllerRef.current) {
        routeAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      routeAbortControllerRef.current = controller;

      const currentFetchId = ++routeFetchIdRef.current;
      setIsRouteLoading(true);
      setRouteError(null);

      try {
        const res = await fetch('/api/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: originCoord,
            destination: destCoord,
            travelMode: mode,
          }),
          signal: controller.signal,
        });

        const json = await res.json();

        // Stale response protection
        if (routeFetchIdRef.current !== currentFetchId) {
          return;
        }

        if (!res.ok || !json.success) {
          setRouteError(json?.error?.message || 'Could not find a route to this destination.');
          setActiveRoute(null);
          return;
        }

        setActiveRoute(json.data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (routeFetchIdRef.current === currentFetchId) {
          setRouteError('Network error while calculating route. Please try again.');
          setActiveRoute(null);
        }
      } finally {
        if (routeFetchIdRef.current === currentFetchId) {
          setIsRouteLoading(false);
        }
      }
    },
    []
  );

  // Synchronize place selection across search, feed, and markers
  const handleSelectPlace = useCallback(
    (place: NormalizedPlace | NormalizedDiscoveryPlace) => {
      setSelectedPlace(place);
      if (mapRef.current) {
        mapRef.current.panTo({ lat: place.latitude, lng: place.longitude });
        mapRef.current.setZoom(15);
      }

      // If directions is actively open, recalculate route for the new destination
      if (isDirectionsActive && routeOrigin) {
        fetchRoute(
          routeOrigin,
          {
            lat: place.latitude,
            lng: place.longitude,
            name: place.name,
          },
          routeMode
        );
      }
    },
    [isDirectionsActive, routeOrigin, routeMode, fetchRoute]
  );

  // Handle clicking a Popular Destination chip
  const handleSelectPopularDestination = useCallback((dest: PopularDestination) => {
    setActivePopularId(dest.id);
    setSelectedPlace(null);
    setAnchorLocation({
      lat: dest.latitude,
      lng: dest.longitude,
      name: dest.name,
    });

    if (mapRef.current) {
      mapRef.current.panTo({ lat: dest.latitude, lng: dest.longitude });
      mapRef.current.setZoom(13);
    }
  }, []);

  // Handle SearchBox place selection
  const handleSearchSelect = useCallback(
    (place: NormalizedPlace) => {
      handleSelectPlace(place);
      setActivePopularId(null);
      setAnchorLocation({
        lat: place.latitude,
        lng: place.longitude,
        name: place.name,
      });
    },
    [handleSelectPlace]
  );

  // Handle user geolocation discovered
  const handleLocationFound = useCallback((loc: UserLocation) => {
    setUserLoc(loc);
    setActivePopularId(null);
    setAnchorLocation({
      lat: loc.lat,
      lng: loc.lng,
      name: 'Your Location',
    });
  }, []);

  const handleCenterOnPlace = useCallback((coords: { lat: number; lng: number }) => {
    if (mapRef.current) {
      mapRef.current.panTo(coords);
      mapRef.current.setZoom(16);
    }
  }, []);

  const handlePlacesLoaded = useCallback((places: NormalizedDiscoveryPlace[]) => {
    setDiscoveredPlaces(places);
  }, []);

  // Handle Get Directions requested from PlaceDetailsCard
  const handleGetDirections = useCallback(
    (destPlace: NormalizedPlace) => {
      const destination: RouteCoordinate = {
        lat: destPlace.latitude,
        lng: destPlace.longitude,
        name: destPlace.name,
      };

      if (userLoc) {
        const origin: RouteCoordinate = {
          lat: userLoc.lat,
          lng: userLoc.lng,
          name: 'Your Location',
        };
        setRouteOrigin(origin);
        setIsDirectionsActive(true);
        fetchRoute(origin, destination, routeMode);
      } else {
        // Do not force New Delhi! Keep origin null so prompt shows up, and attempt GPS
        setIsDirectionsActive(true);
        setRouteOrigin(null);

        if (typeof window !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const origin: RouteCoordinate = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                name: 'Your Current Location',
              };
              setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setRouteOrigin(origin);
              fetchRoute(origin, destination, routeMode);
            },
            () => {
              // Location off or denied: keep origin as null so RouteCard displays the location prompt
              setRouteOrigin(null);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
          );
        }
      }
    },
    [userLoc, routeMode, fetchRoute]
  );

  // Handle changing travel mode
  const handleSelectTravelMode = useCallback(
    (mode: TravelMode) => {
      setRouteMode(mode);
      if (routeOrigin && selectedPlace) {
        fetchRoute(
          routeOrigin,
          {
            lat: selectedPlace.latitude,
            lng: selectedPlace.longitude,
            name: selectedPlace.name,
          },
          mode
        );
      }
    },
    [routeOrigin, selectedPlace, fetchRoute]
  );

  // Handle retrying route calculation
  const handleRetryRoute = useCallback(() => {
    if (routeOrigin && selectedPlace) {
      fetchRoute(
        routeOrigin,
        {
          lat: selectedPlace.latitude,
          lng: selectedPlace.longitude,
          name: selectedPlace.name,
        },
        routeMode
      );
    }
  }, [routeOrigin, selectedPlace, routeMode, fetchRoute]);

  // Handle dynamically changing origin (from RouteCard search or GPS)
  const handleChangeOrigin = useCallback(
    (newOrigin: RouteCoordinate) => {
      setRouteOrigin(newOrigin);
      if (selectedPlace) {
        fetchRoute(
          newOrigin,
          {
            lat: selectedPlace.latitude,
            lng: selectedPlace.longitude,
            name: selectedPlace.name,
          },
          routeMode
        );
      }
    },
    [selectedPlace, routeMode, fetchRoute]
  );

  // Handle swapping origin and destination
  const handleSwapRoute = useCallback(() => {
    if (!routeOrigin || !selectedPlace) return;

    const oldOrigin = routeOrigin;
    const oldDestPlace = selectedPlace;

    // Swap: new origin becomes the old destination
    const newOrigin: RouteCoordinate = {
      lat: oldDestPlace.latitude,
      lng: oldDestPlace.longitude,
      name: oldDestPlace.name,
    };

    // New destination becomes the old origin
    const newDestPlace: NormalizedPlace = {
      name: oldOrigin.name || 'Starting Point',
      formattedAddress: oldOrigin.name || 'Starting Point',
      latitude: oldOrigin.lat,
      longitude: oldOrigin.lng,
      placeId: '',
    };

    setRouteOrigin(newOrigin);
    setSelectedPlace(newDestPlace);
    fetchRoute(
      newOrigin,
      {
        lat: newDestPlace.latitude,
        lng: newDestPlace.longitude,
        name: newDestPlace.name,
      },
      routeMode
    );
  }, [routeOrigin, selectedPlace, routeMode, fetchRoute]);

  // Support direct route/place navigation from Trip Details (Phase 4 Requirement 24)
  const searchParams = useSearchParams();
  const initFromParamsRef = useRef(false);

  useEffect(() => {
    if (initFromParamsRef.current) return;
    const destLat = searchParams.get('destLat');
    const destLng = searchParams.get('destLng');
    const destName = searchParams.get('destName');
    const placeId = searchParams.get('placeId');
    const directions = searchParams.get('directions');

    if (destLat && destLng && destName) {
      initFromParamsRef.current = true;
      const lat = parseFloat(destLat);
      const lng = parseFloat(destLng);
      const place: NormalizedPlace = {
        name: destName,
        formattedAddress: destName,
        latitude: lat,
        longitude: lng,
        placeId: placeId || '',
      };
      queueMicrotask(() => {
        setSelectedPlace(place);
        setAnchorLocation({ lat, lng, name: destName });

        if (directions === 'true') {
          setIsDirectionsActive(true);

          if (userLoc) {
            const origin: RouteCoordinate = {
              lat: userLoc.lat,
              lng: userLoc.lng,
              name: 'Your Location',
            };
            setRouteOrigin(origin);
            fetchRoute(origin, { lat, lng, name: destName }, routeMode);
          } else {
            // Location is not yet known or off: keep origin null so RouteCard immediately
            // displays the "Location Access Needed" banner and starting location search input!
            // Do NOT fallback to New Delhi!
            setRouteOrigin(null);

            if (typeof window !== 'undefined' && navigator.geolocation) {
              // Attempt background GPS detection if permission is already allowed
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const origin: RouteCoordinate = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    name: 'Your Current Location',
                  };
                  setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setRouteOrigin(origin);
                  fetchRoute(origin, { lat, lng, name: destName }, routeMode);
                },
                () => {
                  // If permission denied or unavailable, stay at origin null (prompt visible)
                  setRouteOrigin(null);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
              );
            }
          }
        }
      });
    }
  }, [searchParams, userLoc, routeMode, fetchRoute]);

  // Handle clearing and closing route
  const handleClearRoute = useCallback(() => {
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }
    setIsDirectionsActive(false);
    setActiveRoute(null);
    setRouteError(null);
    setRouteOrigin(null);
  }, []);

  return (
    <div className="flex flex-col flex-1 h-screen w-full bg-slate-50 dark:bg-black overflow-hidden font-sans">
      {/* Header bar */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shadow-sm">
              <Compass className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                Explore Destinations
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Discover Places, Categories & Live Map
              </p>
            </div>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2">
          {activeRoute ? (
            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 rounded-full border border-blue-200 dark:border-blue-800 animate-in fade-in">
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {activeRoute.durationText} ({activeRoute.distanceText})
              </span>
            </div>
          ) : selectedPlace ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-full border border-blue-200 dark:border-blue-800/60">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span className="truncate max-w-[140px]">{selectedPlace.name}</span>
            </div>
          ) : userLoc ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-full border border-blue-200 dark:border-blue-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              <span>Location Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Map Ready</span>
            </div>
          )}

          <Link
            href="/trips"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors ml-1"
          >
            <Luggage className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>My Trips</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace: Split View on Desktop, Toggleable on Mobile */}
      <main className="relative flex flex-1 w-full h-full min-h-0 overflow-hidden">
        {/* Left Discovery Sidebar (Desktop: always visible; Mobile: visible when in 'list' mode) */}
        <aside
          aria-label="Discovery panel"
          className={`flex flex-col w-full lg:w-[440px] xl:w-[460px] bg-white dark:bg-zinc-900 border-r border-slate-200/80 dark:border-zinc-800 z-10 shrink-0 h-full p-4 space-y-4 overflow-hidden ${
            mobileViewMode === 'list' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Direct Search Bar */}
          <div className="shrink-0">
            <SearchBox onSelectPlace={handleSearchSelect} />
          </div>

          {/* Popular Destinations Quick Row */}
          <div className="shrink-0">
            <PopularDestinations
              activeDestinationId={activePopularId}
              onSelectDestination={handleSelectPopularDestination}
            />
          </div>

          {/* Discovery Category Feed */}
          <div className="flex-1 min-h-0">
            <DiscoveryFeed
              anchorLocation={anchorLocation}
              selectedPlaceId={selectedPlace?.placeId}
              onSelectPlace={handleSelectPlace}
              onPlacesLoaded={handlePlacesLoaded}
            />
          </div>
        </aside>

        {/* Right Map Canvas Area (Desktop: flex-1; Mobile: visible when in 'map' mode) */}
        <section
          aria-label="Interactive map"
          className={`relative flex-1 w-full h-full min-h-0 ${
            mobileViewMode === 'map' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Mobile Top Floating Search Bar */}
          <div className="lg:hidden absolute top-3 left-3 right-3 z-30 pointer-events-auto">
            <SearchBox onSelectPlace={handleSearchSelect} />
          </div>

          {/* Google Map Instance */}
          <GoogleMap
            className="w-full h-full"
            onMapLoad={handleMapLoad}
            onLocationFound={handleLocationFound}
          >
            {() => (
              <>
                {/* 1. Discovered Category Places Markers */}
                {map &&
                  !activeRoute &&
                  discoveredPlaces.map((place) => {
                    const isSelected = selectedPlace?.placeId === place.placeId;
                    if (isSelected) return null;

                    return (
                      <MapMarker
                        key={place.placeId}
                        map={map}
                        position={{ lat: place.latitude, lng: place.longitude }}
                        title={place.name}
                        onClick={() => handleSelectPlace(place)}
                        zIndex={20}
                      />
                    );
                  })}

                {/* 2. Highlighted Selected Place Marker (when no active route) */}
                {selectedPlace && map && !activeRoute && (
                  <MapMarker
                    map={map}
                    position={{ lat: selectedPlace.latitude, lng: selectedPlace.longitude }}
                    title={selectedPlace.name}
                    onClick={() => {
                      handleCenterOnPlace({
                        lat: selectedPlace.latitude,
                        lng: selectedPlace.longitude,
                      });
                    }}
                    zIndex={100}
                  />
                )}

                {/* 3. Active Route Polyline and Start/End Markers */}
                {activeRoute && map && (
                  <MapRoutePolyline
                    map={map}
                    polyline={activeRoute.polyline}
                    origin={routeOrigin || undefined}
                    destination={
                      selectedPlace
                        ? {
                            lat: selectedPlace.latitude,
                            lng: selectedPlace.longitude,
                            name: selectedPlace.name,
                          }
                        : undefined
                    }
                    autoFitBounds={true}
                  />
                )}
              </>
            )}
          </GoogleMap>

          {/* Interactive Overlay Cards: RouteCard vs PlaceDetailsCard */}
          {isDirectionsActive && selectedPlace ? (
            <RouteCard
              origin={routeOrigin}
              destination={{
                lat: selectedPlace.latitude,
                lng: selectedPlace.longitude,
                name: selectedPlace.name,
              }}
              route={activeRoute}
              isLoading={isRouteLoading}
              error={routeError}
              travelMode={routeMode}
              onSelectTravelMode={handleSelectTravelMode}
              onClose={handleClearRoute}
              onRetry={handleRetryRoute}
              onChangeOrigin={handleChangeOrigin}
              onSwap={handleSwapRoute}
            />
          ) : selectedPlace ? (
            <PlaceDetailsCard
              place={selectedPlace}
              onClose={() => setSelectedPlace(null)}
              onCenterMap={handleCenterOnPlace}
              onGetDirections={handleGetDirections}
            />
          ) : null}

          {/* Mobile View Toggle Floating Button (Bottom Center) */}
          <div className="lg:hidden absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button
              type="button"
              onClick={() => setMobileViewMode((prev) => (prev === 'map' ? 'list' : 'map'))}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-white bg-slate-900/90 dark:bg-zinc-800/95 backdrop-blur-md shadow-lg border border-slate-700/60 dark:border-zinc-700 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={mobileViewMode === 'map' ? 'Switch to list view' : 'Switch to map view'}
            >
              {mobileViewMode === 'map' ? (
                <>
                  <List className="w-4 h-4 text-blue-400" aria-hidden="true" />
                  <span>List View ({discoveredPlaces.length})</span>
                </>
              ) : (
                <>
                  <MapIcon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <span>Map View</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
