'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(targetTheme: Theme): 'light' | 'dark' {
  if (targetTheme === 'dark') return 'dark';
  if (targetTheme === 'light') return 'light';
  return getSystemIsDark() ? 'dark' : 'light';
}

function applyThemeToDOM(targetTheme: Theme): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const resolved = resolveTheme(targetTheme);
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }

  return resolved;
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    let stored = localStorage.getItem('theme') as Theme | null;
    if (!stored && typeof document !== 'undefined') {
      const m = document.cookie.match(/(^|; )theme=([^;]+)/);
      if (m) stored = decodeURIComponent(m[2]) as Theme;
    }
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    // Cache default 'light' on first visit
    localStorage.setItem('theme', 'light');
    document.cookie = 'theme=light; path=/; max-age=31536000; SameSite=Lax';
  } catch {}
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const channelRef = useRef<BroadcastChannel | null>(null);

  // Synchronously apply theme and broadcast changes
  const setTheme = useCallback((newTheme: Theme) => {
    // 1. Immediately apply to DOM without waiting for React render cycles
    const resolved = applyThemeToDOM(newTheme);
    setThemeState(newTheme);
    setResolvedTheme(resolved);

    // 2. Persist to cache (localStorage and cookie for 1 year)
    try {
      localStorage.setItem('theme', newTheme);
      document.cookie = `theme=${encodeURIComponent(newTheme)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    // 3. Broadcast to other open tabs in realtime
    try {
      channelRef.current?.postMessage({ theme: newTheme, resolved });
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  // Initial mount sync & event listeners
  useEffect(() => {
    // 1. Apply active theme to DOM
    applyThemeToDOM(theme);

    // 2. Setup BroadcastChannel for instant cross-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('ghumnechalo_theme_sync');
        channelRef.current = channel;
        channel.onmessage = (event: MessageEvent<{ theme?: Theme }>) => {
          if (event.data?.theme) {
            const incoming = event.data.theme;
            const res = applyThemeToDOM(incoming);
            setThemeState(incoming);
            setResolvedTheme(res);
          }
        };
      } catch {}
    }

    // 3. Storage event fallback for older browsers or if BroadcastChannel is blocked
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'theme' && event.newValue) {
        const incoming = event.newValue as Theme;
        if (incoming === 'light' || incoming === 'dark' || incoming === 'system') {
          const res = applyThemeToDOM(incoming);
          setThemeState(incoming);
          setResolvedTheme(res);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. System theme changes (e.g. user changes OS Dark/Light setting)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      let currentTheme: Theme = 'system';
      try {
        currentTheme = (localStorage.getItem('theme') as Theme) || 'system';
      } catch {}
      if (currentTheme === 'system') {
        const res = applyThemeToDOM('system');
        setResolvedTheme(res);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      mediaQuery.removeEventListener('change', handleMediaChange);
      try {
        channelRef.current?.close();
      } catch {}
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
