'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Luggage,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TripSummary } from '@/components/trips/types';
import { TripCard } from '@/components/trips/TripCard';
import { AppNav } from '@/components/navigation/AppNav';
import { useNetworkStatus } from '@/lib/offline/use-network-status';
import { getAllTripOfflineSnapshots } from '@/lib/offline/offline-storage';
import { CACHE_KEYS, getStoredItem, setStoredItem, cachedFetch } from '@/lib/cache/client-cache';

const DeleteTripModal = dynamic(
  () => import('@/components/trips/DeleteTripModal').then((m) => m.DeleteTripModal),
  { ssr: false }
);

type FilterTab = 'ALL' | 'UPCOMING' | 'ACTIVE' | 'DRAFT' | 'COMPLETED';

export function TripsDashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>(() => {
    const cached = getStoredItem<{ success: boolean; data: TripSummary[] }>(CACHE_KEYS.TRIPS);
    return cached?.data?.data || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = getStoredItem<{ success: boolean; data: TripSummary[] }>(CACHE_KEYS.TRIPS);
    return !cached?.data?.data;
  });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Delete modal state
  const [tripToDelete, setTripToDelete] = useState<TripSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { isOnline } = useNetworkStatus();

  // Fetch user trips on mount
  useEffect(() => {
    let ignore = false;
    async function loadTrips() {
      // Resolve userId from profile cache for user-scoped offline access
      let userId: string | undefined;
      try {
        const profileCache = getStoredItem<{ success: boolean; data: { id?: string } }>(CACHE_KEYS.PROFILE);
        userId = profileCache?.data?.data?.id;
      } catch {}

      // 1. Try local snapshot first if offline
      if (!navigator.onLine) {
        try {
          const snapshots = await getAllTripOfflineSnapshots(userId);
          if (!ignore && snapshots.length > 0) {
            const cachedTrips = snapshots.map((s) => s.trip as TripSummary);
            setTrips(cachedTrips);
            setIsLoading(false);
            return;
          }
        } catch {
          // ignore storage error
        }
      }

      try {
        const json = await cachedFetch<{ success: boolean; data: TripSummary[] }>(
          '/api/trips',
          undefined,
          { cacheKey: CACHE_KEYS.TRIPS, ttlMs: 5 * 60 * 1000 }
        );

        if (!ignore) {
          if (!json || !json.success) {
            setError('Failed to load your trips.');
          } else {
            setTrips(json.data || []);
          }
        }
      } catch {
        if (!ignore) {
          // Fallback to offline snapshots if network fails
          const snapshots = await getAllTripOfflineSnapshots(userId);
          if (snapshots.length > 0) {
            setTrips(snapshots.map((s) => s.trip as TripSummary));
          } else {
            setError('Network error while loading trips. Please check your connection.');
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadTrips();
    return () => {
      ignore = true;
    };
  }, [router]);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    fetch('/api/trips')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/trips');
          return;
        }
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json?.error?.message || 'Failed to load your trips.');
        } else {
          setTrips(json.data || []);
        }
      })
      .catch(() => {
        setError('Network error while loading trips. Please check your connection.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Handle Edit trip
  const handleEditTrip = (trip: TripSummary) => {
    router.push(`/trips/${trip.id}?edit=true`);
  };

  // Handle Delete Trip
  const handleDeleteTrip = async () => {
    if (!tripToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/trips/${tripToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json?.error?.message || 'Failed to delete trip.');
        return;
      }

      // Remove from state and update localStorage cache immediately
      setTrips((prev) => {
        const next = prev.filter((t) => t.id !== tripToDelete.id);
        setStoredItem(CACHE_KEYS.TRIPS, { success: true, data: next });
        return next;
      });
      setTripToDelete(null);
    } catch {
      alert('Network error while deleting trip.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter trips
  const filteredTrips = trips.filter((trip) => {
    // Tab filter
    if (activeTab !== 'ALL' && trip.status !== activeTab) {
      return false;
    }
    // Search query filter
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = trip.title.toLowerCase().includes(q);
      const matchDest = trip.destinationName.toLowerCase().includes(q);
      return matchTitle || matchDest;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Shared Authenticated App Navigation */}
      <AppNav />

      {/* Offline Status Banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 text-xs sm:text-sm flex items-center justify-between"
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span>
              <strong>Offline Mode:</strong> Showing locally cached trips. Trip creation and cloud edits require an active connection.
            </span>
            <button
              onClick={handleRetry}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Page Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              My Trips
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Plan, organize, and manage your travel journeys in one place.
            </p>
          </div>

          {trips.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                {trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}
              </span>
            </div>
          )}
        </div>

        {/* Filter Controls (Shown when user has trips) */}
        {!isLoading && !error && trips.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'ALL', label: 'All Trips' },
                  { id: 'UPCOMING', label: 'Upcoming' },
                  { id: 'ACTIVE', label: 'Active' },
                  { id: 'DRAFT', label: 'Planning' },
                  { id: 'COMPLETED', label: 'Past' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by title or destination..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                  <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-between">
                  <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/20 max-w-lg mx-auto my-12">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              Unable to load trips
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && trips.length === 0 && (
          <div
            data-testid="trips-empty-state"
            className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50 my-6"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mb-4">
              <Luggage className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              No trips yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
              You haven&apos;t created any travel plans yet. Pick a destination, choose your travel dates, and start building your journey!
            </p>
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create your first trip</span>
            </Link>
          </div>
        )}

        {/* Filtered Empty State */}
        {!isLoading && !error && trips.length > 0 && filteredTrips.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No trips match the selected filter &ldquo;{searchFilter || activeTab}&rdquo;.
            </p>
            <button
              onClick={() => {
                setActiveTab('ALL');
                setSearchFilter('');
              }}
              className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Trip Grid */}
        {!isLoading && !error && filteredTrips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={handleEditTrip}
                onDelete={(t) => setTripToDelete(t)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteTripModal
        trip={tripToDelete}
        isOpen={!!tripToDelete}
        isDeleting={isDeleting}
        onConfirm={handleDeleteTrip}
        onClose={() => setTripToDelete(null)}
      />
    </div>
  );
}
