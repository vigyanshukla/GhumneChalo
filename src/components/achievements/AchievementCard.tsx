'use client';

import React from 'react';
import {
  Compass,
  MapPin,
  Utensils,
  TreePine,
  Briefcase,
  Wallet,
  CalendarCheck,
  Luggage,
  Plane,
  Lock,
  CheckCircle2,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { UserAchievement } from '@/lib/achievements/types';

interface AchievementCardProps {
  achievement: UserAchievement;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Compass,
  MapPin,
  Utensils,
  TreePine,
  Briefcase,
  Wallet,
  CalendarCheck,
  Luggage,
  Plane,
  Trophy,
};

const RARITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  COMMON: {
    bg: 'bg-slate-100 dark:bg-zinc-800',
    text: 'text-slate-700 dark:text-zinc-300',
    border: 'border-slate-200 dark:border-zinc-700',
    label: 'Common (10 pts)',
  },
  UNCOMMON: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Uncommon (25 pts)',
  },
  RARE: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Rare (50 pts)',
  },
  LEGENDARY: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    label: 'Legendary (100 pts)',
  },
};

export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement }) => {
  const IconComponent = ICON_MAP[achievement.icon] || Trophy;
  const rarityStyle = RARITY_STYLES[achievement.rarity] || RARITY_STYLES.COMMON;
  const isUnlocked = achievement.isUnlocked;

  const formattedDate = achievement.earnedAt
    ? new Date(achievement.earnedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      data-testid={`achievement-card-${achievement.type}`}
      className={`relative flex flex-col justify-between rounded-2xl p-5 border transition-all duration-200 ${
        isUnlocked
          ? 'bg-gradient-to-br from-white via-amber-50/20 to-emerald-50/20 dark:from-zinc-900 dark:via-zinc-900 dark:to-emerald-950/20 border-amber-300/80 dark:border-amber-500/30 shadow-md shadow-amber-500/5 hover:border-amber-400 dark:hover:border-amber-400/60'
          : 'bg-white/80 dark:bg-zinc-900/90 border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 opacity-90'
      }`}
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <span
            className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${rarityStyle.bg} ${rarityStyle.text} ${rarityStyle.border}`}
          >
            {rarityStyle.label}
          </span>

          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Unlocked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
              <Lock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
              Locked
            </span>
          )}
        </div>

        {/* Icon & Title Row */}
        <div className="flex items-start gap-3.5 mb-2.5">
          <div
            className={`relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border transition-transform ${
              isUnlocked
                ? 'bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-950 border-amber-300 shadow-sm'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700'
            }`}
          >
            <IconComponent className="w-6 h-6" />
            {isUnlocked && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-white">
                <Sparkles className="w-2 h-2" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className={`text-base font-bold truncate ${
                isUnlocked ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300'
              }`}
            >
              {achievement.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Category: <span className="capitalize">{achievement.category.toLowerCase()}</span>
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 mb-4 leading-relaxed">
          {achievement.description}
        </p>
      </div>

      {/* Progress & Earned Section */}
      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-500 dark:text-zinc-400">
            Progress: {achievement.currentValue} / {achievement.targetValue} {achievement.unit}
          </span>
          <span
            className={`font-semibold ${
              isUnlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-zinc-300'
            }`}
          >
            {achievement.progress}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isUnlocked
                ? 'bg-gradient-to-r from-amber-400 to-emerald-500'
                : 'bg-slate-400 dark:bg-zinc-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, achievement.progress))}%` }}
          />
        </div>

        {/* Earned Date or Hint */}
        <div className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500 flex items-center justify-between">
          {isUnlocked && formattedDate ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              Earned on {formattedDate}
            </span>
          ) : (
            <span>Complete requirements to unlock</span>
          )}
        </div>
      </div>
    </div>
  );
};
