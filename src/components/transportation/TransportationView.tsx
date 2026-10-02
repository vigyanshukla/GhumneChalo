'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plane,
  Plus,
  AlertCircle,
  RefreshCw,
  IndianRupee,
} from 'lucide-react';
import { TripSummary } from '@/components/trips/types';
import {
  TransportationData,
  TransportationFormData,
} from './types';
import { TransportationCard } from './TransportationCard';
import { AddTransportationModal } from './AddTransportationModal';
import { DeleteTransportationModal } from './DeleteTransportationModal';

interface TransportationViewProps {
  trip: TripSummary;
}

export function TransportationView({ trip }: TransportationViewProps) {
  const [items, setItems] = useState<TransportationData[]>([]);
  const [itineraryDays, setItineraryDays] = useState<
    { id: string; dayNumber: number; date: string | Date; title?: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransportationData | null>(null);
  const [deletingItem, setDeletingItem] = useState<TransportationData | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  // Fetch transportation list & itinerary days for linking
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [transRes, itinRes] = await Promise.all([
        fetch(`/api/trips/${trip.id}/transportation`),
        fetch(`/api/trips/${trip.id}/itinerary`),
      ]);

      const transJson = await transRes.json();
      if (!transRes.ok || !transJson.success) {
        throw new Error(
          transJson?.error?.message || 'Failed to load transportation records.'
        );
      }
      setItems(transJson.data || []);

      if (itinRes.ok) {
        const itinJson = await itinRes.json();
        if (itinJson.success && Array.isArray(itinJson.data)) {
          setItineraryDays(
            itinJson.data.map((d: { id: string; dayNumber: number; date: string; title?: string | null }) => ({
              id: d.id,
              dayNumber: d.dayNumber,
              date: d.date,
              title: d.title,
            }))
          );
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Network error loading transportation data.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [trip.id]);

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, [loadData]);

  // Create Transportation
  const handleCreate = async (formData: TransportationFormData) => {
    const res = await fetch(`/api/trips/${trip.id}/transportation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to add transportation.');
    }

    setItems((prev) => [...prev, json.data]);
  };

  // Update Transportation
  const handleUpdate = async (formData: TransportationFormData) => {
    if (!editingItem) return;
    const res = await fetch(
      `/api/trips/${trip.id}/transportation/${editingItem.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }
    );

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to update transportation.');
    }

    setItems((prev) =>
      prev.map((item) => (item.id === editingItem.id ? json.data : item))
    );
  };

  // Delete Transportation
  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeletingLoading(true);
    try {
      const res = await fetch(
        `/api/trips/${trip.id}/transportation/${deletingItem.id}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to delete transportation.');
      }

      setItems((prev) => prev.filter((it) => it.id !== deletingItem.id));
      setDeletingItem(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete transportation.');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  // Metrics
  const totalCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 rounded-3xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30 p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-rose-900 dark:text-rose-100">
          Failed to load transportation
        </h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 max-w-sm mx-auto">
          {error}
        </p>
        <button
          onClick={loadData}
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
      {/* Header with Metrics and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-500" />
            <span>Transportation & Transit</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {items.length} {items.length === 1 ? 'journey logged' : 'journeys logged'}
            </span>
            {totalCost > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>
                    Total: {trip.currency || 'INR'} {totalCost.toLocaleString('en-IN')}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            id="add-transportation-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transportation</span>
          </button>
        </div>
      </div>

      {/* Transportation Cards List */}
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <TransportationCard
              key={item.id}
              item={item}
              onEdit={() => {
                setEditingItem(item);
                setIsAddModalOpen(true);
              }}
              onDelete={() => setDeletingItem(item)}
            />
          ))}
        </div>
      ) : (
        /* Empty State (Requirement 13) */
        <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mx-auto flex items-center justify-center">
            <Plane className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No transportation added yet
            </h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Add your flights, train tickets, bus rides, or rental car bookings to stay organized across your trip.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            id="empty-add-transportation-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Journey</span>
          </button>
        </div>
      )}

      {/* Add / Edit Transportation Modal */}
      <AddTransportationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={editingItem ? handleUpdate : handleCreate}
        initialData={editingItem}
        itineraryDays={itineraryDays}
        tripCurrency={trip.currency || 'INR'}
      />

      {/* Delete Transportation Modal */}
      <DeleteTransportationModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        origin={deletingItem?.origin || ''}
        destination={deletingItem?.destination || ''}
        isDeleting={isDeletingLoading}
      />
    </div>
  );
}
