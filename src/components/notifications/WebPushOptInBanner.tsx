'use client';

import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Check,
  Send,
  Sparkles,
  Smartphone,
  AlertCircle,
  ShieldCheck,
  VolumeX,
  RefreshCw,
  Plane,
  CloudSun,
  MapPin,
  Clock,
} from 'lucide-react';
import {
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  useNotificationPermission,
} from '@/lib/push/browser-push';

interface WebPushOptInBannerProps {
  onNotificationSent?: () => void;
  className?: string;
}

export function WebPushOptInBanner({
  onNotificationSent,
  className = '',
}: WebPushOptInBannerProps) {
  const permission = useNotificationPermission();
  const [isSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return 'Notification' in window && 'serviceWorker' in navigator;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [testPushLoading, setTestPushLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => void registerServiceWorker());
      } else {
        setTimeout(() => void registerServiceWorker(), 1500);
      }
    }
  }, []);

  const [, setTick] = useState<number>(0);
  const refreshPermissionState = () => {
    setTick((t) => t + 1);
  };

  const handleEnableWebPush = async () => {
    setLoading(true);
    setStatusMessage(null);
    setIsSuccess(false);

    try {
      const res = await subscribeToPush();
      refreshPermissionState();
      if (res.success) {
        setIsSuccess(true);
        setStatusMessage('Instant Web Notifications enabled & synced with Supabase!');
        onNotificationSent?.();
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        setStatusMessage(res.error || 'Permission was not granted');
      }
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : 'Error enabling notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableWebPush = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await unsubscribeFromPush();
      if (res.success) {
        setIsSuccess(true);
        setStatusMessage('Web notifications muted for this device.');
        onNotificationSent?.();
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : 'Error disabling notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/notifications/push/test', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
        setStatusMessage('Test alert dispatched and verified in Supabase!');
        onNotificationSent?.();
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        throw new Error(data.error?.message || 'Failed to dispatch push notification');
      }
    } catch (err: unknown) {
      setIsSuccess(false);
      setStatusMessage(err instanceof Error ? err.message : 'Error triggering test push');
    } finally {
      setTestPushLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  // Active / Granted state: Modern Emerald Card with Direct Controls
  if (permission === 'granted') {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-zinc-900 border border-emerald-200/80 dark:border-emerald-800/60 p-5 sm:p-6 shadow-sm transition-all ${className}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-white dark:ring-zinc-900"></span>
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Direct Web Notifications Active
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <Check className="w-3 h-3" />
                  SUPABASE SYNCED
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                This browser is linked for instant flight gate changes, weather alerts, and itinerary reminders.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={testPushLoading}
              id="banner-test-push-btn"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{testPushLoading ? 'Dispatching...' : 'Send Live Test Alert'}</span>
            </button>

            <button
              type="button"
              onClick={handleDisableWebPush}
              disabled={loading}
              title="Mute notifications on this device"
              aria-label="Mute notifications on this device"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mute</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-2 text-xs font-semibold ${
              isSuccess
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isSuccess ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // Denied / Blocked state: Helpful In-App Recovery Guide
  if (permission === 'denied') {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-5 sm:p-6 shadow-sm ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Web Notifications Currently Paused
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                Browser permission is currently set to block. To enable direct web alerts: click the{' '}
                <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">lock / settings icon 🔒</strong> in your browser&apos;s address bar, set Notifications to <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Allow</strong>, and click re-check.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshPermissionState}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Re-check Permission</span>
          </button>
        </div>
      </div>
    );
  }

  // Default state: Modern In-Web Direct Opt-In Hub (No Legacy Pop-up Feel)
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-7 shadow-xl border border-indigo-900/50 ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Explanation and Value Proposition */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              DIRECT WEB OPT-IN
            </span>
            <span className="text-xs text-indigo-300/80 font-medium hidden sm:inline">
              Zero legacy popups • 100% Control
            </span>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
              Get Smart Wander Live Travel Alerts
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl leading-relaxed">
              Stay ahead with real-time flight departure countdowns, weather warnings, and itinerary activities delivered directly to this browser. Tokens are encrypted and saved securely in Supabase.
            </p>
          </div>

          {/* Value pill highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs text-slate-300">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Plane className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Gate & Departure Alerts</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Adverse Weather Warnings</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Itinerary Activity Reminders</span>
            </div>
          </div>
        </div>

        {/* Right: Live Preview Card + Direct 1-Click Action */}
        <div className="lg:w-80 flex flex-col gap-3 shrink-0">
          {/* Authentic Live Preview Card */}
          <div className="p-3.5 rounded-2xl bg-white/10 dark:bg-black/30 border border-white/15 backdrop-blur-md shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-blue-200 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                Live Alert Preview
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                Now
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Plane className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white leading-tight">
                  Flight GC-402: Boarding in 45m
                </p>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Gate 3B at New Delhi (DEL). Have boarding pass ready.
                </p>
              </div>
            </div>
          </div>

          {/* 1-Click Direct Enable Button */}
          <button
            type="button"
            id="enable-web-notifications-btn"
            onClick={handleEnableWebPush}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3 min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-600 hover:to-indigo-600 active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{loading ? 'Connecting to Supabase...' : 'Turn On Direct Web Alerts'}</span>
          </button>

          <p className="text-[11px] text-center text-slate-400 font-medium">
            🔒 1-Click Direct Web Opt-in • Mute anytime in settings
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="relative z-10 mt-4 pt-3 border-t border-white/15 flex items-center gap-2 text-xs font-semibold text-white">
          {isSuccess ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
