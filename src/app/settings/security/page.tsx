import React, { Suspense } from 'react';
import SecuritySettingsClient from './SecuritySettingsClient';
import { Loader2 } from 'lucide-react';

export default function SecuritySettingsPage() {
  return (
    <Suspense
      fallback={
        <div
          suppressHydrationWarning
          className="min-h-screen bg-slate-50 flex flex-col justify-center items-center"
        >
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      }
    >
      <SecuritySettingsClient />
    </Suspense>
  );
}
