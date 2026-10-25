'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { UserAchievement, AchievementProgressSummary as SummaryType } from '@/lib/achievements/types';
import {
  AchievementProgressSummary,
  AchievementGrid,
} from '@/components/achievements';

export function AchievementsDashboard() {
  const router = useRouter();
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [summary, setSummary] = useState<SummaryType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const [achievementsRes, summaryRes] = await Promise.all([
          fetch('/api/achievements'),
          fetch('/api/achievements/progress'),
        ]);

        if (achievementsRes.status === 401 || summaryRes.status === 401) {
          router.push('/login?from=/achievements');
          return;
        }

        if (!achievementsRes.ok) {
          throw new Error('Failed to load achievements list.');
        }

        const achievementsData = await achievementsRes.json();
        const summaryData = summaryRes.ok ? await summaryRes.json() : null;

        if (!ignore) {
          if (achievementsData.success && Array.isArray(achievementsData.data)) {
            setAchievements(achievementsData.data);
          }

          if (summaryData?.success && summaryData.data) {
            setSummary(summaryData.data);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'An error occurred while loading achievements.';
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [router, refreshKey]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await fetch('/api/achievements', { method: 'POST' });
    } catch {
      // Continue to refresh
    } finally {
      setRefreshKey((prev) => prev + 1);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-xs font-bold underline hover:no-underline text-rose-700 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Progress & Stats Summary */}
      <AchievementProgressSummary
        summary={summary}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        onRefresh={handleManualSync}
        isRefreshing={isRefreshing}
      />

      {/* Achievements Grid */}
      <AchievementGrid
        achievements={achievements}
        isLoading={isLoading}
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
      />
    </>
  );
}
