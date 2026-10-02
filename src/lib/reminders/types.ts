import { ReminderStatus, ReminderType } from '@prisma/client';

export interface ReminderItem {
  id: string;
  userId: string;
  tripId: string | null;
  itineraryItemId: string | null;
  itineraryDayId: string | null;
  transportationId: string | null;
  type: ReminderType;
  title: string;
  message: string;
  scheduledAt: Date;
  status: ReminderStatus;
  deliveryState: string | null;
  sentAt: Date | null;
  failedReason: string | null;
  metadata: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  trip?: {
    id: string;
    title: string;
    destinationName: string;
  } | null;
}

export interface CreateReminderInput {
  title: string;
  message: string;
  scheduledAt: Date | string;
  type?: ReminderType;
  tripId?: string;
  itineraryItemId?: string;
  itineraryDayId?: string;
  transportationId?: string;
  metadata?: Record<string, unknown> | string;
  idempotencyKey?: string;
}

export interface UpdateReminderInput {
  title?: string;
  message?: string;
  scheduledAt?: Date | string;
  status?: ReminderStatus;
  metadata?: Record<string, unknown> | string;
}

export interface ListRemindersQuery {
  tripId?: string;
  status?: ReminderStatus;
  type?: ReminderType;
  upcoming?: boolean;
  limit?: number;
  offset?: number;
}
