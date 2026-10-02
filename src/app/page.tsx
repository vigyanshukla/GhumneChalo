import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOptionalAuthenticatedUser } from '@/lib/auth-server';
import {
  Compass,
  Luggage,
  Clock,
  ShieldAlert,
  Trophy,
  ArrowRight,
  Sparkles,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'GhumneChalo - Smart Wander Travel Platform',
  description:
    'Plan multi-day journeys, explore hidden gems, set real-time travel alerts, track milestones, and access emergency helplines.',
};

export default async function Home() {
  const user = await getOptionalAuthenticatedUser();
  if (user) {
    redirect('/home');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-base sm:text-xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent truncate">
              GhumneChalo
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm font-medium">
            <Link
              href="/explore"
              className="hidden md:inline-block px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/trips"
              className="px-2 sm:px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
            >
              My Trips
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline-block px-2.5 py-1.5 rounded-xl font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-sm shadow-blue-600/30 whitespace-nowrap"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Generation Travel Companion</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.15]">
          Travel smarter, discover deeper, wander effortlessly.
        </h1>

        <p className="mt-5 text-sm sm:text-base lg:text-lg text-zinc-400 max-w-2xl leading-relaxed">
          From AI-powered itineraries and departure countdowns to live offline emergency helplines and interactive local discovery.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <Link
            href="/trips"
            className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Luggage className="w-5 h-5" />
            <span>Open Trips Workspace</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          <Link
            href="/explore"
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-semibold text-sm sm:text-base transition-all flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Explore Destinations</span>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full text-left">
          <Link
            href="/reminders"
            className="group p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-900 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5 flex items-center justify-between">
              <span>Smart Reminders</span>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Timely flight departures, itinerary activities, and web push notifications on all your devices.
            </p>
          </Link>

          <Link
            href="/achievements"
            className="group p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-900 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Trophy className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5 flex items-center justify-between">
              <span>Badges & Score</span>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Unlock milestone badges, track destinations visited, and level up your wanderer profile.
            </p>
          </Link>

          <Link
            href="/emergency"
            className="group p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 hover:border-rose-500/40 hover:bg-zinc-900 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5 flex items-center justify-between">
              <span>Emergency SOS</span>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-rose-400 transition-colors" />
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Instant 112 dialing, nearby hospital & police locator, plus offline emergency contacts.
            </p>
          </Link>

          <Link
            href="/notifications"
            className="group p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800 hover:border-blue-500/40 hover:bg-zinc-900 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5 flex items-center justify-between">
              <span>Alerts Center</span>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition-colors" />
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Unified in-app inbox and device push preferences with granular category toggles.
            </p>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 text-center text-xs text-zinc-500">
        <p>GhumneChalo Smart Wander Platform — Lightweight, Fast, Resilient</p>
      </footer>
    </div>
  );
}
