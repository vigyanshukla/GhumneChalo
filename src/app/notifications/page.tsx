import React from 'react';
import type { Metadata } from 'next';
import { NotificationsDashboard } from '@/components/notifications/NotificationsDashboard';

export const metadata: Metadata = {
  title: 'Travel Notifications',
  description: 'Stay informed on upcoming trips, itinerary events, flight departures, and weather advisories.',
};

export default function NotificationsPage() {
  return <NotificationsDashboard />;
}
