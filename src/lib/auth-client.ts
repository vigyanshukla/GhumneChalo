import { clearAllOfflineStorage } from '@/lib/offline/offline-storage';
import { clearMemoryTabCache } from '@/lib/cache/client-cache';

/**
 * Robust, universal logout function for all client components:
 * 1. Purges all in-memory, localStorage, sessionStorage, IndexedDB, and CacheStorage
 * 2. Clears all accessible document.cookie entries
 * 3. Calls /api/auth/logout with credentials to expire server session cookies
 * 4. Hard navigates to /login?logged_out=1 (bypasses Next.js router cache & bfcache)
 */
export async function performLogout(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Clear in-memory tab cache
  try {
    clearMemoryTabCache();
  } catch {}

  // 2. Clear all localStorage completely
  try {
    localStorage.clear();
  } catch {}

  // 3. Clear all sessionStorage completely
  try {
    sessionStorage.clear();
  } catch {}

  // 4. Clear all IndexedDB offline storage with strict timeout (prevents hanging on mobile DB locks)
  try {
    await Promise.race([
      clearAllOfflineStorage(),
      new Promise((res) => setTimeout(res, 400)),
    ]);
  } catch {}

  // 5. Clear all Service Worker / PWA CacheStorage caches
  try {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }
  } catch {}

  // 6. Clear client-accessible cookies
  try {
    const rawCookies = document.cookie.split(';');
    for (const cookieItem of rawCookies) {
      const eqPos = cookieItem.indexOf('=');
      const name = eqPos > -1 ? cookieItem.substring(0, eqPos).trim() : cookieItem.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        try {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        } catch {}
      }
    }
  } catch {}

  // 7. Call server logout endpoint (POST) to clear server session & cookies
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

  // 8. Hard redirect using window.location.replace to prevent back-button caching
  window.location.replace('/login?logged_out=1');
}
