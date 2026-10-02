'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { CACHE_KEYS, getStoredItem, cachedFetch } from '@/lib/cache/client-cache';

interface SecurityStatus {
  email: string;
  name: string | null;
  image: string | null;
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  memberSince: string;
}

export default function SecuritySettingsClient() {
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<SecurityStatus | null>(() => {
    const cached = getStoredItem<{ success: boolean; data: SecurityStatus }>(CACHE_KEYS.SECURITY);
    return cached?.data?.data || null;
  });
  const [loading, setLoading] = useState(() => {
    const cached = getStoredItem<{ success: boolean; data: SecurityStatus }>(CACHE_KEYS.SECURITY);
    return !cached?.data?.data;
  });
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 2FA Enable Modal / Flow State
  const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
  const [enableOtp, setEnableOtp] = useState(['', '', '', '', '', '']);
  const [enablingLoading, setEnablingLoading] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [enableSuccess, setEnableSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resending, setResending] = useState(false);

  // 2FA Disable Modal / Flow State
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disablingLoading, setDisablingLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableSuccess, setDisableSuccess] = useState<string | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Google Account Binding State
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(() => {
    if (searchParams.get('linked') === 'true') {
      return { type: 'success', text: 'Google account successfully linked to your profile!' };
    }
    const err = searchParams.get('error');
    if (err) {
      const errorMap: Record<string, string> = {
        MissingCSRF: 'Authentication session expired. Please click Connect Google Account again.',
        OAuthSignin: 'Could not connect to Google. Please check your network or try again.',
        OAuthCallback: 'There was a problem linking your Google account. Please try again.',
        AccessDenied: 'Google authorization was cancelled.',
      };
      return { type: 'error', text: errorMap[err] || `Google authorization error: ${err}` };
    }
    return null;
  });

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadSecurityStatus = async (force = false) => {
    try {
      const data = await cachedFetch<{ success: boolean; data: SecurityStatus }>(
        '/api/account/security',
        undefined,
        { cacheKey: CACHE_KEYS.SECURITY, ttlMs: 5 * 60 * 1000, forceRefresh: force }
      );

      if (data?.success) {
        setStatus(data.data);
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Error loading security information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchSecurity() {
      try {
        const data = await cachedFetch<{ success: boolean; data: SecurityStatus }>(
          '/api/account/security',
          undefined,
          { cacheKey: CACHE_KEYS.SECURITY, ttlMs: 5 * 60 * 1000 }
        );

        if (!ignore && data?.success) {
          setStatus(data.data);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setFetchError(err instanceof Error ? err.message : 'Error loading security information');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchSecurity();
    return () => {
      ignore = true;
    };
  }, []);

  const handleLinkGoogle = () => {
    if (linkingGoogle) return;
    setOauthMessage(null);
    setLinkingGoogle(true);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/api/auth/signin/google?callbackUrl=/settings/security?linked=true';
  };

  const handleUnlinkGoogle = async () => {
    if (unlinkingGoogle) return;
    setOauthMessage(null);
    setUnlinkingGoogle(true);

    try {
      const res = await fetch('/api/account/security/unlink-google', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to disconnect Google account.');
      }

      setOauthMessage({ type: 'success', text: 'Google account disconnected successfully.' });
      await loadSecurityStatus(true);
    } catch (err: unknown) {
      setOauthMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not disconnect Google account.',
      });
    } finally {
      setUnlinkingGoogle(false);
    }
  };

  useEffect(() => {
    if (isEnableModalOpen && resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isEnableModalOpen, resendCooldown]);

  // Start 2FA Enable: request OTP
  const handleStartEnable2Fa = async () => {
    setEnableError(null);
    setEnableSuccess(null);
    setEnablingLoading(true);

    try {
      const res = await fetch('/api/account/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to initiate 2FA setup');
      }

      setIsEnableModalOpen(true);
      setResendCooldown(30);
      setEnableOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err: unknown) {
      setEnableError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setEnablingLoading(false);
    }
  };

  // Confirm 2FA OTP
  const handleConfirm2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = enableOtp.join('');
    if (fullCode.length !== 6) {
      setEnableError('Please enter the complete 6-digit verification code.');
      return;
    }

    setEnableError(null);
    setEnableSuccess(null);
    setEnablingLoading(true);

    try {
      const res = await fetch('/api/account/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: fullCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Invalid verification code');
      }

      setEnableSuccess('Two-step verification is enabled.');
      setStatus((prev) => (prev ? { ...prev, twoFactorEnabled: true } : null));
      setTimeout(() => {
        setIsEnableModalOpen(false);
        setEnableSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setEnableError(err instanceof Error ? err.message : 'Failed to confirm 2FA');
    } finally {
      setEnablingLoading(false);
    }
  };

  // Resend 2FA setup OTP
  const handleResendSetupOtp = async () => {
    if (resendCooldown > 0 || resending || !status?.email) return;

    setEnableError(null);
    setResending(true);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: status.email, type: 'TWO_FACTOR_SETUP' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to resend code');
      }

      setResendCooldown(60);
      setEnableOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: unknown) {
      setEnableError(err instanceof Error ? err.message : 'Unable to resend code');
    } finally {
      setResending(false);
    }
  };

  // Disable 2FA
  const handleDisable2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError(null);
    setDisableSuccess(null);
    setDisablingLoading(true);

    try {
      const res = await fetch('/api/account/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword || undefined }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to disable 2FA');
      }

      setDisableSuccess('Two-step verification has been disabled.');
      setStatus((prev) => (prev ? { ...prev, twoFactorEnabled: false } : null));
      setTimeout(() => {
        setIsDisableModalOpen(false);
        setDisablePassword('');
        setDisableSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setDisableError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setDisablingLoading(false);
    }
  };

  // Change Password
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
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully! A security confirmation was sent to your email.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Error changing password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const next = [...enableOtp];
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) next[i] = chars[i] || '';
      setEnableOtp(next);
      const focusIndex = Math.min(chars.length, 5);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    next[index] = clean;
    setEnableOtp(next);
    if (clean && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !enableOtp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };



  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200"
    >
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                Security &amp; Authentication
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Manage your credentials, two-step verification, and account security
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* SECTION: APPEARANCE & THEME */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-amber-500" />
                  Appearance &amp; Theme
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Customize your viewing experience with Light, Dark, or System mode
                </p>
              </div>
              <span
                suppressHydrationWarning
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 capitalize"
              >
                {theme} Mode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                id="theme-select-light"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
                  theme === 'light'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Light Mode</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Bright and clean daylight theme</p>
                </div>
              </button>

              <button
                type="button"
                id="theme-select-dark"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
                  theme === 'dark'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Dark Mode</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Easy on the eyes at night</p>
                </div>
              </button>

              <button
                type="button"
                id="theme-select-system"
                onClick={() => setTheme('system')}
                className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
                  theme === 'system'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">System Default</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Sync with device settings</p>
                </div>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading security and credentials status...</p>
            </div>
          ) : fetchError || !status ? (
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-1">Unable to load security settings</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">{fetchError}</p>
              <button
                onClick={() => loadSecurityStatus()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: ACCOUNT STATUS OVERVIEW */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-xs transition-colors duration-200">
                <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
              Email &amp; Identity
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{status.email}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Primary account email used for sign-in and security notifications</p>
              </div>
              <div className="flex items-center gap-2">
                {status.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified
                  </span>
                ) : (
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(status.email)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Verify Now
                  </Link>
                )}
              </div>
            </div>

            {oauthMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 my-3 ${
                  oauthMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  {oauthMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <span>{oauthMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOauthMessage(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5"
                  aria-label="Dismiss message"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">Connected Accounts</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Third-party OAuth providers linked to your profile</p>
              </div>
              <div className="flex items-center gap-3">
                {status.googleLinked ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      Google Linked
                    </span>
                    {status.hasPassword ? (
                      <button
                        type="button"
                        id="unlink-google-btn"
                        onClick={handleUnlinkGoogle}
                        disabled={unlinkingGoogle}
                        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors cursor-pointer px-2 py-1"
                      >
                        {unlinkingGoogle ? 'Unlinking...' : 'Disconnect'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 italic">Set password to disconnect</span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    id="link-google-btn"
                    onClick={handleLinkGoogle}
                    disabled={linkingGoogle}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700/70 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {linkingGoogle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        Connecting to Google...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        Connect Google Account
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: TWO-STEP VERIFICATION (2FA) */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-xs transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Two-Step Verification (2FA)
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
                  Require a secure 6-digit numeric one-time code sent to your email whenever signing into your account.
                </p>
              </div>
              <div>
                {status.twoFactorEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    Disabled
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              {status.twoFactorEnabled ? (
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">Two-step verification is actively protecting your account.</p>
                  <button
                    type="button"
                    id="open-disable-2fa-btn"
                    onClick={() => {
                      setDisableError(null);
                      setIsDisableModalOpen(true);
                    }}
                    className="min-h-[44px] px-4 py-2 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Disable 2-Step Verification
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">
                    Protect your trips and saved places with an extra layer of authentication.
                  </p>
                  <button
                    type="button"
                    id="open-enable-2fa-btn"
                    onClick={handleStartEnable2Fa}
                    disabled={enablingLoading}
                    className="min-h-[44px] px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {enablingLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending verification code...
                      </>
                    ) : (
                      'Enable 2-Step Verification'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: CHANGE PASSWORD */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-xs transition-colors duration-200">
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
              Change Password
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-5">
              Ensure your password is at least 8 characters long with uppercase, lowercase, numbers, and symbols.
            </p>

            {passwordError && (
              <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    id="current-password-input"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={savingPassword}
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-750 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    id="new-password-input"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={savingPassword}
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-750 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    id="confirm-new-password-input"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={savingPassword}
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-750 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="change-password-submit-btn"
                disabled={savingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                className="min-h-[44px] px-5 py-2.5 bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  'Change Password'
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  </div>

  {/* ENABLE 2FA MODAL */}
  {status && isEnableModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Enable Two-Step Verification
              </h3>
              <button
                type="button"
                onClick={() => setIsEnableModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4">
              We sent a 6-digit confirmation code to{' '}
              <span className="font-semibold text-slate-900 dark:text-zinc-200">{status.email}</span>. Enter it below to enable 2FA.
            </p>

            {enableError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl">
                {enableError}
              </div>
            )}

            {enableSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl">
                {enableSuccess}
              </div>
            )}

            <form onSubmit={handleConfirm2Fa} className="space-y-5">
              <div className="flex justify-between gap-2 max-w-xs mx-auto">
                {enableOtp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={enablingLoading}
                    aria-label={`Digit ${idx + 1}`}
                    className="w-10 h-12 text-center text-lg font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-750 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                ))}
              </div>

              <button
                type="submit"
                id="confirm-enable-2fa-btn"
                disabled={enablingLoading || enableOtp.join('').length !== 6}
                className="w-full min-h-[44px] py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2"
              >
                {enablingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm & Enable 2-Step Verification'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendSetupOtp}
                  disabled={resendCooldown > 0 || resending}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium disabled:text-slate-400 dark:disabled:text-zinc-600 transition"
                >
                  {resending
                    ? 'Resending...'
                    : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISABLE 2FA MODAL */}
      {status && isDisableModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 text-red-600 dark:text-red-400">
                <ShieldAlert className="w-5 h-5" />
                Disable Two-Step Verification
              </h3>
              <button
                type="button"
                onClick={() => setIsDisableModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4">
              Disabling 2FA lowers your account security. Please verify your current password to proceed.
            </p>

            {disableError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl">
                {disableError}
              </div>
            )}

            {disableSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl">
                {disableSuccess}
              </div>
            )}

            <form onSubmit={handleDisable2Fa} className="space-y-4">
              {status.hasPassword && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="disable-2fa-password-input"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={disablingLoading}
                    className="block w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white dark:focus:bg-zinc-750 transition"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDisableModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirm-disable-2fa-btn"
                  disabled={disablingLoading || (status.hasPassword && !disablePassword)}
                  className="flex-1 min-h-[44px] py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2"
                >
                  {disablingLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    'Disable 2FA'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

