import { z } from 'zod';
import { NotificationType } from '@prisma/client';

const validNotificationTypes = [
  'TRIP_REMINDER',
  'ITINERARY_REMINDER',
  'WEATHER_ALERT',
  'BUDGET_ALERT',
  'SYSTEM',
  'TRANSPORT_REMINDER',
  'ACHIEVEMENT_UNLOCKED',
  'SECURITY_ALERT',
  'TRIP_UPCOMING',
  'ITINERARY_UPCOMING',
  'TRANSPORT_DEPARTURE',
  'TRANSPORT_ARRIVAL',
] as const;

export const safeUrlSchema = z
  .string()
  .max(1000)
  .refine(
    (url) => {
      if (!url) return true;
      const trimmed = url.trim();
      // Relative application routes are safe
      if (trimmed.startsWith('/')) {
        // Disallow protocol-relative //evil.com or javascript:
        return !trimmed.startsWith('//') && !trimmed.toLowerCase().startsWith('/\\');
      }
      try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Invalid or unsafe action URL' }
  );

export function sanitizeMetadata(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const sanitized: Record<string, unknown> = {};
  const forbiddenKeys = new Set([
    '__proto__',
    'constructor',
    'prototype',
    'password',
    'passwordHash',
    'secret',
    'token',
    'sessionToken',
    'privateKey',
  ]);

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (forbiddenKeys.has(key)) continue;
    // Allow primitives and simple objects/arrays
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 50).filter(
        (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      );
    } else if (typeof value === 'object') {
      // One level shallow copy of safe sub-object
      const subObj: Record<string, unknown> = {};
      for (const [subK, subV] of Object.entries(value as Record<string, unknown>)) {
        if (!forbiddenKeys.has(subK) && (typeof subV === 'string' || typeof subV === 'number' || typeof subV === 'boolean')) {
          subObj[subK] = subV;
        }
      }
      sanitized[key] = subObj;
    }
  }

  return sanitized;
}

export const createNotificationSchema = z.object({
  type: z.enum(validNotificationTypes as unknown as [NotificationType, ...NotificationType[]]),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  body: z.string().trim().min(1, 'Body is required').max(2000, 'Body cannot exceed 2000 characters'),
  actionUrl: safeUrlSchema.optional().nullable(),
  idempotencyKey: z.string().trim().max(255).optional().nullable(),
  expiresAt: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  data: z.unknown().optional().nullable(),
});

export const updatePreferencesSchema = z.object({
  tripReminders: z.boolean().optional(),
  itineraryReminders: z.boolean().optional(),
  transportationReminders: z.boolean().optional(),
  weatherAlerts: z.boolean().optional(),
  budgetAlerts: z.boolean().optional(),
  achievementAlerts: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
});

export const notificationQuerySchema = z.object({
  unread: z.string().optional().transform((val) => val === 'true'),
  type: z.enum(validNotificationTypes as unknown as [NotificationType, ...NotificationType[]]).optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20)),
});
