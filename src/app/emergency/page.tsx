import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, PhoneCall } from 'lucide-react';
import { EmergencyDashboard } from '@/components/emergency';

export const metadata: Metadata = {
  title: 'Emergency Mode - Live Assistance & Helplines',
  description: 'Verified 24x7 emergency helplines, nearby police stations, hospitals, and offline travel safety assistance.',
};

export default function EmergencyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-rose-200 dark:border-rose-950 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/trips"
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Back to Trips"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                  Emergency Mode
                </h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-none hidden sm:block">
                  Live nearby assistance & verified 24x7 helplines
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:112"
              className="min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-700 text-white shadow transition-all inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
              data-testid="header-call-112"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>SOS: 112</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <EmergencyDashboard />
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>
            Emergency Mode provides live nearby facility directions and official Indian public
            safety helplines. In an immediate life-threatening emergency, always dial 112 directly.
          </p>
        </div>
      </footer>
    </div>
  );
}
