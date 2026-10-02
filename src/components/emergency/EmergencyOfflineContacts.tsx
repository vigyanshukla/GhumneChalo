'use client';

import React from 'react';
import { Phone, PhoneCall, ShieldAlert, HeartHandshake } from 'lucide-react';
import type { OfflineEmergencyContact } from '@/lib/emergency/types';

interface EmergencyOfflineContactsProps {
  contacts: OfflineEmergencyContact[];
  isOfflineMode?: boolean;
}

export function EmergencyOfflineContacts({
  contacts,
  isOfflineMode = false,
}: EmergencyOfflineContactsProps) {
  const primary112 = contacts.find((c) => c.number === '112');
  const otherContacts = contacts.filter((c) => c.number !== '112');

  return (
    <div className="space-y-6" data-testid="offline-emergency-contacts">
      {/* Disclaimer Header */}
      <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-base text-amber-900 dark:text-amber-200">
              {isOfflineMode
                ? 'OFFLINE EMERGENCY INFORMATION'
                : 'VERIFIED NATIONAL EMERGENCY HELPLINES'}
            </h4>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90 leading-relaxed">
              These are verified, 24x7 government emergency numbers for India. They work directly
              over regular cellular networks even when internet data or GPS is unavailable. Tap
              any button to initiate an instant direct phone call.
            </p>
          </div>
        </div>
      </div>

      {/* Primary 112 Unified Emergency Call Banner */}
      {primary112 && (
        <div className="rounded-3xl border-2 border-rose-500 bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 text-white p-5 sm:p-7 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-black tracking-wider uppercase">
                <HeartHandshake className="h-3.5 w-3.5" />
                All-in-One Emergency
              </div>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
                National Emergency: 112
              </h3>
              <p className="mt-1 text-sm sm:text-base text-rose-100 max-w-xl">
                Unified emergency helpline across India for Police, Ambulance, and Fire & Rescue.
                Free and accessible from any phone.
              </p>
            </div>
            <a
              href="tel:112"
              className="min-h-[56px] px-8 py-3.5 rounded-2xl font-black text-lg bg-white text-rose-600 hover:bg-rose-50 active:scale-95 shadow-xl transition-all inline-flex items-center justify-center gap-3 shrink-0 focus:outline-none focus:ring-4 focus:ring-white/50"
              data-testid="hero-call-112-btn"
            >
              <PhoneCall className="h-6 w-6 animate-pulse" />
              <span>Call 112 Now</span>
            </a>
          </div>
        </div>
      )}

      {/* Grid of Verified Contacts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {otherContacts.map((contact) => (
          <div
            key={contact.id}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {contact.availableHours}
                </span>
                {contact.isTollFree && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Toll-Free
                  </span>
                )}
              </div>
              <h4 className="mt-2 font-bold text-zinc-900 dark:text-zinc-50 text-base leading-snug">
                {contact.name}
              </h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                {contact.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <a
                href={`tel:${contact.number.replace(/[^0-9]/g, '')}`}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm transition-transform active:scale-98 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                data-testid={`call-contact-${contact.number}`}
              >
                <Phone className="h-4 w-4" />
                <span>Call {contact.number}</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
