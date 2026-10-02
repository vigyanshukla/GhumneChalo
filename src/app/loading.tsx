'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, MapPin, Plane, Luggage } from 'lucide-react';

const LOADING_MESSAGES = [
  'Mapping your scenic routes...',
  'Gathering local hidden gems...',
  'Evaluating real-time weather & packing tips...',
  'Finding the best culinary spots...',
  'Fine-tuning your personalized wanderlust plan...',
];

/**
 * Root Loading Screen for GhumneChalo.
 * Displayed during Next.js route transitions and page loading.
 * Beautiful, animated, travel-themed with dynamic message rotation.
 */
export default function RootLoading() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Planning your trip"
      className="min-h-[75vh] w-full flex flex-col items-center justify-center p-6 select-none relative overflow-hidden"
    >
      {/* Background ambient glow effect */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-blue-500/15 via-indigo-500/10 to-emerald-500/15 blur-3xl pointer-events-none -z-10 animate-pulse" />

      {/* Central Animated Illustration / Compass Ring */}
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer pulsating dashed orbit */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-dashed border-blue-400/40 dark:border-blue-500/30 animate-[spin_12s_linear_infinite]" />

        {/* Middle gradient spinning glow ring */}
        <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-transparent border-t-blue-600 border-r-indigo-500 border-b-cyan-400 animate-spin" />

        {/* Inner glass icon card */}
        <div className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/90 dark:bg-zinc-900/90 shadow-xl shadow-blue-500/20 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center backdrop-blur-md">
          <Compass className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 animate-[spin_6s_ease-in-out_infinite]" />
        </div>

        {/* Floating orbital travel icons */}
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 animate-bounce">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-pulse">
          <MapPin className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Main Text & Heading */}
      <div className="text-center space-y-3 max-w-sm px-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-700 dark:text-blue-400 text-xs font-semibold shadow-xs">
          <Plane className="w-3.5 h-3.5 animate-pulse" />
          <span>GhumneChalo Explorer</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
          Planning your trip
          <span className="inline-flex overflow-hidden w-6 text-left">
            <span className="animate-pulse">...</span>
          </span>
        </h2>

        {/* Dynamic Rotating Subtitle */}
        <div className="h-6 flex items-center justify-center overflow-hidden">
          <p
            key={messageIndex}
            className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium animate-in fade-in slide-in-from-bottom-2 duration-300 transition-all"
          >
            {LOADING_MESSAGES[messageIndex]}
          </p>
        </div>

        {/* Sleek horizontal shimmer progress line */}
        <div className="w-48 sm:w-56 h-1.5 mx-auto bg-zinc-200/80 dark:bg-zinc-800 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 rounded-full animate-gc-progress shadow-sm shadow-blue-500/50" />
        </div>
      </div>
    </div>
  );
}
