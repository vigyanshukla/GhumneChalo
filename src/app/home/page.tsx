import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOptionalAuthenticatedUser } from '@/lib/auth-server';
import { HomeDashboard } from '@/components/home/HomeDashboard';

export const metadata: Metadata = {
  title: 'Home Dashboard | GhumneChalo - Smart Wander Platform',
  description:
    'Your personalized travel command center. View upcoming trips, track itineraries, inspect travel reminders, and monitor wanderlust milestones.',
};

export default async function HomePage() {
  const user = await getOptionalAuthenticatedUser();

  if (!user) {
    redirect('/login?callbackUrl=/home');
  }

  return <HomeDashboard initialUser={user} />;
}
