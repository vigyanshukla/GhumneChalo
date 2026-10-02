'use client';

import { useSyncExternalStore, useState } from 'react';

export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING';

function subscribeToOnlineStatus(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

/**
 * Hook to detect online / offline state reactively with zero hydration mismatch.
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  status: NetworkStatus;
  setStatus: (status: NetworkStatus) => void;
} {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );

  const [overrideStatus, setOverrideStatus] = useState<NetworkStatus | null>(null);

  // Derived status without calling setState inside an effect
  const status: NetworkStatus = overrideStatus ?? (isOnline ? 'ONLINE' : 'OFFLINE');

  return { isOnline, status, setStatus: setOverrideStatus };
}
