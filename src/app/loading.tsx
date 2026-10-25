'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Wand2, Compass } from 'lucide-react';

const AI_LOADING_STAGES = [
  'Mapping your scenic routes & destination intelligence...',
  'Discovering local hidden gems & top-rated sights...',
  'Evaluating real-time weather & packing insights...',
  'Optimizing schedule balance & commute efficiency...',
  'Finalizing your smart wander itinerary...',
];

/**
 * Root Loading Screen for GhumneChalo.
 * Displayed during Next.js route transitions and page loading.
 * Modern, high-aesthetic AI Travel Engine loader with neural glowing orb.
 */
export default function RootLoading() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % AI_LOADING_STAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="AI is planning your trip"
      className="min-h-[75vh] w-full flex flex-col items-center justify-center p-6 select-none relative overflow-hidden"
    >
      {/* Background ambient glowing nebula */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-violet-600/20 via-indigo-600/15 to-cyan-400/20 blur-3xl pointer-events-none -z-10 animate-pulse" />

      {/* Central Animated AI Neural Orb */}
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer soft pulsating aura */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-violet-500/15 via-indigo-500/15 to-cyan-500/15 animate-ping opacity-60" />

        {/* Counter-rotating dashed orbital ring */}
        <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-dashed border-violet-400/40 dark:border-violet-500/30 animate-[spin_10s_linear_infinite_reverse]" />

        {/* Multi-gradient spinning energetic ring */}
        <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-transparent border-t-violet-600 border-r-indigo-500 border-b-cyan-400 animate-spin" />

        {/* Glassmorphism central AI core card */}
        <div className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/95 dark:bg-zinc-900/95 shadow-xl shadow-indigo-500/25 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center backdrop-blur-md">
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
        </div>

        {/* Floating orbital AI badges */}
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/40 flex items-center justify-center animate-bounce">
          <Wand2 className="w-3.5 h-3.5" />
        </div>
        <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-cyan-500/15 dark:bg-cyan-500/25 border border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 animate-pulse">
          <Compass className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Main Text & AI Badge */}
      <div className="text-center space-y-3 max-w-sm px-4">
        {/* Sleek AI Engine Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-violet-50 via-indigo-50 to-cyan-50 dark:from-violet-950/60 dark:via-indigo-950/60 dark:to-cyan-950/60 border border-violet-200/80 dark:border-violet-800/80 text-violet-700 dark:text-violet-300 text-xs font-semibold shadow-xs">
          <Brain className="w-3.5 h-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
          <span>GhumneChalo AI Engine</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
          Planning your trip
          <span className="inline-flex overflow-hidden w-6 text-left">
            <span className="animate-pulse">...</span>
          </span>
        </h2>

        {/* Dynamic Rotating AI Thought Stage */}
        <div className="h-6 flex items-center justify-center overflow-hidden">
          <p
            key={stageIndex}
            className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium animate-in fade-in slide-in-from-bottom-2 duration-300 transition-all"
          >
            {AI_LOADING_STAGES[stageIndex]}
          </p>
        </div>

        {/* High-tech AI Indigo-Purple Shimmer Progress Bar */}
        <div className="w-48 sm:w-56 h-1.5 mx-auto bg-zinc-200/80 dark:bg-zinc-800 rounded-full overflow-hidden mt-3 shadow-inner">
          <div className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 rounded-full animate-gc-progress shadow-xs shadow-indigo-500/50" />
        </div>
      </div>
    </div>
  );
}
