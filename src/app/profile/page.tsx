'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Calendar,
  LogOut,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { AppNav } from '@/components/navigation/AppNav';
import { CACHE_KEYS, getStoredItem, setStoredItem, cachedFetch, clearAllStoredCache } from '@/lib/cache/client-cache';

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  _count: {
    trips: number;
    savedPlaces: number;
    achievements: number;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cached = getStoredItem<{ success: boolean; data: UserProfile }>(CACHE_KEYS.PROFILE);
    return cached?.data?.data || null;
  });
  const [loading, setLoading] = useState(() => {
    const cached = getStoredItem<{ success: boolean; data: UserProfile }>(CACHE_KEYS.PROFILE);
    return !cached?.data?.data;
  });
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Profile Edit State
  const [name, setName] = useState(() => {
    const cached = getStoredItem<{ success: boolean; data: UserProfile }>(CACHE_KEYS.PROFILE);
    return cached?.data?.data?.name || '';
  });
  const [image, setImage] = useState(() => {
    const cached = getStoredItem<{ success: boolean; data: UserProfile }>(CACHE_KEYS.PROFILE);
    return cached?.data?.data?.image || '';
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load Profile on Mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await cachedFetch<{ success: boolean; data: UserProfile }>(
          '/api/profile',
          undefined,
          { cacheKey: CACHE_KEYS.PROFILE, ttlMs: 10 * 60 * 1000 }
        );

        if (!data || !data.success) {
          throw new Error('Failed to load profile');
        }

        setProfile(data.data);
        setName(data.data.name || '');
        setImage(data.data.image || '');
      } catch (err: unknown) {
        setFetchError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;

    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), image: image.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update profile');
      }

      setProfile((prev) => {
        if (!prev) return null;
        const updated = { ...prev, name: data.data.name, image: data.data.image };
        setStoredItem(CACHE_KEYS.PROFILE, { success: true, data: updated });
        return updated;
      });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);
    setSavingPassword(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearAllStoredCache();
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !profile) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 text-center max-w-sm w-full">
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{fetchError || 'Unable to load profile'}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Shared Authenticated Navigation Shell */}
      <AppNav />

      {/* Sub-header: Breadcrumb & Security link */}
      <div className="border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/trips"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>My Trips</span>
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700 text-xs">/</span>
            <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 truncate">
              Profile & Account
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings/security"
              id="profile-security-settings-link"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Security & 2FA</span>
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24 md:pb-12">
        {/* User Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xs border border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shrink-0 overflow-hidden">
            {profile.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.image} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (profile.name?.[0] || profile.email[0]).toUpperCase()
            )}
          </div>
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile.name || 'Traveler'}
            </h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                {profile.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 pt-3 max-w-sm mx-auto sm:mx-0">
              <Link
                href="/trips"
                className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl text-center border border-zinc-200/60 dark:border-zinc-800 hover:border-blue-500/50 transition-colors"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Trips</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{profile._count.trips}</p>
              </Link>
              <Link
                href="/explore"
                className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl text-center border border-zinc-200/60 dark:border-zinc-800 hover:border-emerald-500/50 transition-colors"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Saved</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{profile._count.savedPlaces}</p>
              </Link>
              <Link
                href="/achievements"
                className="p-3 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-amber-500/10 rounded-2xl text-center border border-zinc-200/60 dark:border-zinc-800 hover:border-amber-500/40 transition-colors group cursor-pointer"
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-amber-500 font-medium">Badges</p>
                <p className="text-lg font-bold text-amber-500 group-hover:text-amber-400">{profile._count.achievements}</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Two-Column Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Edit Profile Section */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xs border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Edit Profile Details</h3>
            </div>

            {profileError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs rounded-xl">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  disabled={savingProfile}
                  className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Photo URL
                </label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  disabled={savingProfile}
                  className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
                  Email (Immutable)
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="block w-full px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-400 dark:text-zinc-500 text-sm cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-blue-500/20"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </form>
          </div>

          {/* Change Password Section */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xs border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Change Password</h3>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs rounded-xl">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={savingPassword}
                  className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 chars, 1 upper, 1 lower, 1 num"
                  disabled={savingPassword}
                  className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={savingPassword}
                  className="block w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-all disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
