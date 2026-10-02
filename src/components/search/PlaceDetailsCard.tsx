'use client';

import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Star,
  X,
  Phone,
  Globe,
  Clock,
  Navigation,
  Navigation2,
  Loader2,
} from 'lucide-react';
import { NormalizedPlace, NormalizedPlaceDetails } from './types';

export interface PlaceDetailsCardProps {
  place: NormalizedPlace | null;
  onClose: () => void;
  onCenterMap?: (coords: { lat: number; lng: number }) => void;
  onGetDirections?: (destination: NormalizedPlace) => void;
  className?: string;
}

function formatCategory(type?: string): string {
  if (!type) return '';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PlaceDetailsCard({
  place,
  onClose,
  onCenterMap,
  onGetDirections,
  className = '',
}: PlaceDetailsCardProps) {
  const [details, setDetails] = useState<NormalizedPlaceDetails | null>(null);
  const [loadedPlaceId, setLoadedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!place?.placeId) {
      return;
    }

    let isMounted = true;

    fetch(`/api/places/${encodeURIComponent(place.placeId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load place details');
        return res.json();
      })
      .then((json) => {
        if (isMounted && json.success && json.data) {
          setDetails(json.data);
        }
      })
      .catch((err) => {
        console.warn('[PlaceDetailsCard] Error fetching details:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadedPlaceId(place.placeId);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [place?.placeId]);

  if (!place) return null;

  const isLoadingDetails = Boolean(place.placeId && loadedPlaceId !== place.placeId && !details);

  const activeDetails = details && details.placeId === place.placeId ? details : null;
  const currentDetails = activeDetails || place;
  const category = formatCategory(
    currentDetails.primaryType || currentDetails.types?.[0]
  );

  return (
    <div
      role="dialog"
      aria-label={`Place details for ${place.name}`}
      className={`fixed sm:absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 dark:border-zinc-800 p-4 z-20 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 shadow-sm">
            <MapPin className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {currentDetails.name}
            </h2>
            {category && (
              <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-md">
                {category}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Close place details"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body Details */}
      <div className="py-3 space-y-2.5 text-xs text-slate-600 dark:text-zinc-300">
        {/* Address */}
        {currentDetails.formattedAddress && (
          <p className="line-clamp-2 leading-relaxed text-slate-500 dark:text-zinc-400">
            {currentDetails.formattedAddress}
          </p>
        )}

        {/* Rating & Status */}
        <div className="flex items-center flex-wrap gap-3 pt-1">
          {typeof currentDetails.rating === 'number' && (
            <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{currentDetails.rating.toFixed(1)}</span>
              {currentDetails.userRatingCount && (
                <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                  ({currentDetails.userRatingCount})
                </span>
              )}
            </div>
          )}

          {/* Open / Closed Status */}
          {details?.openNow !== undefined && (
            <div className="flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span
                className={
                  details.openNow
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-red-500 dark:text-red-400 font-semibold'
                }
              >
                {details.openNow ? 'Open Now' : 'Closed'}
              </span>
            </div>
          )}

          {isLoadingDetails && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Fetching details...</span>
            </div>
          )}
        </div>

        {/* Contact & Web Info */}
        <div className="flex flex-wrap gap-3 pt-1 text-slate-500 dark:text-zinc-400">
          {details?.nationalPhoneNumber && (
            <a
              href={`tel:${details.nationalPhoneNumber}`}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{details.nationalPhoneNumber}</span>
            </a>
          )}

          {details?.websiteUri && (
            <a
              href={details.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Website</span>
            </a>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
          {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {onCenterMap && (
            <button
              type="button"
              onClick={() => onCenterMap({ lat: place.latitude, lng: place.longitude })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Center on map"
            >
              <Navigation2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Center</span>
            </button>
          )}

          {onGetDirections && (
            <button
              type="button"
              onClick={() => onGetDirections(place)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Get directions to ${place.name}`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Directions</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
