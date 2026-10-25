'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  CloudSun,
  Navigation,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { GeneratedTripPlan, GeneratedDayPlan } from '@/lib/ai/types';
import { DayPlanCard } from './DayPlanCard';

interface PlanPreviewProps {
  plan: GeneratedTripPlan;
  tripId: string;
  onApplyPlan: (mode: 'merge' | 'replace') => Promise<void>;
  isApplying: boolean;
  mode?: 'merge' | 'replace';
  onModeChange?: (mode: 'merge' | 'replace') => void;
}

export function PlanPreview({
  plan,
  tripId,
  onApplyPlan,
  isApplying,
  mode: externalMode,
  onModeChange,
}: PlanPreviewProps) {
  const [currentPlan, setCurrentPlan] = useState<GeneratedTripPlan>(plan);
  const [internalMode, setInternalMode] = useState<'merge' | 'replace'>('merge');

  const mode = externalMode ?? internalMode;
  const setMode = (newMode: 'merge' | 'replace') => {
    setInternalMode(newMode);
    onModeChange?.(newMode);
  };

  const handleDayRegenerated = (updatedDay: GeneratedDayPlan) => {
    setCurrentPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.dayNumber === updatedDay.dayNumber ? updatedDay : d)),
    }));
  };

  return (
    <div className="space-y-6" data-testid="ai-plan-preview">
      {/* Plan Header Summary */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-zinc-800 dark:to-zinc-850 border border-blue-200 dark:border-zinc-700 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>AI Generated Travel Plan • {currentPlan.modelUsed}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
          {currentPlan.destination} ({currentPlan.tripDurationDays} Days)
        </h3>

        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {currentPlan.summary}
        </p>

        {/* Highlights & Context Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {currentPlan.weatherConsiderations.length > 0 && (
            <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/60 border border-blue-100 dark:border-zinc-800 flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <CloudSun className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>{currentPlan.weatherConsiderations[0]}</span>
            </div>
          )}

          {currentPlan.transportationSuggestions.length > 0 && (
            <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/60 border border-blue-100 dark:border-zinc-800 flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <Navigation className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span>{currentPlan.transportationSuggestions[0]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-4">
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span>Day-by-Day Itinerary Plan</span>
        </h4>

        {currentPlan.days.map((day) => (
          <DayPlanCard
            key={day.dayNumber}
            day={day}
            tripId={tripId}
            onDayRegenerated={handleDayRegenerated}
          />
        ))}
      </div>

      {/* Application Mode & Confirm */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
            Apply Options
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('merge')}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                mode === 'merge'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                  : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Merge with Existing (Recommended)</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Adds the generated activities to your itinerary days without removing your previously created activities.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('replace')}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                mode === 'replace'
                  ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                  : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Replace Existing Activities</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Overwrites current itinerary items with the newly generated activities. Use with caution.
              </p>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {mode === 'merge'
              ? 'Activities will be safely appended to your itinerary.'
              : 'Existing itinerary items will be replaced with this plan.'}
          </p>

          <button
            onClick={() => onApplyPlan(mode)}
            disabled={isApplying}
            data-testid="apply-ai-plan-btn"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Applying Plan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply to Itinerary</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
