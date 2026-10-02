'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  RefreshCw,
  Inbox,
  AlertCircle,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Trophy,
  Clock,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { NotificationItem } from '@/lib/notifications/types';
import { NotificationItemView } from '@/components/notifications/NotificationItemView';
import { WebPushOptInBanner } from '@/components/notifications/WebPushOptInBanner';

const NotificationPreferencesModal = dynamic(
  () => import('@/components/notifications/NotificationPreferencesModal').then((m) => m.NotificationPreferencesModal),
  { ssr: false }
);

export function NotificationsDashboard() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showPreferences, setShowPreferences] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      let url = `/api/notifications?page=${page}&limit=15`;
      if (unreadOnly) {
        url += '&unread=true';
      }
      if (selectedType !== 'ALL') {
        url += `&type=${selectedType}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load notifications');
      }
      const data = await res.json();
      if (data.success && data.data) {
        setNotifications(data.data.notifications || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
        if (typeof data.data.unreadCount === 'number') {
          setUnreadCount(data.data.unreadCount);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching notifications');
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly, selectedType]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        let url = `/api/notifications?page=${page}&limit=15`;
        if (unreadOnly) url += '&unread=true';
        if (selectedType !== 'ALL') url += `&type=${selectedType}`;

        const res = await fetch(url);
        const data = await res.json();
        if (!ignore && data.success && data.data) {
          setNotifications(data.data.notifications || []);
          setTotal(data.data.total || 0);
          setTotalPages(data.data.totalPages || 1);
          if (typeof data.data.unreadCount === 'number') {
            setUnreadCount(data.data.unreadCount);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error loading notifications');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [page, unreadOnly, selectedType]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: n.readAt || new Date() }))
        );
        setUnreadCount(0);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const target = notifications.find((n) => n.id === id);
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
        if (target && !target.readAt) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch {
      // ignore
    }
  };

  const handleClearRead = async () => {
    if (!confirm('Are you sure you want to clear all read notifications?')) return;
    try {
      const res = await fetch('/api/notifications?readOnly=true', {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch {
      // ignore
    }
  };

  const categories = [
    { label: 'All', value: 'ALL' },
    { label: 'Trips', value: 'TRIP_REMINDER' },
    { label: 'Itinerary', value: 'ITINERARY_REMINDER' },
    { label: 'Transport', value: 'TRANSPORT_REMINDER' },
    { label: 'Weather', value: 'WEATHER_ALERT' },
    { label: 'Budget', value: 'BUDGET_ALERT' },
    { label: 'Badges', value: 'ACHIEVEMENT_UNLOCKED' },
    { label: 'Security', value: 'SECURITY_ALERT' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col overflow-x-hidden w-full max-w-full">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 w-full overflow-hidden">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              href="/trips"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
              aria-label="Back to Trips"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <Link href="/" className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
                GhumneChalo
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Link
              href="/reminders"
              aria-label="Travel Reminders"
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/60 transition-colors"
              title="Travel Reminders"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden md:inline">Reminders</span>
            </Link>
            <Link
              href="/achievements"
              aria-label="Achievements"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] p-2 rounded-xl text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-950/60 transition-colors"
              title="Achievements"
            >
              <Trophy className="w-5 h-5" />
            </Link>
            <Link
              href="/emergency"
              aria-label="Emergency"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] p-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/60 transition-colors"
              title="Emergency"
            >
              <ShieldAlert className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              aria-label="Notification settings"
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 min-h-[44px] min-w-[44px] rounded-xl text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 transition-colors"
              title="Notification Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">Preferences</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Notification Center
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Stay informed on upcoming trips, itinerary events, transit, and weather alerts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="send-test-notification-btn"
              onClick={async () => {
                try {
                  const res = await fetch('/api/notifications/push/test', { method: 'POST' });
                  if (res.ok) {
                    fetchNotifications();
                  }
                } catch {
                  // ignore
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>Send Test Alert</span>
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 text-sm font-semibold transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark All Read</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClearRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-zinc-600 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:hover:bg-rose-950/30 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Read</span>
            </button>
            <button
              type="button"
              onClick={fetchNotifications}
              aria-label="Refresh"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Instant Web Push Opt-In Banner */}
        <WebPushOptInBanner onNotificationSent={fetchNotifications} className="mb-6" />

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-6 shadow-xs">
          {/* Read / Unread toggle */}
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setUnreadOnly(false);
                setPage(1);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                !unreadOnly
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              All ({total})
            </button>
            <button
              type="button"
              onClick={() => {
                setUnreadOnly(true);
                setPage(1);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
                unreadOnly
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0 ml-1" />
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setSelectedType(cat.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 min-h-[44px] rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedType === cat.value
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Feed */}
        {loading && notifications.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Unable to load notifications
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchNotifications}
              className="mt-4 px-4 py-2 min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {unreadOnly ? 'No unread notifications' : 'No notifications found'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto">
              {unreadOnly
                ? "You've caught up with all your updates! Filter by 'All' to browse historical travel events."
                : 'As you plan trips, add itinerary items, and earn badges, timely alerts will appear here.'}
            </p>
            {unreadOnly && (
              <button
                type="button"
                onClick={() => {
                  setUnreadOnly(false);
                  setPage(1);
                }}
                className="mt-4 px-4 py-2 min-h-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-semibold hover:bg-zinc-200 transition-colors"
              >
                View All Notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <NotificationItemView
                key={n.id}
                notification={n}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Page {page} of {totalPages} ({total} items)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        onUpdated={fetchNotifications}
      />
    </div>
  );
}
