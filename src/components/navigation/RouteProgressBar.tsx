'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * RouteProgressBar provides instant visual feedback when any navigation link is clicked.
 * Prevents PWA and mobile users from feeling the application is "hung" or unresponsive
 * during Next.js Server Component route transitions.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // When pathname or searchParams change, mark navigation as complete
  useEffect(() => {
    if (isNavigating) {
      setIsFinishing(true);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setIsFinishing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links
  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      // Find closest anchor tag
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore external, hash-only, mailto, tel, or target="_blank"
      if (
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        anchor.target === '_blank' ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // If navigating to the current path, no need to trigger
      try {
        const nextUrl = new URL(href, window.location.origin);
        if (
          nextUrl.pathname === window.location.pathname &&
          nextUrl.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      // Start progress bar immediately
      setIsNavigating(true);
      setIsFinishing(false);
    }

    function handlePopState() {
      setIsNavigating(true);
      setIsFinishing(false);
    }

    document.addEventListener('click', handleLinkClick, { capture: true });
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleLinkClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (!isNavigating && !isFinishing) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none overflow-hidden"
    >
      <div
        className={`h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 shadow-[0_0_8px_rgba(59,130,246,0.6)] ${
          isFinishing
            ? 'w-full transition-all duration-150 ease-out opacity-0'
            : 'w-full animate-gc-progress opacity-100'
        }`}
      />
    </div>
  );
}
