import React from 'react';
import type { Metadata } from 'next';
import { AppNav } from '@/components/navigation/AppNav';
import { ReminderManager } from '@/components/reminders/ReminderManager';

export const metadata: Metadata = {
  title: 'Travel Reminders',
  description: 'Stay on top of flight departures, itinerary activities, and custom travel alerts.',
};

export default function RemindersPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-x-hidden w-full">
      {/* Shared Authenticated Navigation Shell */}
      <AppNav />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 md:pb-12">
        <ReminderManager />
      </main>
    </div>
  );
}
