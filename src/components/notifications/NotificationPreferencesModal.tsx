'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Bell,
  Shield,
  CloudSun,
  MapPin,
  Plane,
  Wallet,
  Trophy,
  Calendar,
  Send,
  Smartphone,
} from 'lucide-react';
import { NotificationPreferences, UpdatePreferencesInput } from '@/lib/notifications/types';
import {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push/browser-push';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function NotificationPreferencesModal({
  isOpen,
  onClose,
  onUpdated,
}: NotificationPreferencesModalProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Register service worker in background
    registerServiceWorker();

    let isMounted = true;
    async function loadPreferences() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/notifications/preferences');
        if (!res.ok) throw new Error('Failed to load preferences');
        const data = await res.json();
        if (isMounted && data.success) {
          setPreferences(data.data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading preferences');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleToggle = (key: keyof UpdatePreferencesInput) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key as keyof NotificationPreferences],
    });
  };

  const handlePushToggle = async () => {
    if (!preferences) return;
    const nextState = !preferences.pushEnabled;
    setPreferences({
      ...preferences,
      pushEnabled: nextState,
    });

    if (nextState) {
      const res = await subscribeToPush();
      if (!res.success) {
        setError(res.error || 'Failed to enable browser push notifications');
        setPreferences((prev) => (prev ? { ...prev, pushEnabled: false } : null));
      } else {
        setSuccess('Browser push notifications enabled & stored in Supabase!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } else {
      await unsubscribeFromPush();
    }
  };

  const handleSendTestPush = async () => {
    setTestPushLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/notifications/push/test', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Test notification created in Supabase & dispatched!');
        onUpdated?.();
        setTimeout(() => setSuccess(null), 4000);
      } else {
        throw new Error(data.error?.message || 'Failed to trigger test push');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error triggering test notification');
    } finally {
      setTestPushLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: UpdatePreferencesInput = {
        tripReminders: preferences.tripReminders,
        itineraryReminders: preferences.itineraryReminders,
        transportationReminders: preferences.transportationReminders,
        weatherAlerts: preferences.weatherAlerts,
        budgetAlerts: preferences.budgetAlerts,
        achievementAlerts: preferences.achievementAlerts,
        securityAlerts: preferences.securityAlerts,
        pushEnabled: preferences.pushEnabled,
      };

      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save preferences');
      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
        setSuccess('Preferences saved successfully!');
        onUpdated?.();
        setTimeout(() => setSuccess(null), 2500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const categories = [
    {
      key: 'tripReminders' as const,
      label: 'Trip Reminders',
      desc: 'Upcoming trips, check-ins, and countdown alerts',
      icon: <Calendar className="w-5 h-5 text-blue-500" />,
    },
    {
      key: 'itineraryReminders' as const,
      label: 'Itinerary Activities',
      desc: 'Reminders for scheduled activities and sights',
      icon: <MapPin className="w-5 h-5 text-emerald-500" />,
    },
    {
      key: 'transportationReminders' as const,
      label: 'Transportation Departures',
      desc: 'Flights, trains, buses, and journey status alerts',
      icon: <Plane className="w-5 h-5 text-purple-500" />,
    },
    {
      key: 'weatherAlerts' as const,
      label: 'Weather Warnings',
      desc: 'Rain, temperature spikes, and forecast anomalies',
      icon: <CloudSun className="w-5 h-5 text-amber-500" />,
    },
    {
      key: 'budgetAlerts' as const,
      label: 'Budget Threshold Alerts',
      desc: 'Alerts when spending approaches or exceeds targets',
      icon: <Wallet className="w-5 h-5 text-orange-500" />,
    },
    {
      key: 'achievementAlerts' as const,
      label: 'Badges & Achievements',
      desc: 'Unlock notifications when milestones are achieved',
      icon: <Trophy className="w-5 h-5 text-yellow-500" />,
    },
    {
      key: 'securityAlerts' as const,
      label: 'Security & Account Alerts',
      desc: 'Password changes, 2FA updates, and login activity',
      icon: <Shield className="w-5 h-5 text-rose-500" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pref-modal-title"
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 id="pref-modal-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Notification Preferences
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Customize alert categories and browser push delivery
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Web Push / FCM card */}
          {preferences && (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Browser Web Push / FCM
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Receive alerts on your browser even when tab is closed
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px]">
                  <input
                    id="toggle-push"
                    type="checkbox"
                    checked={preferences.pushEnabled}
                    onChange={handlePushToggle}
                    className="w-5 h-5 rounded text-blue-600 border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-blue-200/50 dark:border-blue-900/40 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Tokens are encrypted & stored in Supabase
                </span>
                <button
                  type="button"
                  id="send-test-push-btn"
                  onClick={handleSendTestPush}
                  disabled={testPushLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testPushLoading ? 'Sending...' : 'Send Test Push'}</span>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : preferences ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Categories
              </h4>
              {categories.map((cat) => {
                const isEnabled = preferences[cat.key];
                return (
                  <label
                    key={cat.key}
                    htmlFor={`toggle-${cat.key}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3.5 pr-2">
                      <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        {cat.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {cat.label}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {cat.desc}
                        </div>
                      </div>
                    </div>

                    <input
                      id={`toggle-${cat.key}`}
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(cat.key)}
                      className="w-5 h-5 rounded text-blue-600 border-zinc-300 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer min-h-[44px] min-w-[44px]"
                    />
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-semibold text-white shadow-sm disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
