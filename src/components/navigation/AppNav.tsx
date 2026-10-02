'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Map,
  Luggage,
  Bell,
  User,
  Plus,
  Trophy,
  ShieldAlert,
  Clock,
  ChevronDown,
  LogOut,
  Settings,
  Loader2,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  CACHE_KEYS,
  getStoredItem,
  cachedFetch,
  clearAllStoredCache,
  prefetchCoreData,
} from '@/lib/cache/client-cache';
import { clearUserOfflineStorage } from '@/lib/offline/offline-storage';

interface UserProfile {
  name: string | null;
  email: string;
  image: string | null;
}

// ─── Profile Dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({ profile, onLogout }: { profile: UserProfile; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initial = (profile.name?.[0] ?? profile.email[0]).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        id="profile-menu-btn"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 text-white text-xs font-bold flex items-center justify-center overflow-hidden shrink-0">
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.image} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <span className="hidden sm:block text-xs font-semibold text-zinc-700 dark:text-zinc-200 max-w-[100px] truncate">
          {profile.name ?? profile.email.split('@')[0]}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {profile.name ?? 'Traveler'}
            </p>
            <p className="text-xs text-zinc-400 truncate">{profile.email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <User className="w-4 h-4 text-zinc-400" />
              My Profile
            </Link>
            <Link
              href="/settings/security"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings className="w-4 h-4 text-zinc-400" />
              Settings &amp; Security
            </Link>
            <Link
              href="/reminders"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Clock className="w-4 h-4 text-zinc-400" />
              Reminders
            </Link>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 py-1">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Desktop Top Nav ──────────────────────────────────────────────────────────

interface AppNavProps {
  profile: UserProfile | null;
  loadingProfile: boolean;
  onLogout: () => void;
}

function DesktopNav({ profile, loadingProfile, onLogout }: AppNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/home'
      ? pathname === '/home'
      : href === '/trips'
      ? pathname === '/trips' || pathname.startsWith('/trips/')
      : pathname === href || pathname.startsWith(href + '/');

  const navLinks = [
    { href: '/home',     label: 'Home',        Icon: Home },
    { href: '/trips',    label: 'My Trips',    Icon: Luggage },
    { href: '/explore',  label: 'Explore',     Icon: Map },
    { href: '/reminders',label: 'Reminders',   Icon: Clock },
    { href: '/achievements', label: 'Badges',  Icon: Trophy },
    { href: '/emergency',label: 'Emergency',   Icon: ShieldAlert },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-4">
          <Link href="/home" className="flex items-center gap-2.5 shrink-0" aria-label="GhumneChalo home">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/60 p-0.5 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
              <Image
                src="/logo-transparent.png"
                alt="GhumneChalo Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent hidden sm:block">
              GhumneChalo
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main navigation">
            {navLinks.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium active:scale-95 transition-all duration-75 ${
                  isActive(href)
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Theme + Bell + New Trip + Profile */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />

          <Link
            href="/trips/new"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Trip
          </Link>

          {loadingProfile ? (
            <div className="w-8 h-8 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            </div>
          ) : profile ? (
            <ProfileDropdown profile={profile} onLogout={onLogout} />
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

function MobileBottomNav() {
  const pathname = usePathname();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);

  // Clear optimistic path once real route arrives
  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const currentPath = optimisticPath || pathname;

  const isActive = (href: string) => {
    if (href === '/home') return currentPath === '/home';
    if (href === '/trips') return currentPath === '/trips' || (currentPath.startsWith('/trips/') && !currentPath.startsWith('/trips/new'));
    return currentPath === href || currentPath.startsWith(href + '/');
  };

  const handleTabClick = (href: string) => {
    setOptimisticPath(href);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 select-none"
      aria-label="Mobile navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {/* Home */}
        <Link
          href="/home"
          onClick={() => handleTabClick('/home')}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-90 active:opacity-75 transition-all duration-75 ${
            isActive('/home')
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
          aria-label="Home"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </Link>

        {/* Explore */}
        <Link
          href="/explore"
          onClick={() => handleTabClick('/explore')}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-90 active:opacity-75 transition-all duration-75 ${
            isActive('/explore')
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
          aria-label="Explore"
        >
          <Map className="w-5 h-5" />
          <span className="text-[10px]">Explore</span>
        </Link>

        {/* New Trip — FAB center */}
        <Link
          href="/trips/new"
          onClick={() => handleTabClick('/trips/new')}
          className="flex flex-col items-center justify-center flex-1 h-full -mt-2 active:scale-90 transition-transform duration-75"
          aria-label="Create new trip"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 active:bg-blue-700">
            <Plus className="w-6 h-6 text-white" />
          </div>
        </Link>

        {/* Notifications */}
        <Link
          href="/notifications"
          onClick={() => handleTabClick('/notifications')}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-90 active:opacity-75 transition-all duration-75 ${
            isActive('/notifications')
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="text-[10px]">Alerts</span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          onClick={() => handleTabClick('/profile')}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:scale-90 active:opacity-75 transition-all duration-75 ${
            isActive('/profile')
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
          aria-label="My profile"
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Me</span>
        </Link>
      </div>
    </nav>
  );
}

// ─── AppNav (Combined) ────────────────────────────────────────────────────────

/**
 * AppNav — unified authenticated navigation shell.
 *
 * Renders:
 *   - Desktop: sticky top header with logo, nav links, notification bell, profile dropdown
 *   - Mobile: fixed bottom tab bar with Home/Explore/New/Alerts/Me
 *
 * Profile data is fetched client-side from /api/profile.
 * Logout is handled via /api/auth/logout.
 */
export function AppNav() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cached = getStoredItem<{ success: boolean; data: UserProfile }>(CACHE_KEYS.PROFILE);
    if (cached?.data?.data) {
      return {
        name: cached.data.data.name,
        email: cached.data.data.email,
        image: cached.data.data.image,
      };
    }
    return null;
  });
  const [loadingProfile, setLoadingProfile] = useState(!profile);

  useEffect(() => {
    // 1. Fetch profile with deduplication and localStorage caching
    cachedFetch<{ success: boolean; data: UserProfile }>('/api/profile', undefined, {
      cacheKey: CACHE_KEYS.PROFILE,
      ttlMs: 10 * 60 * 1000,
    })
      .then((data) => {
        if (data?.success && data?.data) {
          setProfile({
            name: data.data.name,
            email: data.data.email,
            image: data.data.image,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));

    // 2. Prefetch core user data during idle time to prevent thread congestion
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => prefetchCoreData(), { timeout: 3000 });
      } else {
        setTimeout(prefetchCoreData, 2000);
      }
    }
  }, []);

  const handleLogout = async () => {
    // Get current userId for targeted IndexedDB cleanup before clearing profile cache
    let userId: string | undefined;
    try {
      const profileCache = getStoredItem<{ success: boolean; data: { id?: string } }>(CACHE_KEYS.PROFILE);
      userId = profileCache?.data?.data?.id;
    } catch {}

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    // Clear all client-side caches and in-memory state
    clearAllStoredCache();

    // Targeted user IndexedDB cleanup (faster than clearing all)
    if (userId) {
      clearUserOfflineStorage(userId).catch(() => {});
    }

    // Use hard navigation to force full heap clearing — prevents stale React state
    // from persisting across account switches
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/';
  };

  return (
    <>
      <DesktopNav profile={profile} loadingProfile={loadingProfile} onLogout={handleLogout} />
      <MobileBottomNav />
    </>
  );
}
