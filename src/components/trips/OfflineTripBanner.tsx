'use client';

import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { NetworkStatus } from '@/lib/offline/use-network-status';

interface OfflineTripBannerProps {
  status: NetworkStatus;
  isCached: boolean;
  cachedAt?: number;
  onRefresh?: () => void;
}

export function OfflineTripBanner({
  status,
  isCached,
  cachedAt,
  onRefresh,
}: OfflineTripBannerProps) {
  if (status === 'ONLINE' && !isCached) {
    return null;
  }

  if (status === 'OFFLINE') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Offline Mode:</strong> Viewing cached trip snapshot
            {cachedAt ? ' (saved locally)' : ''}. Live edits will be enabled when connection returns.
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Connection</span>
          </button>
        )}
      </div>
    );
  }

  if (status === 'SYNCING') {
    return (
      <div
        role="status"
        className="w-full bg-blue-500/10 border-b border-blue-500/30 px-4 py-2 text-blue-200 text-xs flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
          <span>Syncing trip details with cloud...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="w-full bg-emerald-500/5 border-b border-emerald-500/20 px-4 py-1.5 text-emerald-300 text-xs flex items-center justify-between"
    >
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Available offline • Cached for resilient travel</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-emerald-400/80">
        <Wifi className="w-3 h-3" />
        <span>Online</span>
      </div>
    </div>
  );
}
