'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { registerServiceWorker } from '@/lib/push/browser-push';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function subscribeToStandalone(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', callback);
  return () => {
    media.removeEventListener('change', callback);
  };
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

function getServerStandaloneSnapshot(): boolean {
  return false;
}

export function PWARegistration() {
  const isInstalled = useSyncExternalStore(
    subscribeToStandalone,
    getStandaloneSnapshot,
    getServerStandaloneSnapshot
  );

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register service worker on idle
    if ('serviceWorker' in navigator) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          registerServiceWorker();
        });
      } else {
        setTimeout(() => {
          registerServiceWorker();
        }, 1500);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user dismissed prompt recently
      const dismissed = localStorage.getItem('ghumnechalo_pwa_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('ghumnechalo_pwa_dismissed', 'true');
    } catch {
      // ignore storage error
    }
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      role="banner"
      aria-label="Install App"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-2xl bg-neutral-900/95 border border-amber-500/30 text-white backdrop-blur-xl shadow-2xl shadow-amber-500/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 font-black shadow-md shadow-amber-500/20 shrink-0">
            GC
          </div>
          <div>
            <h3 className="font-semibold text-sm text-neutral-100">Install GhumneChalo</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Access your itineraries, offline trips, and emergency guides anytime.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Close install prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-end gap-2">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          Not Now
        </button>
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      </div>
    </div>
  );
}
