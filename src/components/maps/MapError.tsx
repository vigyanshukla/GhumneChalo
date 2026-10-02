'use client';

import React from 'react';
import { AlertCircle, RefreshCw, MapPinOff } from 'lucide-react';
import { GoogleMapsLoadError } from '@/lib/maps/loader';

interface MapErrorProps {
  error?: GoogleMapsLoadError | string | null;
  onRetry?: () => void;
  className?: string;
}

export function MapError({
  error,
  onRetry,
  className = '',
}: MapErrorProps) {
  let title = 'Map Currently Unavailable';
  let description =
    'We encountered an issue displaying the interactive map. Please check your network connection and try again.';

  if (error === 'MISSING_API_KEY') {
    title = 'Configuration Required';
    description =
      'Google Maps has not been configured for this environment. Please ensure the client API key is set.';
  } else if (error === 'AUTH_FAILURE') {
    title = 'Authorization Error';
    description =
      'The map service could not authenticate the request. Please verify the API key restrictions and enabled services.';
  } else if (error === 'TIMEOUT') {
    title = 'Connection Timed Out';
    description =
      'The map took too long to respond. Please check your internet connection or any active content blockers.';
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative flex flex-col items-center justify-center w-full h-full min-h-[350px] p-6 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center ${className}`}
    >
      <div className="flex flex-col items-center max-w-sm gap-4 p-6 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
          {error === 'MISSING_API_KEY' ? (
            <MapPinOff className="w-6 h-6" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            {title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            {description}
          </p>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 mt-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry loading map
          </button>
        )}
      </div>
    </div>
  );
}
