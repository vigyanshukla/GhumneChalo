'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  Luggage,
  Map,
  Clock,
  Trophy,
  ShieldAlert,
  Plus,
  Sparkles,
  Calendar,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Bell,
  AlertCircle,
  RefreshCw,
  Navigation,
  Utensils,
  TreePine,
  Briefcase,
  Wallet,
  CalendarCheck,
  Plane,
} from 'lucide-react';
import { AppNav } from '@/components/navigation/AppNav';
import { CACHE_KEYS, getStoredItem, cachedFetch } from '@/lib/cache/client-cache';
import { TripSummary } from '@/components/trips/types';
import { ReminderItem } from '@/lib/reminders/types';
import { UserAchievement } from '@/lib/achievements/types';

interface HomeDashboardProps {
  initialUser?: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
}

const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
  Compass,
  MapPin,
  Utensils,
  TreePine,
  Briefcase,
  Wallet,
  CalendarCheck,
  Luggage,
  Plane,
  Trophy,
};

function getInitialGreeting(): string {
  if (typeof window === 'undefined') return 'Welcome back';
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeDashboard({ initialUser }: HomeDashboardProps) {
  const [user, setUser] = useState(initialUser || null);
  const [trips, setTrips] = useState<TripSummary[]>(() => {
    const cached = getStoredItem<{ success: boolean; data: TripSummary[] }>(CACHE_KEYS.TRIPS);
    return cached?.data?.data || [];
  });
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time-aware greeting initialized lazily
  const [greeting] = useState<string>(getInitialGreeting);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Fetch all authenticated dashboard data inside useEffect
  useEffect(() => {
    let ignore = false;

    async function fetchDashboard() {
      try {
        const [tripsRes, remindersRes, achievementsRes, unreadRes, profileRes] = await Promise.allSettled([
          cachedFetch<{ success: boolean; data: TripSummary[] }>('/api/trips', undefined, {
            cacheKey: CACHE_KEYS.TRIPS,
            ttlMs: 3 * 60 * 1000,
          }),
          cachedFetch<{ success: boolean; data: { reminders: ReminderItem[]; total: number } }>(
            '/api/reminders?upcoming=true&limit=3'
          ),
          cachedFetch<{ success: boolean; data: UserAchievement[] }>('/api/achievements'),
          cachedFetch<{ success: boolean; data: { unreadCount: number } }>(
            '/api/notifications/unread-count',
            undefined,
            { cacheKey: CACHE_KEYS.NOTIFICATIONS_UNREAD, ttlMs: 60 * 1000 }
          ),
          user
            ? Promise.resolve({ success: true, data: user })
            : cachedFetch<{ success: boolean; data: { id: string; email: string; name: string | null } }>(
                '/api/profile',
                undefined,
                { cacheKey: CACHE_KEYS.PROFILE, ttlMs: 10 * 60 * 1000 }
              ),
        ]);

        if (ignore) return;

        if (tripsRes.status === 'fulfilled' && tripsRes.value?.success) {
          setTrips(tripsRes.value.data || []);
        }
        if (remindersRes.status === 'fulfilled' && remindersRes.value?.success) {
          setReminders(remindersRes.value.data?.reminders || []);
        }
        if (achievementsRes.status === 'fulfilled' && achievementsRes.value?.success) {
          setAchievements(achievementsRes.value.data || []);
        }
        if (unreadRes.status === 'fulfilled' && unreadRes.value?.success) {
          setUnreadCount(unreadRes.value.data?.unreadCount || 0);
        }
        if (profileRes.status === 'fulfilled' && profileRes.value?.success && profileRes.value.data) {
          const profileData = profileRes.value.data;
          setUser((prev) => {
            if (
              prev?.id === profileData.id &&
              prev?.email === profileData.email &&
              prev?.name === profileData.name
            ) {
              return prev;
            }
            return {
              ...prev,
              id: profileData.id || prev?.id || '',
              email: profileData.email || prev?.email || '',
              name: profileData.name ?? prev?.name ?? null,
            };
          });
        }
      } catch {
        if (!ignore) {
          setError('Unable to load dashboard information. Please check your network.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => {
      ignore = true;
    };
  }, [reloadTrigger]);

  // Compute upcoming trip
  const now = new Date();
  const sortedTrips = [...trips].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const upcomingTrip = sortedTrips.find((t) => {
    const end = new Date(t.endDate);
    return end >= now && (t.status === 'UPCOMING' || t.status === 'ACTIVE');
  }) || sortedTrips.find((t) => new Date(t.endDate) >= now) || null;

  // Countdown helper
  const getCountdownLabel = (startDateStr: string | Date, endDateStr: string | Date) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (now >= start && now <= end) {
      return { text: 'Happening Now', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }
    if (diffDays === 0) {
      return { text: 'Starts Today', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    }
    if (diffDays === 1) {
      return { text: 'Starts Tomorrow', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    }
    if (diffDays > 1) {
      return { text: `Starts in ${diffDays} days`, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    }
    return { text: 'Completed', color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' };
  };

  const unlockedAchievementsCount = achievements.filter((a) => a.isUnlocked).length;
  const totalAchievementsPoints = achievements
    .filter((a) => a.isUnlocked)
    .reduce((sum, a) => sum + (a.targetValue * 10 || 50), 0);

  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'Traveler';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col min-w-[320px]">
      <AppNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-24 md:pb-8">
        {/* Welcome Section */}
        <section aria-label="Welcome banner" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {greeting}, {displayName}!
            </h1>
            <p className="mt-1 text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
              {upcomingTrip
                ? `Ready for your trip to ${upcomingTrip.destinationName}? Here is your travel overview.`
                : 'Ready for your next adventure? Explore destinations or plan a customized itinerary.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/trips/new"
              id="plan-new-trip-cta"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Plan New Trip</span>
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-semibold transition-colors min-h-[44px]"
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Explore Places</span>
              <span className="sm:hidden">Explore</span>
            </Link>
          </div>
        </section>

        {/* Global Error Banner if API failed */}
        {error && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                setReloadTrigger((k) => k + 1);
              }}
              className="inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Quick Actions Bar */}
        <section aria-label="Quick Actions">
          <h2 className="sr-only">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                title: 'Plan New Trip',
                subtitle: 'AI or Custom',
                href: '/trips/new',
                icon: Plus,
                gradient: 'from-blue-600 to-indigo-600',
              },
              {
                title: 'My Trips',
                subtitle: `${trips.length} Saved`,
                href: '/trips',
                icon: Luggage,
                gradient: 'from-indigo-600 to-violet-600',
              },
              {
                title: 'Explore Destinations',
                subtitle: 'Attractions & Routes',
                href: '/explore',
                icon: Map,
                gradient: 'from-emerald-600 to-teal-600',
              },
              {
                title: 'Reminders',
                subtitle: `${reminders.length} Upcoming`,
                href: '/reminders',
                icon: Clock,
                gradient: 'from-amber-600 to-orange-600',
              },
              {
                title: 'Emergency Hub',
                subtitle: '112 & Helplines',
                href: '/emergency',
                icon: ShieldAlert,
                gradient: 'from-rose-600 to-red-600',
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col justify-between min-h-[92px]"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${action.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {action.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                      {action.subtitle}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Hero Section: Upcoming Trip Highlight or Useful Empty State */}
        <section aria-label="Upcoming Trip">
          {loading ? (
            <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 animate-pulse space-y-4">
              <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            </div>
          ) : upcomingTrip ? (
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 sm:space-y-4 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      Upcoming Trip
                    </span>
                    {(() => {
                      const badge = getCountdownLabel(upcomingTrip.startDate, upcomingTrip.endDate);
                      return (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}
                        >
                          {badge.text}
                        </span>
                      );
                    })()}
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 truncate">
                      {upcomingTrip.title || upcomingTrip.destinationName}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{upcomingTrip.destinationName}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                    <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[11px] text-zinc-400 block mb-0.5">Dates</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                        {new Date(upcomingTrip.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        -{' '}
                        {new Date(upcomingTrip.endDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[11px] text-zinc-400 block mb-0.5">Budget</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                        {upcomingTrip.totalBudget
                          ? `₹${Number(upcomingTrip.totalBudget).toLocaleString()}`
                          : 'Not specified'}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 p-2.5 sm:p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[11px] text-zinc-400 block mb-0.5">Itinerary</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {upcomingTrip._count?.days
                          ? `${upcomingTrip._count.days} Days Planned`
                          : 'Itinerary Ready'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hero Actions */}
                <div className="flex flex-row lg:flex-col items-stretch gap-2.5 shrink-0 pt-2 lg:pt-0">
                  <Link
                    href={`/trips/${upcomingTrip.id}`}
                    id="view-upcoming-trip-btn"
                    className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors min-h-[44px]"
                  >
                    <span>View Trip Itinerary</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href={`/explore?destName=${encodeURIComponent(upcomingTrip.destinationName)}&directions=true`}
                    className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs sm:text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-500" />
                    <span>Get Directions</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State when no upcoming trips */
            <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 sm:p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                <Compass className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  No upcoming trips planned
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  Your wanderlust journey begins here. Create a custom itinerary or let our AI generate a complete schedule in seconds.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/trips/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Plan Your First Trip</span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Recent Trips Section */}
        {trips.length > 0 && (
          <section aria-label="Recent Trips">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Recent Trips
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  Continue planning or review your travel histories.
                </p>
              </div>
              <Link
                href="/trips"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>View all ({trips.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips.slice(0, 3).map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="group p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-blue-500/50 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {trip.status}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {trip._count?.days || 1} {trip._count?.days === 1 ? 'day' : 'days'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {trip.title || trip.destinationName}
                    </h3>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                      <span className="truncate">{trip.destinationName}</span>
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(trip.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View Itinerary &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Two-Column Grid: Upcoming Reminders & Badges */}
        <section aria-label="Reminders and Achievements" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Reminders Card */}
          <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Upcoming Reminders
                    </h2>
                    <p className="text-xs text-zinc-400">Transit &amp; activity alerts</p>
                  </div>
                </div>
                <Link
                  href="/reminders"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View All &rarr;
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                  <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                </div>
              ) : reminders.length > 0 ? (
                <div className="space-y-2.5">
                  {reminders.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {r.title}
                        </p>
                        <p className="text-zinc-400 truncate mt-0.5">
                          {r.trip?.destinationName || r.message}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {new Date(r.scheduledAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="block text-[10px] text-zinc-400">
                          {new Date(r.scheduledAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-medium text-zinc-700 dark:text-zinc-300">No upcoming reminders</p>
                  <p className="mt-0.5">Set alerts for flights, trains, and day activities.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Link
                href="/reminders"
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium inline-flex items-center gap-1"
              >
                <span>Manage smart travel reminders</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Badges & Achievements Card */}
          <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Badges &amp; Achievements
                    </h2>
                    <p className="text-xs text-zinc-400">Travel milestones and progress</p>
                  </div>
                </div>
                <Link
                  href="/achievements"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View All &rarr;
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                  <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Progress summary stats */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block mb-0.5">Unlocked Badges</span>
                      <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {unlockedAchievementsCount} / {achievements.length || 10}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <span className="text-[11px] text-zinc-400 block mb-0.5">Traveler Points</span>
                      <span className="text-base font-bold text-violet-600 dark:text-violet-400">
                        {totalAchievementsPoints} pts
                      </span>
                    </div>
                  </div>

                  {/* Highlights list */}
                  {achievements.length > 0 ? (
                    <div className="space-y-2">
                      {achievements.slice(0, 2).map((a) => {
                        const IconComp = ACHIEVEMENT_ICONS[a.icon] || Trophy;
                        return (
                          <div
                            key={a.type || a.title}
                            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                  {a.title}
                                </p>
                                <p className="text-[11px] text-zinc-400 truncate">{a.description}</p>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                                a.isUnlocked
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {a.isUnlocked ? 'Unlocked' : `${a.progress}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-zinc-400">
                      <Sparkles className="w-7 h-7 text-amber-500 mx-auto mb-1.5 opacity-80" />
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">
                        Start exploring to unlock achievements.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Link
                href="/achievements"
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium inline-flex items-center gap-1"
              >
                <span>Explore all travel badges</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* Notifications & System Status Bar */}
        <section aria-label="Alerts Status" className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread travel ${unreadCount === 1 ? 'alert' : 'alerts'}`
                  : "You're all caught up with alerts"}
              </p>
              <p className="text-[11px] text-zinc-400">
                Real-time transit updates, itinerary changes, and weather notifications.
              </p>
            </div>
          </div>

          <Link
            href="/notifications"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shrink-0 min-h-[44px]"
          >
            <span>View Notifications</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </section>
      </main>
    </div>
  );
}
