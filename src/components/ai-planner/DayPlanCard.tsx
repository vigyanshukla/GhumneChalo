'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Utensils,
} from 'lucide-react';
import { GeneratedDayPlan } from '@/lib/ai/types';

interface DayPlanCardProps {
  day: GeneratedDayPlan;
  tripId: string;
  onDayRegenerated: (updatedDay: GeneratedDayPlan) => void;
}

export function DayPlanCard({ day, tripId, onDayRegenerated }: DayPlanCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/ai-plan/day/${day.dayNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to regenerate day');
      }
      onDayRegenerated(json.data);
      setShowRegenerateInput(false);
      setInstruction('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error regenerating day');
    } finally {
      setIsRegenerating(false);
    }
  };

  const dateObj = new Date(`${day.date}T00:00:00Z`);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : day.date;

  return (
    <div
      data-testid={`ai-day-card-${day.dayNumber}`}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden"
    >
      {/* Day Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-zinc-800/60 dark:to-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-600 text-white">
              Day {day.dayNumber}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {formattedDate}
            </span>
          </div>
          <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">
            {day.title}
          </h4>
          {day.theme && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Theme: {day.theme}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegenerateInput(!showRegenerateInput)}
            disabled={isRegenerating}
            data-testid={`regenerate-day-btn-${day.dayNumber}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRegenerating ? 'Refreshing...' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {/* Optional Regenerate Instruction Input */}
      {showRegenerateInput && (
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2 items-center">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isRegenerating) {
                handleRegenerate();
              }
            }}
            placeholder="e.g. Add more beach time, make it relaxed, focus on history..."
            className="w-full sm:flex-1 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isRegenerating ? 'Applying...' : 'Apply'}
            </button>
            <button
              onClick={() => {
                setShowRegenerateInput(false);
                setInstruction('');
              }}
              disabled={isRegenerating}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs">
          {error}
        </div>
      )}

      {/* Activities Timeline */}
      <div className="p-4 sm:p-5 space-y-3">
        {day.activities.map((act, idx) => (
          <div
            key={act.id || idx}
            className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80"
          >
            <div className="flex flex-col items-center pt-0.5">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                {act.startTime}
              </span>
              <span className="text-[9px] text-zinc-400 whitespace-nowrap">
                {act.durationMinutes}m
              </span>
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {act.name}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 uppercase">
                  {act.category}
                </span>
                {act.priority === 'must_see' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Must See
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {act.description}
              </p>

              {act.reasoning && (
                <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-3 h-3 flex-shrink-0" />
                  <span>{act.reasoning}</span>
                </div>
              )}
            </div>

            {act.estimatedCost !== undefined && act.estimatedCost !== null && (
              <span
                className={`text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-md ${
                  act.estimatedCost > 0
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                }`}
              >
                {act.estimatedCost > 0 ? `~₹${act.estimatedCost.toLocaleString('en-IN')}` : 'Free'}
              </span>
            )}
          </div>
        ))}

        {/* Meal Suggestions */}
        {day.meals && day.meals.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
              Recommended Dining
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {day.meals.map((m, mIdx) => (
                <div
                  key={mIdx}
                  className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs space-y-0.5"
                >
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold capitalize">
                    <Utensils className="w-3 h-3" />
                    <span>{m.type}</span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 text-[11px] line-clamp-2">
                    {m.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {day.notes && (
          <p className="text-[11px] text-zinc-400 italic pt-1">
            Tip: {day.notes}
          </p>
        )}
      </div>
    </div>
  );
}
