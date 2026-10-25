'use client';

import React from 'react';
import { Trophy, Award, Target, RefreshCw } from 'lucide-react';
import { AchievementProgressSummary as SummaryType } from '@/lib/achievements/types';

interface AchievementProgressSummaryProps {
  summary: SummaryType | null;
  statusFilter: 'ALL' | 'UNLOCKED' | 'LOCKED';
  setStatusFilter: (filter: 'ALL' | 'UNLOCKED' | 'LOCKED') => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'TRIPS', label: 'Trips' },
  { id: 'EXPLORATION', label: 'Exploration' },
  { id: 'CULINARY', label: 'Culinary' },
  { id: 'NATURE', label: 'Nature' },
  { id: 'FINANCE', label: 'Finance' },
  { id: 'PLANNING', label: 'Planning' },
  { id: 'PREPARATION', label: 'Preparation' },
  { id: 'TRANSIT', label: 'Transit' },
];

export const AchievementProgressSummary: React.FC<AchievementProgressSummaryProps> = ({
  summary,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  onRefresh,
  isRefreshing,
}) => {
  const completionRate = summary?.completionRate ?? 0;
  const unlockedCount = summary?.unlockedCount ?? 0;
  const total = summary?.total ?? 0;
  const earnedPoints = summary?.earnedPoints ?? 0;
  const totalPoints = summary?.totalPoints ?? 0;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/90 dark:border-zinc-800 mb-8 transition-colors">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center text-amber-500">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
              Travel Badges &amp; Milestones
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400">
              Celebrate your journey across India by unlocking travel achievements.
            </p>
          </div>
        </div>

        {/* Sync / Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Syncing...' : 'Sync Badges'}
        </button>
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        {/* Badges Unlocked */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Badges Unlocked</p>
            <p className="text-xl font-black text-slate-900 dark:text-zinc-100">
              {unlockedCount} <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500">/ {total}</span>
            </p>
          </div>
        </div>

        {/* Total Points */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Points</p>
            <p className="text-xl font-black text-slate-900 dark:text-zinc-100">
              {earnedPoints} <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500">/ {totalPoints}</span>
            </p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60 flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
            <Target className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Completion</p>
            <p className="text-xl font-black text-slate-900 dark:text-zinc-100">{completionRate}%</p>
          </div>
        </div>
      </div>

      {/* Global Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-2">
          <span>Overall Explorer Progress</span>
          <span>
            {unlockedCount} of {total} Milestones Achieved
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60 dark:border-zinc-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 mr-1 flex-shrink-0">Status:</span>
          {(['ALL', 'UNLOCKED', 'LOCKED'] as const).map((filter) => {
            const active = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                {filter === 'ALL'
                  ? `All (${total})`
                  : filter === 'UNLOCKED'
                  ? `Unlocked (${unlockedCount})`
                  : `Locked (${summary?.lockedCount ?? 0})`}
              </button>
            );
          })}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 mr-1 flex-shrink-0">Category:</span>
          {CATEGORIES.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700/80'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
