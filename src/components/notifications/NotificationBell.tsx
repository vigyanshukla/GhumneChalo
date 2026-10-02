'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  BellRing,
  CheckCheck,
  Settings,
  RefreshCw,
  ExternalLink,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { NotificationItem } from '@/lib/notifications/types';
import { NotificationItemView } from './NotificationItemView';
import { subscribeToPush, useNotificationPermission } from '@/lib/push/browser-push';
import { CACHE_KEYS, getStoredItem, cachedFetch } from '@/lib/cache/client-cache';

const NotificationPreferencesModal = dynamic(
  () => import('./NotificationPreferencesModal').then((m) => m.NotificationPreferencesModal),
  { ssr: false }
);

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const cached = getStoredItem<{ success: boolean; data: { unreadCount: number } }>(
      CACHE_KEYS.NOTIFICATIONS_UNREAD
    );
    return cached?.data?.data?.unreadCount || 0;
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const permission = useNotificationPermission();
  const webPushGranted = permission === 'granted';
  const [optInLoading, setOptInLoading] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notification list
  const fetchNotifications = async () => {
    try {
      const url = `/api/notifications?limit=15${unreadOnly ? '&unread=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load notifications');
      const data = await res.json();
      if (data.success && data.data?.notifications) {
        setNotifications(data.data.notifications);
        if (typeof data.data.unreadCount === 'number') {
          setUnreadCount(data.data.unreadCount);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching notifications');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and visibility-aware periodic poll
  useEffect(() => {
    let ignore = false;
    let lastFetched = 0;

    async function loadInitial() {
      // Avoid network call if document is hidden
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      try {
        const data = await cachedFetch<{ success: boolean; data: { unreadCount: number } }>(
          '/api/notifications/unread-count',
          undefined,
          { cacheKey: CACHE_KEYS.NOTIFICATIONS_UNREAD, ttlMs: 60 * 1000 }
        );
        if (!ignore && data?.success && typeof data.data.unreadCount === 'number') {
          setUnreadCount(data.data.unreadCount);
          lastFetched = Date.now();
        }
      } catch {
        // ignore network error in background poll
      }
    }

    loadInitial();
    const interval = setInterval(loadInitial, 30000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        // Only refresh if more than 20 seconds passed since last check
        if (Date.now() - lastFetched > 20000) {
          loadInitial();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      ignore = true;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  // When dropdown opens or filter toggles, reload list
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function loadList() {
      try {
        const url = `/api/notifications?limit=15${unreadOnly ? '&unread=true' : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!ignore && data.success && data.data?.notifications) {
          setNotifications(data.data.notifications);
          if (typeof data.data.unreadCount === 'number') {
            setUnreadCount(data.data.unreadCount);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error fetching notifications');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadList();
    return () => {
      ignore = true;
    };
  }, [isOpen, unreadOnly]);

  // Click outside or Escape key to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
        if (target && !target.readAt) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch {
      // ignore
    }
  };

  const handleQuickOptIn = async () => {
    setOptInLoading(true);
    try {
      const res = await subscribeToPush();
      if (res.success) {
        fetchNotifications();
      }
    } catch {
      // ignore
    } finally {
      setOptInLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="notification-bell-btn"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200/70 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            id="notification-badge"
            className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-rose-600 rounded-full shadow-sm ring-2 ring-white dark:ring-zinc-900 animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          id="notification-panel"
          className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-auto sm:right-0 mt-2 sm:w-[420px] max-w-[calc(100vw-16px)] sm:max-w-none bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[580px] animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                title="Notification preferences"
                aria-label="Notification preferences"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={fetchNotifications}
                title="Refresh"
                aria-label="Refresh notifications"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Subheader / Tabs */}
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50/80 dark:bg-zinc-950/50 border-b border-zinc-200/60 dark:border-zinc-800/60 shrink-0 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  !unreadOnly
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  unreadOnly
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Unread
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Direct In-Web Push Opt-In Mini-Card (Non-legacy) */}
          {!webPushGranted && (
            <div className="mx-3 mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between gap-3 shadow-xs shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 leading-tight">
                    <span>Direct Web Alerts</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold">
                      1-CLICK
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                    Live flight & weather alerts on this device
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleQuickOptIn}
                disabled={optInLoading}
                id="quick-optin-btn"
                className="px-3 py-1.5 min-h-[36px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {optInLoading ? 'Enabling...' : 'Enable'}
              </button>
            </div>
          )}

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && notifications.length === 0 ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 animate-pulse"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="py-8 text-center px-4">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <Inbox className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[240px] mx-auto">
                  {unreadOnly
                    ? "You're all caught up! Switch to 'All' to view your travel notification history."
                    : 'We will notify you about upcoming trips, itinerary events, weather alerts, and achievements.'}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItemView
                  key={n.id}
                  notification={n}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Panel Footer */}
          <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/30 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xs hover:bg-zinc-50 transition-colors"
            >
              <span>Open Notification Center</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        onUpdated={fetchNotifications}
      />
    </div>
  );
}
