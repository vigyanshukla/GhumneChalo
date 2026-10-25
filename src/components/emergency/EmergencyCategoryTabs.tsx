'use client';

import React from 'react';
import { Shield, Hospital, Pill, PhoneCall } from 'lucide-react';
import type { EmergencyCategory } from '@/lib/emergency/types';

export type TabType = EmergencyCategory | 'helplines';

interface EmergencyCategoryTabsProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  policeCount?: number;
  hospitalCount?: number;
  pharmacyCount?: number;
}

export function EmergencyCategoryTabs({
  activeTab,
  onChangeTab,
  policeCount,
  hospitalCount,
  pharmacyCount,
}: EmergencyCategoryTabsProps) {
  const tabs: Array<{
    id: TabType;
    label: string;
    icon: typeof Shield;
    badge?: number;
    color: string;
  }> = [
    {
      id: 'police',
      label: 'Police',
      icon: Shield,
      badge: policeCount,
      color: 'text-blue-600',
    },
    {
      id: 'hospital',
      label: 'Hospitals',
      icon: Hospital,
      badge: hospitalCount,
      color: 'text-rose-600',
    },
    {
      id: 'pharmacy',
      label: 'Pharmacies',
      icon: Pill,
      badge: pharmacyCount,
      color: 'text-emerald-600',
    },
    {
      id: 'helplines',
      label: 'Helplines',
      icon: PhoneCall,
      color: 'text-amber-600',
    },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
      role="tablist"
      aria-label="Emergency Categories"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            id={`tab-${tab.id}`}
            onClick={() => onChangeTab(tab.id)}
            className={`min-h-[52px] sm:min-h-[60px] px-3 sm:px-4 py-3 rounded-2xl flex items-center justify-center gap-2 sm:gap-2.5 font-bold text-sm sm:text-base border-2 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 ${
              isActive
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-md dark:bg-white dark:text-zinc-950 dark:border-white'
                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800/80'
            }`}
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${
                isActive ? 'text-rose-400 dark:text-rose-600' : tab.color
              }`}
            />
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
