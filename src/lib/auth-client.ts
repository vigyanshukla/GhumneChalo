import { clearAllOfflineStorage } from '@/lib/offline/offline-storage';
import { clearMemoryTabCache } from '@/lib/cache/client-cache';

/**
 * Robust, universal logout function for all client components:
 * 1. Calls /api/auth/logout with credentials to clear server sessions & cookies
 * 2. Purges all localStorage, sessionStorage, IndexedDB, and CacheStorage
 * 3. Clears all accessible document.cookie entries
 * 4. Hard navigates to /login?logged_out=1 (bypasses Next.js router cache)
 */
export async function performLogout(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Call server logout endpoint with credentials
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn('[Logout] Server logout call failed, continuing with client purge:', err);
  }

  // 2. Clear in-memory tab cache
  try {
    clearMemoryTabCache();
  } catch {}

  // 3. Clear all localStorage completely
  try {
    localStorage.clear();
  } catch {}

  // 4. Clear all sessionStorage completely
  try {
    sessionStorage.clear();
  } catch {}

  // 5. Clear all IndexedDB offline storage
  try {
    await clearAllOfflineStorage();
  } catch {}

  // 6. Clear all Service Worker / PWA CacheStorage caches
  try {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }
  } catch {}

  // 7. Clear all client-accessible cookies
  try {
    const rawCookies = document.cookie.split(';');
    for (const cookieItem of rawCookies) {
      const eqPos = cookieItem.indexOf('=');
      const name = eqPos > -1 ? cookieItem.substring(0, eqPos).trim() : cookieItem.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      }
    }
  } catch {}

  // 8. Hard redirect using window.location.replace to prevent back-button caching
  window.location.replace('/login?logged_out=1');
}
