'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { TripSummary } from './types';

interface DeleteTripModalProps {
  trip: TripSummary | null;
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function DeleteTripModal({
  trip,
  isOpen,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteTripModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !trip) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-trip-title"
      aria-describedby="delete-trip-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 transition-all"
      >
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3
              id="delete-trip-title"
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Delete Trip
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p id="delete-trip-desc" className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
          Are you sure you want to permanently delete{' '}
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
            &ldquo;{trip.title}&rdquo;
          </strong>{' '}
          to <span className="font-medium text-zinc-800 dark:text-zinc-200">{trip.destinationName}</span>?
          All associated plans and saved details will be removed.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Trip</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
