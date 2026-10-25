import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 12A — PWA Foundation & Service Worker (TC-12A.01 to TC-12A.08)', () => {
  const rootDir = process.cwd();

  // TC-12A.01: Manifest file existence and valid JSON
  it('TC-12A.01: public/manifest.json exists and is valid JSON', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, 'utf-8');
    const json = JSON.parse(content);
    expect(json.name).toBeDefined();
    expect(json.short_name).toBe('GhumneChalo');
    expect(json.start_url).toBe('/');
    expect(json.display).toBe('standalone');
  });

  // TC-12A.02: Manifest icons specification
  it('TC-12A.02: manifest defines required 192x192, 512x512, and maskable icons', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    expect(Array.isArray(json.icons)).toBe(true);
    const sizes = json.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const hasMaskable = json.icons.some((i: { purpose?: string }) => i.purpose === 'maskable');
    expect(hasMaskable).toBe(true);
  });

  // TC-12A.03: Physical icon files exist in public directory
  it('TC-12A.03: physical icon asset files exist in public directory', () => {
    expect(fs.existsSync(path.join(rootDir, 'public', 'icon-192.png'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public', 'icon-512.png'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public', 'icon-maskable-512.png'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'public', 'badge-72.png'))).toBe(true);
  });

  // TC-12A.04: Unified Service Worker contains push + caching logic without competition
  it('TC-12A.04: public/sw.js contains Web Push handlers and PWA caching handlers', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    // Push events preserved
    expect(swContent).toContain("self.addEventListener('push'");
    expect(swContent).toContain("self.addEventListener('notificationclick'");
    expect(swContent).toContain('sanitizeDestination');

    // Caching logic present
    expect(swContent).toContain("self.addEventListener('fetch'");
    expect(swContent).toContain("self.addEventListener('install'");
    expect(swContent).toContain("self.addEventListener('activate'");
    expect(swContent).toContain('caches.open');
  });

  // TC-12A.05: Service worker includes offline fallback mechanism
  it('TC-12A.05: public/sw.js includes navigation fallback to /offline', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("request.mode === 'navigate'");
    expect(swContent).toContain("caches.match('/offline')");
  });

  // TC-12A.06: Offline fallback page exists and exports React component
  it('TC-12A.06: src/app/offline/page.tsx exists and is a valid Next.js route', () => {
    const offlinePagePath = path.join(rootDir, 'src', 'app', 'offline', 'page.tsx');
    expect(fs.existsSync(offlinePagePath)).toBe(true);

    const content = fs.readFileSync(offlinePagePath, 'utf-8');
    expect(content).toContain('OfflinePage');
  });

  // TC-12A.07: Root Layout links manifest, appleWebApp, and PWARegistration
  it('TC-12A.07: src/app/layout.tsx references manifest and PWARegistration', () => {
    const layoutPath = path.join(rootDir, 'src', 'app', 'layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf-8');
    expect(content).toContain('manifest: "/manifest.json"');
    expect(content).toContain('appleWebApp');
    expect(content).toContain('PWARegistration');
  });

  // TC-12A.08: Sensitive API endpoints are not blindly cached by Service Worker
  it('TC-12A.08: Service worker explicitly isolates /api/ routes from blind static caching', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("url.pathname.startsWith('/api/')");
    expect(swContent).toContain('NETWORK_OFFLINE');
  });
});
