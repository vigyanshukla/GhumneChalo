'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  IndianRupee,
  Navigation,
  Edit,
  Trash2,
  Compass,
  AlertCircle,
  Plane,
  CloudSun,
  Wallet,
  CheckCircle2,
  X,
  Sparkles,
  Luggage,
  ShieldAlert,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { TripSummary, TripFormData, TripStatus } from '@/components/trips/types';
import { ItineraryView } from '@/components/itinerary';
import { AppNav } from '@/components/navigation/AppNav';
import { useNetworkStatus } from '@/lib/offline/use-network-status';
import {
  saveTripOfflineSnapshot,
  getTripOfflineSnapshot,
  cleanupOldSnapshots,
} from '@/lib/offline/offline-storage';
import { OfflineTripBanner } from '@/components/trips/OfflineTripBanner';

const TransportationView = dynamic(
  () => import('@/components/transportation').then((m) => m.TransportationView),
  {
    loading: () => (
      <div className="py-12 flex justify-center items-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

const WeatherView = dynamic(
  () => import('@/components/weather').then((m) => m.WeatherView),
  {
    loading: () => (
      <div className="py-12 flex justify-center items-center">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

const PackingView = dynamic(
  () => import('@/components/packing').then((m) => m.PackingView),
  {
    loading: () => (
      <div className="py-12 flex justify-center items-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

const TripForm = dynamic(
  () => import('@/components/trips/TripForm').then((m) => m.TripForm),
  {
    loading: () => (
      <div className="py-12 flex justify-center items-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

const BudgetView = dynamic(
  () => import('@/components/budget/BudgetView').then((m) => m.BudgetView),
  {
    loading: () => (
      <div className="py-12 flex justify-center items-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

const DeleteTripModal = dynamic(
  () => import('@/components/trips/DeleteTripModal').then((m) => m.DeleteTripModal),
  { ssr: false }
);

const AiPlannerModal = dynamic(
  () => import('@/components/ai-planner').then((m) => m.AiPlannerModal),
  { ssr: false }
);

interface TripDetailPageProps {
  params: Promise<{ tripId: string }>;
}

const STATUS_BADGE: Record<
  TripStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: 'Planning',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
  UPCOMING: {
    label: 'Upcoming',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  ACTIVE: {
    label: 'Active (In Progress)',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-rose-50 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
  },
};

type ActiveTab = 'overview' | 'itinerary' | 'transportation' | 'weather' | 'budget' | 'packing';

export default function TripDetailPage({ params }: TripDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tripId } = use(params);

  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal / state
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI Planner modal state (Phase 8)
  const [isAiPlannerOpen, setIsAiPlannerOpen] = useState(false);

  // Active Foundation Tab (Requirement 23 & Phase 5 & Phase 10A)
  const tabParam = searchParams.get('tab') as ActiveTab | null;
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabParam && ['overview', 'itinerary', 'transportation', 'weather', 'budget', 'packing'].includes(tabParam)
      ? tabParam
      : 'overview'
  );

  // Track which tabs have been visited — once mounted, keep mounted (prevents re-fetch on tab switch)
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(
    new Set([tabParam && ['overview', 'itinerary', 'transportation', 'weather', 'budget', 'packing'].includes(tabParam)
      ? (tabParam as ActiveTab)
      : 'overview'])
  );

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  const { status, setStatus } = useNetworkStatus();
  const [isCached, setIsCached] = useState<boolean>(false);
  const [cachedAt, setCachedAt] = useState<number | undefined>(undefined);

  // Fetch single trip on mount or ID change
  useEffect(() => {
    let ignore = false;
    async function loadTrip() {
      // 1. First, check if we have a local cached snapshot in IndexedDB
      try {
        const localSnapshot = await getTripOfflineSnapshot(tripId);
        if (localSnapshot && !ignore) {
          setTrip(localSnapshot.trip as TripSummary);
          setIsCached(true);
          setCachedAt(localSnapshot.cachedAt);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load local offline snapshot:', err);
      }

      // 2. If online, fetch fresh server data and update IndexedDB
      if (!navigator.onLine) {
        if (!ignore) {
          setIsLoading(false);
          setStatus('OFFLINE');
        }
        return;
      }

      try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (res.status === 401) {
          router.push(`/login?callbackUrl=/trips/${tripId}`);
          return;
        }
        if (res.status === 404 || res.status === 403) {
          if (!ignore) {
            setError('Trip not found or you do not have permission to view it.');
          }
          return;
        }

        const json = await res.json();
        if (!ignore) {
          if (!res.ok || !json.success) {
            setError(json?.error?.message || 'Failed to load trip details.');
          } else {
            const serverTrip = json.data as TripSummary;
            setTrip(serverTrip);
            setIsCached(true);
            const now = Date.now();
            setCachedAt(now);
            setStatus('ONLINE');

            // Persist fresh snapshot to IndexedDB (user-namespaced)
            saveTripOfflineSnapshot({
              tripId: serverTrip.id,
              userId: serverTrip.userId,
              cachedAt: now,
              version: 2,
              trip: serverTrip,
            }).then(() => {
              // Cleanup old snapshots in background (keep max 20)
              cleanupOldSnapshots(serverTrip.userId, 20).catch(() => {});
            }).catch(() => {});
          }
        }
      } catch {
        if (!ignore) {
          setStatus('OFFLINE');
          setTrip((prev) => {
            if (!prev) {
              getTripOfflineSnapshot(tripId).then((fallbackSnapshot) => {
                if (fallbackSnapshot) {
                  setTrip(fallbackSnapshot.trip as TripSummary);
                  setIsCached(true);
                  setCachedAt(fallbackSnapshot.cachedAt);
                } else {
                  setError('You are offline and no cached version of this trip is available.');
                }
              }).catch(() => {});
            }
            return prev;
          });
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadTrip();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, router]);

  // Handle Update Trip
  const handleUpdateTrip = async (formData: TripFormData) => {
    const res = await fetch(`/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to update trip.');
    }

    setTrip(json.data);
    setIsEditing(false);
    setEditSuccessMessage('Trip details updated successfully!');
    setTimeout(() => setEditSuccessMessage(null), 4000);
  };

  // Handle Delete Trip
  const handleDeleteTrip = async () => {
    if (!trip) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json?.error?.message || 'Failed to delete trip.');
        return;
      }

      router.push('/trips');
    } catch {
      alert('Network error while deleting trip.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 animate-pulse space-y-6">
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-10 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-6">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Trips</span>
          </Link>
        </header>
        <div className="max-w-md mx-auto w-full my-auto px-4 text-center py-16">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Trip Unavailable</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error || 'Trip could not be found.'}</p>
          <Link
            href="/trips"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Go to My Trips
          </Link>
        </div>
      </div>
    );
  }

  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const statusBadge = STATUS_BADGE[trip.status] || STATUS_BADGE.DRAFT;

  // Directions URL to Phase 3D Routes & Directions in Explore
  const directionsUrl = `/explore?destLat=${trip.latitude || ''}&destLng=${trip.longitude || ''}&destName=${encodeURIComponent(trip.destinationName)}&placeId=${trip.destinationPlaceId || ''}&directions=true`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Shared Authenticated App Navigation */}
      <AppNav />

      {/* Trip-specific sub-header: breadcrumb + trip actions */}
      <div className="border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>My Trips</span>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700 text-xs">/</span>
            <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 truncate">
              {trip.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(true)}
              id="edit-trip-btn"
              disabled={status === 'OFFLINE'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                status === 'OFFLINE'
                  ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 cursor-not-allowed opacity-60'
                  : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
              title={status === 'OFFLINE' ? 'Available when online' : 'Edit Trip'}
            >
              <Edit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              id="delete-trip-btn"
              disabled={status === 'OFFLINE'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                status === 'OFFLINE'
                  ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 cursor-not-allowed opacity-60'
                  : 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400'
              }`}
              title={status === 'OFFLINE' ? 'Available when online' : 'Delete Trip'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Offline Status & Sync Banner */}
      <OfflineTripBanner
        status={status}
        isCached={isCached}
        cachedAt={cachedAt}
        onRefresh={() => {
          if (typeof window !== 'undefined') window.location.reload();
        }}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 md:pb-8">
        {/* Success alert */}
        {editSuccessMessage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{editSuccessMessage}</span>
          </div>
        )}

        {/* Hero Banner / Details Card */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                >
                  {statusBadge.label}
                </span>
                <span className="text-xs text-zinc-400">
                  Created {new Date(trip.createdAt).toLocaleDateString()}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                {trip.title}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {trip.destinationName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>
                    {startDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    –{' '}
                    {endDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {diffDays} {diffDays === 1 ? 'day' : 'days'}
                  </span>
                </div>

                {trip.totalBudget ? (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <IndianRupee className="w-4 h-4" />
                    <span>
                      Budget: {trip.currency || 'INR'} {trip.totalBudget.toLocaleString('en-IN')}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Action Entry Points */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              {/* AI Planner Entry Point (Phase 8) */}
              <button
                type="button"
                onClick={() => setIsAiPlannerOpen(true)}
                id="plan-with-ai-btn"
                data-testid="plan-with-ai-btn"
                disabled={status === 'OFFLINE'}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all ${
                  status === 'OFFLINE'
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white cursor-pointer'
                }`}
                title={status === 'OFFLINE' ? 'AI planning requires an active network connection' : 'Plan with AI'}
              >
                <Sparkles className="w-4 h-4" />
                <span>{status === 'OFFLINE' ? 'AI (Offline)' : 'Plan with AI'}</span>
              </button>

              {/* Routes & Directions Integration (Requirement 24) */}
              <Link
                href={directionsUrl}
                id="trip-directions-btn"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                <span>View Route & Directions</span>
              </Link>

              <Link
                href={`/explore?q=${encodeURIComponent(trip.destinationName)}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Places</span>
              </Link>

              <Link
                href={`/emergency${trip.latitude && trip.longitude ? `?lat=${trip.latitude}&lng=${trip.longitude}` : ''}`}
                id="trip-emergency-btn"
                data-testid="trip-emergency-btn"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-xs sm:text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 transition-colors"
                title="Emergency Services for this destination"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Emergency</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Foundation Tabs Navigation (Requirement 23 - Future Phase Extensibility) */}
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="flex space-x-6 overflow-x-auto scrollbar-none" aria-label="Trip sections">
            {[
              { id: 'overview', label: 'Overview', icon: Compass },
              { id: 'itinerary', label: 'Day-by-Day Itinerary', icon: Calendar },
              { id: 'transportation', label: 'Transportation', icon: Plane },
              { id: 'weather', label: 'Weather Forecast', icon: CloudSun },
              { id: 'budget', label: 'Budget & Expenses', icon: Wallet },
              { id: 'packing', label: 'Packing Assistant', icon: Luggage },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as ActiveTab)}
                  className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Contents — components are kept mounted after first visit to prevent re-fetch on tab switch */}
        <div className="mt-6">
          {/* 1. Overview Tab */}
          <div className="py-2" style={{ display: activeTab === 'overview' ? undefined : 'none' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Trip Highlights Card */}
              <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-500" />
                  <span>Journey Summary</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400 block mb-1">Destination</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {trip.destinationName}
                    </span>
                    {trip.latitude && trip.longitude && (
                      <span className="text-xs text-zinc-400 block mt-0.5">
                        {trip.latitude.toFixed(4)}° N, {trip.longitude.toFixed(4)}° E
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400 block mb-1">Duration</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {diffDays} Days ({startDate.toLocaleDateString()} to {endDate.toLocaleDateString()})
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400 block mb-1">Status</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-xs text-zinc-400 block mb-1">Planned Budget</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {trip.totalBudget ? `${trip.currency || 'INR'} ${trip.totalBudget.toLocaleString('en-IN')}` : 'Not specified'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                  <span>Last modified: {new Date(trip.updatedAt).toLocaleString()}</span>
                  <Link
                    href={directionsUrl}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>Open in Map</span>
                    <Navigation className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Quick Actions Side Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Quick Actions
                </h3>
                <div className="space-y-2.5">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Edit className="w-4 h-4 text-blue-500" />
                      <span>Edit Trip Details</span>
                    </span>
                  </button>

                  <Link
                    href={directionsUrl}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-indigo-500" />
                      <span>Calculate Route</span>
                    </span>
                  </Link>

                  <Link
                    href={`/explore?q=${encodeURIComponent(trip.destinationName)}`}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <span>Discover Nearby Places</span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Itinerary Tab (Phase 5) — keep mounted after first visit */}
          {visitedTabs.has('itinerary') && (
            <div style={{ display: activeTab === 'itinerary' ? undefined : 'none' }}>
              <ItineraryView trip={trip} />
            </div>
          )}

          {/* 3. Transportation Tab (Phase 6) — keep mounted after first visit */}
          {visitedTabs.has('transportation') && (
            <div style={{ display: activeTab === 'transportation' ? undefined : 'none' }}>
              <TransportationView trip={trip} />
            </div>
          )}

          {/* 4. Weather Tab (Phase 7) — keep mounted after first visit */}
          {visitedTabs.has('weather') && (
            <div style={{ display: activeTab === 'weather' ? undefined : 'none' }}>
              <WeatherView trip={trip} />
            </div>
          )}

          {/* 5. Budget & Expenses Tab — keep mounted after first visit */}
          {visitedTabs.has('budget') && (
            <div style={{ display: activeTab === 'budget' ? undefined : 'none' }}>
              <BudgetView trip={trip} />
            </div>
          )}

          {/* 6. Packing Assistant Tab (Phase 10A) — keep mounted after first visit */}
          {visitedTabs.has('packing') && (
            <div style={{ display: activeTab === 'packing' ? undefined : 'none' }}>
              <PackingView
                tripId={tripId}
                tripTitle={trip.title}
                destinationName={trip.destinationName}
                startDate={trip.startDate as string}
                endDate={trip.endDate as string}
              />
            </div>
          )}
        </div>
      </main>

      {/* Edit Trip Modal (Requirement 30) */}
      {isEditing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Edit Trip Details
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Update title, destination, dates, budget or status
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <TripForm
              initialData={{
                title: trip.title,
                destinationName: trip.destinationName,
                destinationPlaceId: trip.destinationPlaceId || undefined,
                latitude: trip.latitude,
                longitude: trip.longitude,
                startDate: trip.startDate as string,
                endDate: trip.endDate as string,
                totalBudget: trip.totalBudget ?? '',
                currency: trip.currency,
                status: trip.status,
              }}
              isEditing={true}
              onSubmit={handleUpdateTrip}
              onCancel={() => setIsEditing(false)}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Requirement 31) */}
      <DeleteTripModal
        trip={trip}
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        onConfirm={handleDeleteTrip}
        onClose={() => setIsDeleteModalOpen(false)}
      />

      {/* AI Planner Modal (Phase 8) */}
      <AiPlannerModal
        isOpen={isAiPlannerOpen}
        onClose={() => setIsAiPlannerOpen(false)}
        trip={trip}
        onPlanApplied={() => {
          // Trigger reload or refresh itinerary tab
          window.location.reload();
        }}
      />
    </div>
  );
}
