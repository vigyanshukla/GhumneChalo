'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  MapPin,
  RefreshCw,
  PhoneCall,
  AlertTriangle,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import type {
  EmergencyPlace,
  OfflineEmergencyContact,
} from '@/lib/emergency/types';
import { EmergencyCategoryTabs, TabType } from './EmergencyCategoryTabs';
import { EmergencyPlaceCard } from './EmergencyPlaceCard';
import { EmergencyOfflineContacts } from './EmergencyOfflineContacts';

export interface LocationState {
  lat: number;
  lng: number;
  name: string;
  isCustomCity: boolean;
  accuracy?: number;
}

const PRESET_CITIES: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Current GPS Location', lat: 0, lng: 0 },
  { name: 'New Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Mumbai, Maharashtra', lat: 19.076, lng: 72.8777 },
  { name: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Goa (Panaji)', lat: 15.4909, lng: 73.8278 },
  { name: 'Manali, Himachal Pradesh', lat: 32.2432, lng: 77.1892 },
  { name: 'Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Kolkata, West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Chennai, Tamil Nadu', lat: 13.0827, lng: 80.2707 },
];

export function EmergencyDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('police');
  const [places, setPlaces] = useState<EmergencyPlace[]>([]);
  const [offlineContacts, setOfflineContacts] = useState<OfflineEmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Network state
  const [isOnline, setIsOnline] = useState(true);

  // Geolocation state
  const [geoPermission, setGeoPermission] = useState<
    'prompt' | 'granted' | 'denied' | 'unavailable' | 'timeout'
  >('prompt');
  const [location, setLocation] = useState<LocationState>({
    lat: 28.6139,
    lng: 77.209,
    name: 'New Delhi (Default)',
    isCustomCity: false,
  });

  // Track counts per category
  const [counts, setCounts] = useState<{
    police?: number;
    hospital?: number;
    pharmacy?: number;
  }>({});

  // Request browser geolocation
  const requestGeolocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoPermission('unavailable');
      return;
    }

    setGeoPermission('prompt');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGeoPermission('granted');
        setLocation({
          lat: latitude,
          lng: longitude,
          name: 'My GPS Location',
          isCustomCity: false,
          accuracy: Math.round(accuracy),
        });
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGeoPermission('denied');
        } else if (geoError.code === geoError.TIMEOUT) {
          setGeoPermission('timeout');
        } else {
          setGeoPermission('unavailable');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Request geolocation on initial mount
  useEffect(() => {
    queueMicrotask(() => {
      requestGeolocation();
    });
  }, [requestGeolocation]);

  // Fetch verified contacts once
  useEffect(() => {
    async function loadContacts() {
      try {
        const res = await fetch('/api/emergency/contacts');
        const json = await res.json();
        if (res.ok && json.success) {
          setOfflineContacts(json.data.contacts || []);
        }
      } catch {
        // Fallback static load if network fails
      }
    }
    loadContacts();
  }, []);

  // Fetch nearby places whenever location or activeTab changes
  const fetchNearby = useCallback(async () => {
    if (activeTab === 'helplines') {
      return;
    }

    if (!isOnline) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        type: activeTab,
        radius: '10000',
        limit: '15',
        fallback: 'true',
      });

      const res = await fetch(`/api/emergency/nearby?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to load emergency places.');
      }

      setPlaces(json.data.places || []);
      if (json.data.offlineHelplines) {
        setOfflineContacts(json.data.offlineHelplines);
      }

      // Update count for current tab
      setCounts((prev) => ({
        ...prev,
        [activeTab]: json.data.places?.length ?? 0,
      }));
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach emergency location service. Showing verified offline helplines.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [location.lat, location.lng, activeTab, isOnline]);

  useEffect(() => {
    if (activeTab !== 'helplines') {
      queueMicrotask(() => {
        fetchNearby();
      });
    }
  }, [fetchNearby, activeTab]);

  // Handle city selection
  const handleSelectCity = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'gps') {
      requestGeolocation();
      return;
    }
    const found = PRESET_CITIES.find((c) => c.name === val);
    if (found) {
      setLocation({
        lat: found.lat,
        lng: found.lng,
        name: found.name,
        isCustomCity: true,
      });
    }
  };

  return (
    <div className="space-y-6" data-testid="emergency-dashboard">
      {/* Sticky Fast-Dial Emergency Action Banner */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-rose-200 dark:border-rose-950/80 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
            </span>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Emergency Assistance Mode
            </span>
          </div>

          <a
            href="tel:112"
            className="min-h-[46px] px-5 py-2.5 rounded-xl font-black text-sm bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md transition-all inline-flex items-center gap-2 focus:ring-4 focus:ring-rose-300"
            data-testid="top-call-112-btn"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Call 112</span>
          </a>
        </div>
      </div>

      {/* Offline / Connectivity Alert */}
      {!isOnline && (
        <div
          className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/50 p-4 sm:p-5"
          data-testid="offline-alert"
        >
          <div className="flex items-start gap-3">
            <WifiOff className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-base text-red-900 dark:text-red-200 uppercase tracking-wide">
                Offline Mode Detected
              </h4>
              <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                You are currently offline. Live nearby Google Places results require an active internet
                connection. All verified emergency helplines below remain 100% active and dialable
                over regular cell networks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Geolocation Status & City Selector Bar */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              geoPermission === 'granted'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            <MapPin className="h-5 w-5 shrink-0" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {location.name}
              </span>
              {location.accuracy !== undefined && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  (±{location.accuracy}m)
                </span>
              )}
            </div>

            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {geoPermission === 'granted' && !location.isCustomCity
                ? 'Accurate GPS coordinates active'
                : geoPermission === 'denied'
                ? 'Location permission denied. Showing selected city.'
                : 'Using selected coordinates for nearby emergency search.'}
            </p>
          </div>
        </div>

        {/* Change City or Retry GPS */}
        <div className="flex items-center gap-2 self-start md:self-auto w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <select
              onChange={handleSelectCity}
              value={location.isCustomCity ? location.name : 'gps'}
              className="w-full appearance-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 pr-8 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="location-selector"
            >
              <option value="gps">Use My GPS Location</option>
              {PRESET_CITIES.slice(1).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-zinc-400" />
          </div>

          <button
            onClick={requestGeolocation}
            title="Refresh GPS"
            className="min-h-[40px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            data-testid="refresh-gps-btn"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <EmergencyCategoryTabs
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        policeCount={counts.police}
        hospitalCount={counts.hospital}
        pharmacyCount={counts.pharmacy}
      />

      {/* Main Content Area */}
      {activeTab === 'helplines' ? (
        <EmergencyOfflineContacts
          contacts={offlineContacts}
          isOfflineMode={!isOnline}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isOnline ? 'LIVE NEARBY RESULTS' : 'OFFLINE EMERGENCY INFORMATION'}
            </h3>
            {isOnline && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Within 10 km radius • Sorted by distance
              </span>
            )}
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="emergency-loading-skeletons">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                      <div className="h-5 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                    </div>
                  </div>
                  <div className="h-3 w-4/5 bg-zinc-100 dark:bg-zinc-800/60 rounded"></div>
                  <div className="pt-2 flex gap-3">
                    <div className="h-10 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
                    <div className="h-10 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error Message with Fallback Contacts */}
          {!isLoading && error && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                      Live Nearby Provider Notice
                    </h4>
                    <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{error}</p>
                  </div>
                </div>
              </div>

              {/* Graceful Fallback Directory */}
              <EmergencyOfflineContacts
                contacts={offlineContacts}
                isOfflineMode={true}
              />
            </div>
          )}

          {/* Results List */}
          {!isLoading && !error && places.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {places.map((place) => (
                <EmergencyPlaceCard key={place.placeId} place={place} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && places.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center bg-white dark:bg-zinc-900/60">
              <ShieldAlert className="mx-auto h-12 w-12 text-zinc-400" />
              <h4 className="mt-3 font-bold text-base text-zinc-900 dark:text-zinc-100">
                No nearby {activeTab} locations found in this radius
              </h4>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                No verified live facilities were returned within 10 km. For immediate assistance,
                please dial the national emergency helpline directly.
              </p>
              <div className="mt-5">
                <a
                  href="tel:112"
                  className="min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-colors inline-flex items-center gap-2"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Call 112 Immediately</span>
                </a>
              </div>
            </div>
          )}

          {/* Always Accessible Verified Helplines Section Below Live Results */}
          <div className="mt-10 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-4">
              OFFLINE EMERGENCY INFORMATION (Verified Helplines)
            </h3>
            <EmergencyOfflineContacts
              contacts={offlineContacts.slice(0, 6)}
              isOfflineMode={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
