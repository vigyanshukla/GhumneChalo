'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TripForm } from '@/components/trips/TripForm';
import { TripFormData } from '@/components/trips/types';
import { CACHE_KEYS, removeStoredItem } from '@/lib/cache/client-cache';
import { saveTripOfflineSnapshot, updateTripOfflineSnapshotSection } from '@/lib/offline/offline-storage';

export function NewTripForm() {
  const router = useRouter();

  const handleCreateTrip = async (formData: TripFormData) => {
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || 'Failed to create trip. Please try again.');
    }

    // Invalidate cached trips so dashboard loads updated list
    removeStoredItem(CACHE_KEYS.TRIPS);

    const createdTrip = json.data;
    const createdTripId = createdTrip.id;

    // Immediately persist initial offline snapshot to IndexedDB
    saveTripOfflineSnapshot({
      tripId: createdTripId,
      userId: createdTrip.userId || 'default',
      cachedAt: Date.now(),
      version: 2,
      trip: createdTrip,
    }).catch(() => {});

    // Pre-fetch weather in background and cache into offline snapshot
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch(`/api/trips/${createdTripId}/weather`)
        .then((wRes) => wRes.json())
        .then((wJson) => {
          if (wJson.success && wJson.data) {
            updateTripOfflineSnapshotSection(
              createdTripId,
              'weather',
              wJson.data,
              createdTrip.userId
            ).catch(() => {});
          }
        })
        .catch(() => {});
    }

    router.push(`/trips/${createdTripId}`);
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <TripForm
        onSubmit={handleCreateTrip}
        onCancel={() => router.push('/trips')}
        submitLabel="Create Trip"
      />
    </div>
  );
}
