import React from 'react';
import type { Metadata } from 'next';
import { AppNav } from '@/components/navigation/AppNav';
import { AchievementsDashboard } from '@/components/achievements/AchievementsDashboard';

export const metadata: Metadata = {
  title: 'Achievements & Milestones',
  description: 'Track your travel milestones, badges, and unlock wanderlust rewards.',
};

export default function AchievementsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Shared Authenticated App Navigation */}
      <AppNav />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <AchievementsDashboard />
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <p>GhumneChalo Gamification Engine — Travel More, Discover More, Earn Badges</p>
      </footer>
    </div>
  );
}
