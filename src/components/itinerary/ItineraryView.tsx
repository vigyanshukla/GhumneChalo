'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { TripSummary } from '@/components/trips/types';
import {
  ItineraryDayData,
  ItineraryItemData,
  ItineraryItemFormData,
} from './types';
import { DayTabs } from './DayTabs';
import { DayHeader } from './DayHeader';
import { ItineraryItemCard } from './ItineraryItemCard';
import dynamic from 'next/dynamic';
import { NormalizedTripWeather } from '@/lib/weather/types';

const AddActivityModal = dynamic(
  () => import('./AddActivityModal').then((m) => m.AddActivityModal),
  { ssr: false }
);

const EditDayModal = dynamic(
  () => import('./EditDayModal').then((m) => m.EditDayModal),
  { ssr: false }
);

const DeleteModal = dynamic(
  () => import('./DeleteModal').then((m) => m.DeleteModal),
  { ssr: false }
);

const AiPlannerModal = dynamic(
  () => import('@/components/ai-planner').then((m) => m.AiPlannerModal),
  { ssr: false }
);

interface ItineraryViewProps {
  trip: TripSummary;
}

export function ItineraryView({ trip }: ItineraryViewProps) {
  const [days, setDays] = useState<ItineraryDayData[]>([]);
  const [activeDayId, setActiveDayId] = useState<string>('');
  const [weather, setWeather] = useState<NormalizedTripWeather | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItemData | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItineraryItemData | null>(null);
  const [isDeletingItemLoading, setIsDeletingItemLoading] = useState(false);

  const [isEditDayOpen, setIsEditDayOpen] = useState(false);
  const [deletingDay, setDeletingDay] = useState<ItineraryDayData | null>(null);
  const [isDeletingDayLoading, setIsDeletingDayLoading] = useState(false);

  const [isAddingDay, setIsAddingDay] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isAiPlannerOpen, setIsAiPlannerOpen] = useState(false);

  // Fetch itinerary
  const loadItinerary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/itinerary`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to load itinerary.');
      }

      const loadedDays: ItineraryDayData[] = json.data || [];
      setDays(loadedDays);

      if (loadedDays.length > 0) {
        setActiveDayId((prev) => {
          const exists = loadedDays.some((d) => d.id === prev);
          return exists ? prev : loadedDays[0].id;
        });
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Network error loading itinerary.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [trip.id]);

  useEffect(() => {
    queueMicrotask(() => {
      loadItinerary();
    });
  }, [loadItinerary]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/trips/${trip.id}/weather`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!ignore && json?.success && json.data) {
          setWeather(json.data);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [trip.id]);

  const activeDay = days.find((d) => d.id === activeDayId) || days[0];

  // 1. Add Activity
  const handleCreateActivity = async (formData: ItineraryItemFormData) => {
    if (!activeDay) return;
    const res = await fetch(`/api/trips/${trip.id}/days/${activeDay.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to add activity.');
    }

    const newItem: ItineraryItemData = json.data;
    setDays((prev) =>
      prev.map((d) =>
        d.id === activeDay.id
          ? { ...d, items: [...d.items, newItem] }
          : d
      )
    );
  };

  // 2. Update Activity
  const handleUpdateActivity = async (formData: ItineraryItemFormData) => {
    if (!activeDay || !editingItem) return;
    const res = await fetch(
      `/api/trips/${trip.id}/days/${activeDay.id}/items/${editingItem.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }
    );

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to update activity.');
    }

    const updatedItem: ItineraryItemData = json.data;
    setDays((prev) =>
      prev.map((d) =>
        d.id === activeDay.id
          ? {
              ...d,
              items: d.items.map((it) => (it.id === updatedItem.id ? updatedItem : it)),
            }
          : d
      )
    );
  };

  // 3. Delete Activity
  const handleDeleteActivity = async () => {
    if (!activeDay || !deletingItem) return;
    setIsDeletingItemLoading(true);
    try {
      const res = await fetch(
        `/api/trips/${trip.id}/days/${activeDay.id}/items/${deletingItem.id}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to delete activity.');
      }

      setDays((prev) =>
        prev.map((d) =>
          d.id === activeDay.id
            ? { ...d, items: d.items.filter((it) => it.id !== deletingItem.id) }
            : d
        )
      );
      setDeletingItem(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete activity.');
    } finally {
      setIsDeletingItemLoading(false);
    }
  };

  // 4. Reorder Activity (Move Up / Down)
  const handleMoveActivity = async (index: number, direction: 'up' | 'down') => {
    if (!activeDay || isReordering) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeDay.items.length) return;

    const originalItems = [...activeDay.items];
    const newItems = [...activeDay.items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setDays((prev) =>
      prev.map((d) => (d.id === activeDay.id ? { ...d, items: newItems } : d))
    );

    setIsReordering(true);
    try {
      const res = await fetch(
        `/api/trips/${trip.id}/days/${activeDay.id}/items/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: newItems.map((it) => it.id) }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Rollback
        setDays((prev) =>
          prev.map((d) =>
            d.id === activeDay.id ? { ...d, items: originalItems } : d
          )
        );
        throw new Error(json?.error?.message || 'Failed to reorder items.');
      }
    } catch {
      // Rollback on network failure
      setDays((prev) =>
        prev.map((d) =>
          d.id === activeDay.id ? { ...d, items: originalItems } : d
        )
      );
    } finally {
      setIsReordering(false);
    }
  };

  // 5. Add Day
  const handleAddDay = async () => {
    setIsAddingDay(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to add day.');
      }

      const createdDay: ItineraryDayData = json.data;
      setDays((prev) => [...prev, createdDay]);
      setActiveDayId(createdDay.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add day.');
    } finally {
      setIsAddingDay(false);
    }
  };

  // 6. Edit Day Title / Date
  const handleUpdateDay = async (title: string, date: string) => {
    if (!activeDay) return;
    const res = await fetch(`/api/trips/${trip.id}/days/${activeDay.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date: new Date(date) }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to update day.');
    }

    const updatedDay: ItineraryDayData = json.data;
    setDays((prev) =>
      prev.map((d) => (d.id === updatedDay.id ? { ...d, ...updatedDay } : d))
    );
  };

  // 7. Delete Day
  const handleDeleteDay = async () => {
    if (!deletingDay) return;
    setIsDeletingDayLoading(true);
    try {
      const res = await fetch(
        `/api/trips/${trip.id}/days/${deletingDay.id}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to delete day.');
      }

      const remaining = days.filter((d) => d.id !== deletingDay.id);
      setDays(remaining);
      if (remaining.length > 0) {
        setActiveDayId(remaining[0].id);
      }
      setDeletingDay(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete day.');
    } finally {
      setIsDeletingDayLoading(false);
    }
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Day Tabs Skeleton */}
        <div className="flex gap-2 overflow-hidden py-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 w-32 rounded-xl bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>

        {/* Day Header Skeleton */}
        <div className="h-10 w-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />

        {/* Item Skeletons */}
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-rose-900 dark:text-rose-100">
          Failed to load itinerary
        </h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 max-w-sm mx-auto">
          {error}
        </p>
        <button
          onClick={loadItinerary}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Day Navigation Tabs */}
      {days.length > 0 && (
        <DayTabs
          days={days}
          activeDayId={activeDay?.id || ''}
          onSelectDay={setActiveDayId}
          onAddDay={handleAddDay}
          isAddingDay={isAddingDay}
        />
      )}

      {/* 2. Active Day Content */}
      {activeDay ? (
        <div className="space-y-6">
          {(() => {
            const activeDayDateStr = new Date(activeDay.date).toISOString().split('T')[0];
            const activeDayWeather = weather?.days.find((d) => d.date === activeDayDateStr);
            return (
              <DayHeader
                day={activeDay}
                totalDays={days.length}
                weatherDay={activeDayWeather}
                onAddActivity={() => {
                  setEditingItem(null);
                  setIsAddActivityOpen(true);
                }}
                onEditDay={() => setIsEditDayOpen(true)}
                onDeleteDay={() => setDeletingDay(activeDay)}
              />
            );
          })()}

          {/* Activities List */}
          {activeDay.items && activeDay.items.length > 0 ? (
            <div className="space-y-3">
              {activeDay.items.map((item, index) => (
                <ItineraryItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  totalItems={activeDay.items.length}
                  onMoveUp={() => handleMoveActivity(index, 'up')}
                  onMoveDown={() => handleMoveActivity(index, 'down')}
                  onEdit={() => {
                    setEditingItem(item);
                    setIsAddActivityOpen(true);
                  }}
                  onDelete={() => setDeletingItem(item)}
                  isReordering={isReordering}
                />
              ))}
            </div>
          ) : (
            /* Empty Day State (Requirement 15) */
            <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-8 sm:p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mx-auto flex items-center justify-center">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  No plans yet for Day {activeDay.dayNumber}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                  Start planning your day by adding tourist spots, local experiences, or dining reservations.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddActivityOpen(true);
                  }}
                  id="empty-day-add-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Activity</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAiPlannerOpen(true)}
                  id="itinerary-ai-plan-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 shadow-sm transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Generate with AI</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Zero Days State */
        <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-12 text-center space-y-4">
          <Calendar className="w-10 h-10 text-zinc-400 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            No days generated for this trip
          </h3>
          <button
            onClick={handleAddDay}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Day 1</span>
          </button>
        </div>
      )}

      {/* Add / Edit Activity Modal */}
      <AddActivityModal
        isOpen={isAddActivityOpen}
        onClose={() => {
          setIsAddActivityOpen(false);
          setEditingItem(null);
        }}
        onSubmit={editingItem ? handleUpdateActivity : handleCreateActivity}
        initialData={editingItem}
        dayNumber={activeDay?.dayNumber || 1}
      />

      {/* Edit Day Title/Date Modal */}
      {activeDay && (
        <EditDayModal
          isOpen={isEditDayOpen}
          onClose={() => setIsEditDayOpen(false)}
          day={activeDay}
          onSubmit={handleUpdateDay}
        />
      )}

      {/* Delete Activity Modal */}
      <DeleteModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDeleteActivity}
        title="Delete Activity?"
        description={`Are you sure you want to remove "${deletingItem?.name}" from Day ${activeDay?.dayNumber}? This action cannot be undone.`}
        confirmLabel="Delete Activity"
        isDeleting={isDeletingItemLoading}
      />

      {/* Delete Day Modal */}
      <DeleteModal
        isOpen={!!deletingDay}
        onClose={() => setDeletingDay(null)}
        onConfirm={handleDeleteDay}
        title={`Delete Day ${deletingDay?.dayNumber}?`}
        description={`Deleting this day will remove all ${deletingDay?.items?.length || 0} planned activities within it. Are you sure you want to proceed?`}
        confirmLabel="Delete Day"
        isDeleting={isDeletingDayLoading}
      />

      {/* AI Planner Modal */}
      <AiPlannerModal
        isOpen={isAiPlannerOpen}
        onClose={() => setIsAiPlannerOpen(false)}
        trip={trip}
        onPlanApplied={() => {
          loadItinerary();
        }}
      />
    </div>
  );
}
