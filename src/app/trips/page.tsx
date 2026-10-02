import React from 'react';
import type { Metadata } from 'next';
import { TripsDashboard } from '@/components/trips/TripsDashboard';

export const metadata: Metadata = {
  title: 'My Trips',
  description: 'Plan, organize, and manage your travel journeys in one place.',
};

export default function TripsPage() {
  return <TripsDashboard />;
}
