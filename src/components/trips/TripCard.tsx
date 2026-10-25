'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, IndianRupee, ArrowRight, Trash2, Edit } from 'lucide-react';
import { TripSummary, TripStatus } from './types';

interface TripCardProps {
  trip: TripSummary;
  onEdit?: (trip: TripSummary) => void;
  onDelete?: (trip: TripSummary) => void;
}

const STATUS_CONFIG: Record<TripStatus, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: {
    label: 'Planning',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
  UPCOMING: {
    label: 'Upcoming',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  ACTIVE: {
    label: 'Active',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-rose-50 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
  },
};

export function TripCard({ trip, onEdit, onDelete }: TripCardProps) {
  const statusInfo = STATUS_CONFIG[trip.status] || STATUS_CONFIG.DRAFT;

  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  const formatShortDate = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });

  // Calculate days
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  return (
    <div
      data-testid={`trip-card-${trip.id}`}
      className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div>
        {/* Header with status badge and actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
          >
            {statusInfo.label}
          </span>

          <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(trip);
                }}
                title="Edit trip"
                aria-label={`Edit ${trip.title}`}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(trip);
                }}
                title="Delete trip"
                aria-label={`Delete ${trip.title}`}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <Link
          href={`/trips/${trip.id}`}
          className="block font-semibold text-lg text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400 transition-colors line-clamp-1"
        >
          {trip.title}
        </Link>

        {/* Destination */}
        <div className="mt-2 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1">
          <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
          <span>{trip.destinationName}</span>
        </div>

        {/* Dates & Duration */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>
              {formatShortDate(startDate)} – {formatShortDate(endDate)}
            </span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {diffDays} {diffDays === 1 ? 'day' : 'days'}
          </span>
        </div>

        {/* Budget if present */}
        {trip.totalBudget ? (
          <div className="mt-2.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <IndianRupee className="w-3.5 h-3.5" />
            <span>
              Budget: {trip.currency || 'INR'} {trip.totalBudget.toLocaleString('en-IN')}
            </span>
          </div>
        ) : null}
      </div>

      {/* Footer CTA */}
      <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          Updated {new Date(trip.updatedAt).toLocaleDateString()}
        </span>
        <Link
          href={`/trips/${trip.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
