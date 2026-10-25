'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bell,
  Calendar,
  MapPin,
  Plane,
  CloudSun,
  Wallet,
  Trophy,
  ShieldAlert,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { NotificationItem, NotificationType } from '@/lib/notifications/types';

interface NotificationItemViewProps {
  notification: NotificationItem;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'TRIP_REMINDER':
    case 'TRIP_UPCOMING':
      return <Calendar className="w-4 h-4 text-blue-500" />;
    case 'ITINERARY_REMINDER':
    case 'ITINERARY_UPCOMING':
      return <MapPin className="w-4 h-4 text-emerald-500" />;
    case 'TRANSPORT_REMINDER':
    case 'TRANSPORT_DEPARTURE':
    case 'TRANSPORT_ARRIVAL':
      return <Plane className="w-4 h-4 text-purple-500" />;
    case 'WEATHER_ALERT':
      return <CloudSun className="w-4 h-4 text-amber-500" />;
    case 'BUDGET_ALERT':
      return <Wallet className="w-4 h-4 text-orange-500" />;
    case 'ACHIEVEMENT_UNLOCKED':
      return <Trophy className="w-4 h-4 text-yellow-500" />;
    case 'SECURITY_ALERT':
      return <ShieldAlert className="w-4 h-4 text-rose-500" />;
    default:
      return <Bell className="w-4 h-4 text-zinc-500" />;
  }
}

export function formatTimeAgo(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationItemView({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemViewProps) {
  const isUnread = !notification.readAt;

  return (
    <div
      data-testid={`notification-item-${notification.id}`}
      className={`group relative flex items-start gap-3 p-3.5 sm:p-4 rounded-xl transition-all border ${
        isUnread
          ? 'bg-blue-50/50 border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-800/50'
          : 'bg-white border-zinc-200/70 dark:bg-zinc-900/60 dark:border-zinc-800'
      }`}
    >
      {/* Icon badge */}
      <div
        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
          isUnread
            ? 'bg-white dark:bg-zinc-800 shadow-sm'
            : 'bg-zinc-100 dark:bg-zinc-800/80'
        }`}
      >
        {getNotificationIcon(notification.type)}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4
            className={`text-sm truncate ${
              isUnread
                ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                : 'font-medium text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {notification.title}
          </h4>
          <span className="text-xs text-zinc-400 shrink-0">
            {formatTimeAgo(notification.createdAt)}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
          {notification.body}
        </p>

        {/* Action destination if present */}
        {notification.actionUrl && (
          <div className="mt-2.5">
            <Link
              href={notification.actionUrl}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-1"
            >
              <span>View Details</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 self-center">
        {isUnread && onMarkAsRead && (
          <button
            type="button"
            onClick={() => onMarkAsRead(notification.id)}
            title="Mark as read"
            aria-label="Mark as read"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(notification.id)}
            title="Delete notification"
            aria-label="Delete notification"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Unread indicator dot */}
      {isUnread && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-900"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
