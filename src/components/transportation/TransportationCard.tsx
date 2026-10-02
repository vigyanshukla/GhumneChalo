'use client';

import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  ArrowRight,
  MapPin,
  Tag,
  IndianRupee,
  Navigation,
  Edit2,
  Trash2,
  FileText,
} from 'lucide-react';
import { TransportationData, TRANSPORTATION_TYPE_CONFIG } from './types';

interface TransportationCardProps {
  item: TransportationData;
  onEdit: () => void;
  onDelete: () => void;
}

export function TransportationCard({
  item,
  onEdit,
  onDelete,
}: TransportationCardProps) {
  const config =
    TRANSPORTATION_TYPE_CONFIG[item.type] || TRANSPORTATION_TYPE_CONFIG.OTHER;
  const Icon = config.icon;

  const departureDate = item.departureTime ? new Date(item.departureTime) : null;
  const arrivalDate = item.arrivalTime ? new Date(item.arrivalTime) : null;

  const formatDateTime = (d: Date | null) => {
    if (!d || isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Build directions URL if coordinates or place names exist
  const hasCoords =
    item.originCoordinates && item.destinationCoordinates;

  const directionsUrl = hasCoords
    ? `/explore?originLat=${item.originCoordinates?.lat}&originLng=${item.originCoordinates?.lng}&destLat=${item.destinationCoordinates?.lat}&destLng=${item.destinationCoordinates?.lng}&directions=true`
    : `/explore?q=${encodeURIComponent(item.destination)}`;

  return (
    <div
      id={`transportation-card-${item.id}`}
      className="p-5 sm:p-6 rounded-3xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all space-y-4"
    >
      {/* Top Header: Mode & Metadata Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.bgColor} ${config.color} ${config.borderColor}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{config.label}</span>
          </span>

          {/* Provider / Operator */}
          {item.provider && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700">
              {item.provider}
            </span>
          )}

          {/* Booking / PNR Reference */}
          {item.bookingReference && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-xs font-mono text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
              <Tag className="w-3 h-3 text-zinc-400" />
              <span>{item.bookingReference}</span>
            </span>
          )}

          {/* Associated Itinerary Day */}
          {item.itineraryDay && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
              <Calendar className="w-3 h-3 text-blue-500" />
              <span>Day {item.itineraryDay.dayNumber}</span>
            </span>
          )}
        </div>

        {/* Cost Badge */}
        {item.cost !== null && item.cost !== undefined && (
          <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-200/70 dark:border-emerald-800">
            <IndianRupee className="w-3.5 h-3.5" />
            <span>
              {item.currency || 'INR'} {item.cost.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>

      {/* Main Journey Section: Origin -> Destination */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center py-1">
        {/* Origin */}
        <div className="sm:col-span-2 space-y-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Origin
          </span>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {item.origin}
            </span>
          </div>
          {departureDate && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>{formatDateTime(departureDate)}</span>
            </div>
          )}
        </div>

        {/* Route Arrow / Metrics */}
        <div className="sm:col-span-1 flex flex-col items-center justify-center py-2 sm:py-0">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <div className="h-0.5 w-6 sm:w-8 bg-zinc-200 dark:bg-zinc-700" />
            <ArrowRight className="w-4 h-4 text-blue-500" />
            <div className="h-0.5 w-6 sm:w-8 bg-zinc-200 dark:bg-zinc-700" />
          </div>
          {(item.formattedDuration || item.formattedDistance) && (
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mt-1 text-center whitespace-nowrap">
              {item.formattedDuration && <span>{item.formattedDuration}</span>}
              {item.formattedDuration && item.formattedDistance && <span> • </span>}
              {item.formattedDistance && <span>{item.formattedDistance}</span>}
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="sm:col-span-2 space-y-1 sm:text-right">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Destination
          </span>
          <div className="flex items-center sm:justify-end gap-2">
            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {item.destination}
            </span>
          </div>
          {arrivalDate && (
            <div className="flex items-center sm:justify-end gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>{formatDateTime(arrivalDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* User Notes */}
      {item.notes && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
          <p className="whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}

      {/* Bottom Footer Actions */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        {/* Route Directions Entry Point */}
        <Link
          href={directionsUrl}
          id={`transportation-directions-${item.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>View Route & Directions</span>
        </Link>

        {/* Edit and Delete Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            id={`edit-transportation-${item.id}`}
            title="Edit journey details"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Edit</span>
          </button>
          <button
            onClick={onDelete}
            id={`delete-transportation-${item.id}`}
            title="Remove transportation"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
