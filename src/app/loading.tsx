import React from 'react';

/**
 * Root Loading component for Next.js App Router.
 * Renders immediately during page transitions to give instant feedback
 * and eliminate the perception of the PWA freezing or hanging.
 */
export default function RootLoading() {
  return (
    <div
      aria-label="Loading page content"
      className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4"
    >
      <div className="relative flex items-center justify-center">
        {/* Pulsing outer ring */}
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 animate-ping" />
        {/* Fast spinning gradient indicator */}
        <div className="absolute w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>

      <div className="flex flex-col items-center space-y-2 max-w-xs text-center">
        <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
        <div className="h-3 w-44 bg-zinc-100 dark:bg-zinc-800/60 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
