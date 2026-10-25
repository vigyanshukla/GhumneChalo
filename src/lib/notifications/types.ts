import { NotificationType } from '@prisma/client';

export { NotificationType };

export interface NotificationMetadata {
  tripId?: string;
  destinationName?: string;
  activityId?: string;
  transportId?: string;
  achievementId?: string;
  badgeCode?: string;
  points?: number;
  budgetThreshold?: number;
  weatherSeverity?: 'INFO' | 'WARNING' | 'CRITICAL';
  scheduledWindow?: string;
  actionUrl?: string;
  [key: string]: unknown;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationMetadata | string | null;
  actionUrl?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: Date | string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: string | null;
  actionUrl: string | null;
  idempotencyKey: string | null;
  expiresAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  tripReminders: boolean;
  itineraryReminders: boolean;
  transportationReminders: boolean;
  weatherAlerts: boolean;
  budgetAlerts: boolean;
  achievementAlerts: boolean;
  securityAlerts: boolean;
  pushEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePreferencesInput {
  tripReminders?: boolean;
  itineraryReminders?: boolean;
  transportationReminders?: boolean;
  weatherAlerts?: boolean;
  budgetAlerts?: boolean;
  achievementAlerts?: boolean;
  securityAlerts?: boolean;
  pushEnabled?: boolean;
}

export interface NotificationQueryOptions {
  unreadOnly?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
}

export interface PaginatedNotifications {
  notifications: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}
