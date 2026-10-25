'use client';

import React from 'react';
import { Compass, Loader2 } from 'lucide-react';

interface MapLoadingProps {
  message?: string;
  className?: string;
}

export function MapLoading({
  message = 'Loading map experience...',
  className = '',
}: MapLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading map"
      className={`relative flex flex-col items-center justify-center w-full h-full min-h-[350px] bg-slate-100/80 dark:bg-zinc-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 ${className}`}
    >
      {/* Background ambient map grid shimmer */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/40 via-transparent to-slate-200/40 dark:from-zinc-800/40 dark:to-zinc-800/40 animate-pulse pointer-events-none" />

      {/* Center card */}
      <div className="relative z-10 flex flex-col items-center gap-3 p-6 max-w-xs text-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800">
        <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
          <Compass className="w-6 h-6 animate-[spin_6s_linear_infinite]" aria-hidden="true" />
          <Loader2 className="absolute -bottom-1 -right-1 w-4 h-4 text-blue-500 animate-spin" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
            {message}
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Connecting to Google Maps Platform
          </p>
        </div>
      </div>
    </div>
  );
}
