'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Compass, CheckCircle2, Wand2 } from 'lucide-react';

export interface AiGenerationLoaderProps {
  title?: string;
  subtitle?: string;
  stages?: string[];
  currentProgress?: string;
  compact?: boolean;
}

const DEFAULT_STAGES = [
  'Analyzing destination highlights & climate...',
  'Mapping optimal travel distances & commute times...',
  'Curating personalized sights, cafes & hidden spots...',
  'Balancing morning, afternoon & evening schedule...',
  'Finalizing your smart wander itinerary...',
];

/**
 * AiGenerationLoader
 * High-aesthetic, animated AI generation loader with rotating generation stages,
 * gradient ambient glows, and floating AI sparkles.
 */
export function AiGenerationLoader({
  title = 'AI is Planning Your Trip',
  subtitle = 'Gemini AI is crafting your smart itinerary tailored to your preferences...',
  stages = DEFAULT_STAGES,
  currentProgress,
  compact = false,
}: AiGenerationLoaderProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % stages.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full flex flex-col items-center justify-center text-center select-none relative overflow-hidden ${
        compact ? 'py-8 px-4' : 'py-16 px-6'
      }`}
    >
      {/* Ambient background blur glow */}
      <div className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-violet-600/15 via-blue-500/15 to-indigo-500/15 blur-3xl pointer-events-none -z-10 animate-pulse" />

      {/* Main Animated AI Orb */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Outer pulsating AI aura */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-violet-500/20 via-indigo-500/20 to-blue-500/20 animate-ping opacity-60" />

        {/* Multi-color rotating conic border */}
        <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-transparent border-t-violet-600 border-r-indigo-500 border-b-cyan-400 animate-spin" />

        {/* Counter-rotating dashed ring */}
        <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-dashed border-violet-400/40 dark:border-violet-500/30 animate-[spin_8s_linear_infinite_reverse]" />

        {/* Glassmorphic central icon card */}
        <div className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/95 dark:bg-zinc-900/95 shadow-xl shadow-indigo-500/25 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center backdrop-blur-md">
          <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
        </div>

        {/* Floating orbital spark badge */}
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-violet-600 text-white shadow-md flex items-center justify-center animate-bounce">
          <Wand2 className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Title & Tagline */}
      <div className="space-y-2 max-w-md">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/50 dark:to-indigo-950/50 border border-violet-200/80 dark:border-violet-800/80 text-violet-700 dark:text-violet-300 text-xs font-semibold shadow-xs">
          <Brain className="w-3.5 h-3.5" />
          <span>GhumneChalo AI Engine</span>
        </div>

        <h3 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>

        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Active Stage Indicator Card */}
      <div className="mt-6 w-full max-w-sm rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-spin" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-violet-600 dark:text-violet-400">
              Live Progress
            </span>
            <p
              key={currentProgress || activeStageIndex}
              className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              {currentProgress || stages[activeStageIndex]}
            </p>
          </div>
        </div>

        {/* Shimmer progress line */}
        <div className="mt-3 w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-400 rounded-full animate-gc-progress shadow-xs shadow-violet-500/50" />
        </div>
      </div>
    </div>
  );
}
