'use client';

import React from 'react';
import {
  Shield,
  Hospital,
  Pill,
  Navigation,
  Phone,
  PhoneOff,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import type { EmergencyPlace, EmergencyCategory } from '@/lib/emergency/types';

interface EmergencyPlaceCardProps {
  place: EmergencyPlace;
}

const CATEGORY_ICONS: Record<EmergencyCategory, typeof Shield> = {
  police: Shield,
  hospital: Hospital,
  pharmacy: Pill,
};

const CATEGORY_COLORS: Record<
  EmergencyCategory,
  { bg: string; text: string; border: string; badgeBg: string }
> = {
  police: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
  },
  hospital: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60',
  },
  pharmacy: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
  },
};

export function EmergencyPlaceCard({ place }: EmergencyPlaceCardProps) {
  const Icon = CATEGORY_ICONS[place.category] || Shield;
  const colors = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.police;

  return (
    <div
      className={`rounded-2xl border p-5 transition-shadow hover:shadow-md bg-white dark:bg-zinc-900 ${colors.border}`}
      data-testid="emergency-place-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors.badgeBg} ${colors.text}`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${colors.badgeBg} ${colors.text}`}
              >
                {place.category}
              </span>
              <span className="inline-flex items-center text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                📍 {place.distanceFormatted}
              </span>
              {place.openNow !== null && place.openNow !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    place.openNow
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {place.openNow ? 'Open Now' : 'Closed'}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
              {place.name}
            </h3>
          </div>
        </div>
      </div>

      {place.formattedAddress && (
        <div className="mt-3 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
          <p className="line-clamp-2">{place.formattedAddress}</p>
        </div>
      )}

      {/* Action Buttons: Directions & Call */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-3">
        {/* Directions Button (touch target >= 44px) */}
        <a
          href={place.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
          data-testid="emergency-directions-btn"
        >
          <Navigation className="h-4 w-4" />
          <span>Get Directions</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>

        {/* Call Button (touch target >= 44px) */}
        {place.phoneNumber ? (
          <a
            href={`tel:${place.phoneNumber.replace(/\s+/g, '')}`}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            data-testid="emergency-call-btn"
          >
            <Phone className="h-4 w-4" />
            <span>Call {place.phoneNumber}</span>
          </a>
        ) : (
          <div
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
            data-testid="emergency-call-unavailable"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>Phone not listed</span>
          </div>
        )}
      </div>
    </div>
  );
}
