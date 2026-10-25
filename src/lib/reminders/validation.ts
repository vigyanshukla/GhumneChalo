import { z } from 'zod';
import { ReminderStatus, ReminderType } from '@prisma/client';

export const createReminderSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(150, 'Title cannot exceed 150 characters')
    .transform((val) => val.trim()),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message cannot exceed 1000 characters')
    .transform((val) => val.trim()),
  scheduledAt: z.union([z.string(), z.date()]).transform((val) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      throw new Error('Invalid scheduledAt date');
    }
    return d;
  }),
  type: z.nativeEnum(ReminderType).optional().default(ReminderType.CUSTOM),
  tripId: z.string().optional(),
  itineraryItemId: z.string().optional(),
  itineraryDayId: z.string().optional(),
  transportationId: z.string().optional(),
  metadata: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  idempotencyKey: z.string().max(255).optional(),
});

export const updateReminderSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(150, 'Title cannot exceed 150 characters')
    .transform((val) => val.trim())
    .optional(),
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters')
    .transform((val) => val.trim())
    .optional(),
  scheduledAt: z
    .union([z.string(), z.date()])
    .transform((val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        throw new Error('Invalid scheduledAt date');
      }
      return d;
    })
    .optional(),
  status: z.nativeEnum(ReminderStatus).optional(),
  metadata: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
});

export const listRemindersSchema = z.object({
  tripId: z.string().optional(),
  status: z.nativeEnum(ReminderStatus).optional(),
  type: z.nativeEnum(ReminderType).optional(),
  upcoming: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (v === 'true' || v === true)),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
