import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 12C — Performance & Lightweight Optimization (TC-12C.01 to TC-12C.08)', () => {
  const rootDir = process.cwd();

  // TC-12C.01: Next.js compression and bundle optimization enabled
  it('TC-12C.01: next.config.ts enables compression, optimizePackageImports, and immutable caching', () => {
    const configPath = path.join(rootDir, 'next.config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('compress: true');
    expect(content).toContain('optimizePackageImports');
    expect(content).toContain('lucide-react');
    expect(content).toContain('max-age=31536000, immutable');
  });

  // TC-12C.02: Code-splitting and dynamic imports in trip details
  it('TC-12C.02: heavy view modules in trips/[tripId] are dynamically imported with next/dynamic', () => {
    const tripPagePath = path.join(rootDir, 'src', 'app', 'trips', '[tripId]', 'page.tsx');
    const content = fs.readFileSync(tripPagePath, 'utf-8');
    expect(content).toContain('dynamic(');
    expect(content).toContain('TransportationView');
    expect(content).toContain('WeatherView');
    expect(content).toContain('PackingView');
  });

  // TC-12C.03: Prisma queries use targeted select instead of blind wildcard include
  it('TC-12C.03: Prisma queries use select projection in itinerary-service and expenses', () => {
    const itineraryServicePath = path.join(rootDir, 'src', 'lib', 'itinerary-service.ts');
    const itinContent = fs.readFileSync(itineraryServicePath, 'utf-8');
    expect(itinContent).toContain('verifyDayOwnership');
    expect(itinContent).toContain('select: {');

    const expensesRoutePath = path.join(rootDir, 'src', 'app', 'api', 'trips', '[tripId]', 'expenses', 'route.ts');
    const expContent = fs.readFileSync(expensesRoutePath, 'utf-8');
    expect(expContent).toContain('select: {');
  });

  // TC-12C.04: Concurrent database query execution in transportation route
  it('TC-12C.04: transportation API route parallelizes records and itinerary days fetches via Promise.all', () => {
    const transportRoutePath = path.join(rootDir, 'src', 'app', 'api', 'trips', '[tripId]', 'transportation', 'route.ts');
    const content = fs.readFileSync(transportRoutePath, 'utf-8');
    expect(content).toContain('Promise.all([');
    expect(content).toContain('prisma.transportation.findMany');
    expect(content).toContain('prisma.itineraryDay.findMany');
  });

  // TC-12C.05: Root Layout employs swap font display and avoids render-blocking font loads
  it('TC-12C.05: src/app/layout.tsx configures font display: swap and preloading', () => {
    const layoutPath = path.join(rootDir, 'src', 'app', 'layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    expect(content).toContain('display: "swap"');
    expect(content).toContain('preload: true');
  });

  // TC-12C.06: Notification unread count and polling is visibility-aware
  it('TC-12C.06: NotificationBell suppresses unnecessary background polling when tab is hidden', () => {
    const bellPath = path.join(rootDir, 'src', 'components', 'notifications', 'NotificationBell.tsx');
    const content = fs.readFileSync(bellPath, 'utf-8');
    expect(content).toContain('visibilitychange');
    expect(content).toContain('document.hidden');
  });

  // TC-12C.07: Server Components utilized for top-level pages
  it('TC-12C.07: top-level pages (/trips, /offline, /achievements) are Server Component wrappers', () => {
    const tripsPagePath = path.join(rootDir, 'src', 'app', 'trips', 'page.tsx');
    expect(fs.readFileSync(tripsPagePath, 'utf-8')).not.toContain("'use client'");

    const offlinePagePath = path.join(rootDir, 'src', 'app', 'offline', 'page.tsx');
    expect(fs.readFileSync(offlinePagePath, 'utf-8')).not.toContain("'use client'");

    const achievementsPagePath = path.join(rootDir, 'src', 'app', 'achievements', 'page.tsx');
    expect(fs.readFileSync(achievementsPagePath, 'utf-8')).not.toContain("'use client'");
  });

  // TC-12C.08: Service worker employs Cache-First for static assets
  it('TC-12C.08: public/sw.js serves static assets with Cache-First strategy to reduce server network load', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content).toContain('isStaticAsset');
    expect(content).toContain('caches.match(request)');
  });
});
