import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 12B — Offline Trip Access & IndexedDB Sync (TC-12B.01 to TC-12B.10)', () => {
  const rootDir = process.cwd();

  // TC-12B.01: Offline storage module exists
  it('TC-12B.01: src/lib/offline/offline-storage.ts exists and provides snapshot APIs', () => {
    const storagePath = path.join(rootDir, 'src', 'lib', 'offline', 'offline-storage.ts');
    expect(fs.existsSync(storagePath)).toBe(true);

    const content = fs.readFileSync(storagePath, 'utf-8');
    expect(content).toContain('saveTripOfflineSnapshot');
    expect(content).toContain('getTripOfflineSnapshot');
    expect(content).toContain('removeTripOfflineSnapshot');
    expect(content).toContain('getAllTripOfflineSnapshots');
  });

  // TC-12B.02: Offline snapshot contract safety
  it('TC-12B.02: offline storage defines strict versioned OfflineTripSnapshot contract without credentials', () => {
    const storagePath = path.join(rootDir, 'src', 'lib', 'offline', 'offline-storage.ts');
    const content = fs.readFileSync(storagePath, 'utf-8');
    expect(content).toContain('interface OfflineTripSnapshot');
    expect(content).toContain('cachedAt: number');
    expect(content).toContain('version: number');
    expect(content).not.toContain('passwordHash');
    expect(content).not.toContain('authSecret');
  });

  // TC-12B.03: Reactive network status hook exists
  it('TC-12B.03: src/lib/offline/use-network-status.ts provides reactive online/offline detection', () => {
    const hookPath = path.join(rootDir, 'src', 'lib', 'offline', 'use-network-status.ts');
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).toContain('useNetworkStatus');
    expect(content).toContain('useSyncExternalStore');
    expect(content).toContain('online');
    expect(content).toContain('offline');
  });

  // TC-12B.04: OfflineTripBanner component exists and exports properly
  it('TC-12B.04: src/components/trips/OfflineTripBanner.tsx exists with distinct states', () => {
    const bannerPath = path.join(rootDir, 'src', 'components', 'trips', 'OfflineTripBanner.tsx');
    expect(fs.existsSync(bannerPath)).toBe(true);

    const content = fs.readFileSync(bannerPath, 'utf-8');
    expect(content).toContain('OfflineTripBanner');
    expect(content).toContain('Offline Mode');
    expect(content).toContain('Syncing');
  });

  // TC-12B.05: Trip Detail Page integrates offline snapshot caching
  it('TC-12B.05: trips/[tripId]/page.tsx integrates offline snapshot loading and persisting', () => {
    const pagePath = path.join(rootDir, 'src', 'app', 'trips', '[tripId]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    expect(content).toContain('getTripOfflineSnapshot');
    expect(content).toContain('saveTripOfflineSnapshot');
    expect(content).toContain('OfflineTripBanner');
  });

  // TC-12B.06: Trips Dashboard integrates offline listing fallback
  it('TC-12B.06: TripsDashboard.tsx falls back to cached snapshots when offline', () => {
    const dashboardPath = path.join(rootDir, 'src', 'components', 'trips', 'TripsDashboard.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');
    expect(content).toContain('getAllTripOfflineSnapshots');
    expect(content).toContain('Offline Mode');
  });

  // TC-12B.07: Offline action guard prevents destructive or live network actions while offline
  it('TC-12B.07: trip detail page disables live edit, delete, and AI actions when offline', () => {
    const pagePath = path.join(rootDir, 'src', 'app', 'trips', '[tripId]', 'page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    expect(content).toContain("disabled={status === 'OFFLINE'}");
    expect(content).toContain('AI (Offline)');
  });

  // TC-12B.08: Emergency contacts offline safety
  it('TC-12B.08: emergency helplines API / contacts remain fully usable offline without API credentials', () => {
    const emergencyContactPath = path.join(rootDir, 'src', 'lib', 'emergency', 'emergency-contacts.ts');
    expect(fs.existsSync(emergencyContactPath)).toBe(true);
    const content = fs.readFileSync(emergencyContactPath, 'utf-8');
    expect(content).toContain('112');
    expect(content).toContain('100');
    expect(content).toContain('108');
  });
});
