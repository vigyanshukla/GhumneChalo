'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw, Compass, ShieldAlert, Calendar } from 'lucide-react';

export default function OfflineClient() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between p-4 sm:p-8">
      {/* Top Banner */}
      <header className="max-w-2xl mx-auto w-full pt-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4 shadow-lg shadow-amber-500/5">
          <WifiOff className="w-8 h-8 animate-pulse" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
          You are Offline
        </h1>
        <p className="mt-3 text-neutral-400 text-sm sm:text-base max-w-md mx-auto">
          GhumneChalo keeps your travel plans alive even without an active internet connection.
        </p>
      </header>

      {/* Main Content Card */}
      <main className="max-w-xl mx-auto w-full my-8">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
            <span>Available Offline on Your Device:</span>
          </h2>

          <div className="space-y-4">
            <Link
              href="/trips"
              className="flex items-start gap-4 p-4 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-all duration-200 group"
            >
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Cached Trips & Itineraries
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  View your pre-cached destinations, scheduled activities, and transit details.
                </div>
              </div>
            </Link>

            <Link
              href="/emergency"
              className="flex items-start gap-4 p-4 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-all duration-200 group"
            >
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white group-hover:text-rose-300 transition-colors">
                  Emergency Helplines (112)
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  12 verified national crisis numbers and offline safety assistance.
                </div>
              </div>
            </Link>

            <Link
              href="/reminders"
              className="flex items-start gap-4 p-4 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-all duration-200 group"
            >
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Scheduled Reminders
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  Review planned timing for upcoming transport, flights, and activities.
                </div>
              </div>
            </Link>
          </div>

          {/* Reconnect Action Button */}
          <div className="mt-8 pt-6 border-t border-neutral-800/80 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-semibold shadow-lg shadow-amber-500/20 active:scale-98 transition-all min-h-[48px] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
            <Link
              href="/trips"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors min-h-[48px]"
            >
              Go to My Trips
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-neutral-500 pb-4">
        GhumneChalo Offline Mode • Cached snapshots are automatically synced when reconnected.
      </footer>
    </div>
  );
}
