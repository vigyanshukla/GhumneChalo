'use client';

import { useSyncExternalStore } from 'react';

function subscribeToPermission(callback: () => void) {
  if (typeof window === 'undefined' || !('permissions' in navigator)) {
    return () => {};
  }
  let permissionStatus: PermissionStatus | null = null;
  navigator.permissions
    .query({ name: 'notifications' as PermissionName })
    .then((status) => {
      permissionStatus = status;
      status.addEventListener('change', callback);
    })
    .catch(() => {});

  return () => {
    if (permissionStatus) {
      permissionStatus.removeEventListener('change', callback);
    }
  };
}

function getPermissionSnapshot(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
}

function getServerPermissionSnapshot(): NotificationPermission {
  return 'default';
}

export function useNotificationPermission(): NotificationPermission {
  return useSyncExternalStore(
    subscribeToPermission,
    getPermissionSnapshot,
    getServerPermissionSnapshot
  );
}

function urlB64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(): Promise<{ success: boolean; error?: string; subscription?: unknown }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Push notifications are not supported by this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    const reg = await navigator.serviceWorker.ready;

    // Fetch VAPID public key
    const keyRes = await fetch('/api/notifications/push/vapid-public-key', {
      credentials: 'include',
    });
    const keyData = await keyRes.json();
    const publicKey = keyData.data?.publicKey;

    if (!publicKey) {
      return { success: false, error: 'Failed to retrieve VAPID public key.' };
    }

    const convertedKey = urlB64ToUint8Array(publicKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint || subscription.endpoint || '';

    // Extract keys with cross-browser fallback
    let p256dh = subJson.keys?.p256dh || '';
    let auth = subJson.keys?.auth || '';
    if (!p256dh && typeof subscription.getKey === 'function') {
      const rawKey = subscription.getKey('p256dh');
      if (rawKey) {
        p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawKey))));
      }
    }
    if (!auth && typeof subscription.getKey === 'function') {
      const rawAuth = subscription.getKey('auth');
      if (rawAuth) {
        auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));
      }
    }

    // Extract FCM registration token if from FCM
    let fcmToken: string | null = null;
    if (endpoint.includes('fcm.googleapis.com/fcm/send/')) {
      fcmToken = endpoint.split('fcm.googleapis.com/fcm/send/')[1] || null;
    }

    // Save to Supabase with credentials for mobile cross-origin/PWA cookies
    const saveRes = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh, auth },
        p256dh,
        auth,
        fcmToken,
        userAgent: navigator.userAgent,
      }),
    });

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => null);
      throw new Error(errData?.error?.message || errData?.message || 'Failed to save push subscription in Supabase.');
    }

    const savedData = await saveRes.json();
    return { success: true, subscription: savedData.data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Subscription error' };
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unsubscribe error' };
  }
}
