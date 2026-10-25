'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  AlertCircle,
  Sliders,
  DollarSign,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { TravelStyle, PlanningPreferences, GeneratedTripPlan } from '@/lib/ai/types';
import { PlanPreview } from './PlanPreview';
import { AiGenerationLoader } from '@/components/ui/AiGenerationLoader';

interface AiPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: {
    id: string;
    destinationName: string;
    startDate: string | Date;
    endDate: string | Date;
    totalBudget?: number | null;
    currency?: string;
  };
  onPlanApplied: () => void;
}

const TRAVEL_STYLES: { id: TravelStyle; label: string; desc: string }[] = [
  { id: 'relaxed', label: 'Relaxed', desc: 'Leisurely pace, ample free time, few sites/day' },
  { id: 'moderate', label: 'Moderate', desc: 'Balanced mix of key highlights and downtime' },
  { id: 'fast-paced', label: 'Fast-Paced', desc: 'Action-packed, maximizing sights & experiences' },
  { id: 'luxury', label: 'Luxury', desc: 'Upscale dining, premium venues & relaxed transport' },
  { id: 'budget', label: 'Budget-Friendly', desc: 'Free attractions, local eateries & transit' },
];

const INTEREST_TAGS = [
  'Beaches & Coastal',
  'Historic Forts & Palaces',
  'Local Gastronomy & Seafood',
  'Nature & Wildlife',
  'Art & Architecture',
  'Nightlife & Clubs',
  'Shopping & Local Bazaars',
  'Spiritual & Temples',
  'Water Sports & Adventure',
];

export function AiPlannerModal({
  isOpen,
  onClose,
  trip,
  onPlanApplied,
}: AiPlannerModalProps) {
  const [step, setStep] = useState<'preferences' | 'generating' | 'preview'>('preferences');
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('moderate');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Beaches & Coastal',
    'Local Gastronomy & Seafood',
    'Historic Forts & Palaces',
  ]);
  const [budget, setBudget] = useState<string>(
    trip.totalBudget ? String(trip.totalBudget) : ''
  );
  const [travelers, setTravelers] = useState<number>(2);
  const [paceNotes, setPaceNotes] = useState<string>('');

  const [generatedPlan, setGeneratedPlan] = useState<GeneratedTripPlan | null>(null);
  const [applyMode, setApplyMode] = useState<'merge' | 'replace'>('merge');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState('Analyzing trip dates & destination...');

  if (!isOpen) return null;

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStep('generating');
    setError(null);
    setGenerationProgress(`Gathering regional context for ${trip.destinationName}...`);

    try {
      const preferences: PlanningPreferences = {
        travelStyle,
        interests: selectedInterests,
        budget: budget ? parseFloat(budget) : null,
        currency: trip.currency || 'INR',
        travelers,
        paceNotes: paceNotes.trim() || undefined,
      };

      // Progress animation update
      setTimeout(() => {
        setGenerationProgress('Evaluating weather forecast & route feasibility...');
      }, 1000);

      setTimeout(() => {
        setGenerationProgress('Curating personalized day-by-day itinerary...');
      }, 2000);

      const res = await fetch(`/api/trips/${trip.id}/ai-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to generate itinerary plan.');
      }

      setGeneratedPlan(json.data);
      setStep('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating plan.');
      setStep('preferences');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async (mode: 'merge' | 'replace' = applyMode) => {
    if (!generatedPlan) return;
    setIsApplying(true);
    setError(null);

    try {
      const res = await fetch(`/api/trips/${trip.id}/ai-plan/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: generatedPlan,
          mode,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to apply plan to itinerary.');
      }

      onPlanApplied();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error applying plan.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-planner-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl my-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="ai-planner-modal-title"
                className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50"
              >
                AI Travel Planner
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Personalized day-wise itinerary for {trip.destinationName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: PREFERENCES */}
          {step === 'preferences' && (
            <div className="space-y-6" data-testid="ai-planner-preferences-step">
              {/* Travel Style */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block">
                  Select Travel Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {TRAVEL_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setTravelStyle(style.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        travelStyle === style.id
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-sm ring-1 ring-blue-500'
                          : 'border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm block">
                        {style.label}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5 line-clamp-2">
                        {style.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block">
                  Interests & Highlights
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((tag) => {
                    const isSelected = selectedInterests.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleInterest(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Budget & Travelers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Target Budget (Optional, {trip.currency || 'INR'})</span>
                  </label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 25000"
                    min="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Number of Travelers</span>
                  </label>
                  <input
                    type="number"
                    value={travelers}
                    onChange={(e) => setTravelers(parseInt(e.target.value, 10) || 1)}
                    min="1"
                    max="30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Special Pace Instructions */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Specific Preferences or Pace Notes</span>
                </label>
                <textarea
                  rows={2}
                  value={paceNotes}
                  onChange={(e) => setPaceNotes(e.target.value)}
                  placeholder="e.g. Avoid early morning starts, prioritize vegetarian food, focus on scenic sunset points..."
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING */}
          {step === 'generating' && (
            <div className="py-6" data-testid="ai-planner-generating-step">
              <AiGenerationLoader
                title={`Planning Your Trip to ${trip.destinationName || 'Paradise'}`}
                subtitle="Our smart wander engine is analyzing weather, routes, and points of interest..."
                currentProgress={generationProgress}
                stages={[
                  'Analyzing destination vibe & climate forecast...',
                  'Mapping optimal route timings & transport...',
                  'Curating personalized sights, cafes & local gems...',
                  'Balancing morning, afternoon & evening activities...',
                  'Finalizing your customized smart itinerary...',
                ]}
              />
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && generatedPlan && (
            <PlanPreview
              plan={generatedPlan}
              tripId={trip.id}
              onApplyPlan={handleApply}
              isApplying={isApplying}
              mode={applyMode}
              onModeChange={setApplyMode}
            />
          )}
        </div>

        {/* Footer Actions */}
        {step === 'preferences' && (
          <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="generate-plan-submit-btn"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Travel Plan</span>
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setStep('preferences')}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Adjust Preferences
            </button>

            <button
              type="button"
              onClick={() => handleApply(applyMode)}
              disabled={isApplying}
              data-testid="sticky-apply-ai-plan-btn"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Applying to Itinerary...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply Plan ({applyMode === 'merge' ? 'Merge' : 'Replace'})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
