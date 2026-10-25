'use client';

import React from 'react';
import { UserAchievement } from '@/lib/achievements/types';
import { AchievementCard } from './AchievementCard';
import { Compass } from 'lucide-react';

interface AchievementGridProps {
  achievements: UserAchievement[];
  isLoading: boolean;
  statusFilter: 'ALL' | 'UNLOCKED' | 'LOCKED';
  categoryFilter: string;
}

export const AchievementGrid: React.FC<AchievementGridProps> = ({
  achievements,
  isLoading,
  statusFilter,
  categoryFilter,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse space-y-4 shadow-sm"
          >
            <div className="flex justify-between items-center">
              <div className="h-5 w-24 bg-slate-200 dark:bg-zinc-800 rounded-full" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-zinc-800 rounded-full" />
            </div>
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 dark:bg-zinc-800/60 rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-zinc-800/60 rounded" />
            <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full mt-4" />
          </div>
        ))}
      </div>
    );
  }

  const filtered = achievements.filter((a) => {
    if (statusFilter === 'UNLOCKED' && !a.isUnlocked) return false;
    if (statusFilter === 'LOCKED' && a.isUnlocked) return false;
    if (categoryFilter !== 'ALL' && a.category !== categoryFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-zinc-800 shadow-sm">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-500 mb-4">
          <Compass className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200 mb-1">
          No achievements match your filters
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
          Try selecting another category or view all milestones to track your explorer journey.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="achievements-grid"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {filtered.map((item) => (
        <AchievementCard key={item.type} achievement={item} />
      ))}
    </div>
  );
};
