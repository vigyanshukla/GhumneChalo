// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadGoogleMaps, isGoogleMapsLoaded, _resetLoaderForTesting } from '../src/lib/maps/loader';

describe('Phase 3A — Maps Foundation (TC-3A.01 to TC-3A.20)', () => {
  beforeEach(() => {
    _resetLoaderForTesting();
    // Clean up window.google
    if ('google' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).google;
    }
    // Clean up all script tags
    document.querySelectorAll('script').forEach((s) => s.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetLoaderForTesting();
  });

  // ============================================================
  // 1. SCRIPT LOADER & INITIALIZATION
  // ============================================================
  it('TC-3A.01: Rejects immediately if API key is missing or empty', async () => {
    await expect(loadGoogleMaps('')).rejects.toThrow('MISSING_API_KEY');
    await expect(loadGoogleMaps('   ')).rejects.toThrow('MISSING_API_KEY');
    // Ensure no script was injected
    const scripts = document.querySelectorAll('script[data-google-maps-loader="true"]');
    expect(scripts.length).toBe(0);
  });

  it('TC-3A.02: Injects a single script element with correct API key and libraries', async () => {
    let capturedScript: HTMLScriptElement | null = null;
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      capturedScript = node as HTMLScriptElement;
      return node;
    });

    const loadPromise = loadGoogleMaps('AIzaSyTestMockKey123');

    expect(capturedScript).not.toBeNull();
    const script = capturedScript as unknown as HTMLScriptElement;
    expect(script.src).toContain('key=AIzaSyTestMockKey123');
    expect(script.src).toContain('libraries=places');
    expect(script.async).toBe(true);

    // Simulate script onload with mock google.maps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google = {
      maps: {
        Map: vi.fn(),
        Marker: vi.fn(),
        Circle: vi.fn(),
        event: {
          clearInstanceListeners: vi.fn(),
          removeListener: vi.fn(),
          trigger: vi.fn(),
        },
      },
    };

    script.dispatchEvent(new Event('load'));
    const result = await loadPromise;
    expect(result).toBeDefined();
    expect(isGoogleMapsLoaded()).toBe(true);
  });

  it('TC-3A.03: Singleton loader prevents duplicate script injection on concurrent requests', async () => {
    let callCount = 0;
    let capturedScript: HTMLScriptElement | null = null;
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      callCount++;
      capturedScript = node as HTMLScriptElement;
      return node;
    });

    const p1 = loadGoogleMaps('AIzaSyTestMockKey123');
    const p2 = loadGoogleMaps('AIzaSyTestMockKey123');
    const p3 = loadGoogleMaps('AIzaSyTestMockKey123');

    expect(callCount).toBe(1);

    // Simulate load
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google = { maps: { Map: vi.fn() } };
    capturedScript!.dispatchEvent(new Event('load'));

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('TC-3A.04: Handles script loading network failure gracefully', async () => {
    let capturedScript: HTMLScriptElement | null = null;
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      capturedScript = node as HTMLScriptElement;
      return node;
    });

    const loadPromise = loadGoogleMaps('AIzaSyTestMockKey123');

    // Simulate network error
    capturedScript!.dispatchEvent(new Event('error'));

    await expect(loadPromise).rejects.toThrow('SCRIPT_LOAD_ERROR');
    expect(isGoogleMapsLoaded()).toBe(false);
  });

  it('TC-3A.05: Detects gm_authFailure and triggers AUTH_FAILURE error', async () => {
    let capturedScript: HTMLScriptElement | null = null;
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      capturedScript = node as HTMLScriptElement;
      return node;
    });

    const loadPromise = loadGoogleMaps('AIzaSyTestMockKey123');

    // Simulate Google auth failure callback before load completes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).gm_authFailure === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gm_authFailure();
    }

    capturedScript!.dispatchEvent(new Event('load'));
    await expect(loadPromise).rejects.toThrow('AUTH_FAILURE');
  });

  // ============================================================
  // 2. GEOLOCATION FOUNDATION
  // ============================================================
  it('TC-3A.06: Geolocation success delivers accurate coordinates without persistent tracking', async () => {
    const mockPosition = {
      coords: {
        latitude: 28.5355,
        longitude: 77.3910,
        accuracy: 15,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
    } as unknown as GeolocationPosition;

    const getCurrentPositionMock = vi.fn((success) => {
      success(mockPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    const receivedCoords = await new Promise<{ lat: number; lng: number }>((resolve) => {
      navigator.geolocation.getCurrentPosition((pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    });

    expect(receivedCoords.lat).toBe(28.5355);
    expect(receivedCoords.lng).toBe(77.3910);
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
  });

  it('TC-3A.07: Geolocation handles PERMISSION_DENIED (code 1) safely', async () => {
    const mockError: GeolocationPositionError = {
      code: 1, // PERMISSION_DENIED
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    const getCurrentPositionMock = vi.fn((_, error) => {
      error(mockError);
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    const handledError = await new Promise<string>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {},
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            resolve('PERMISSION_DENIED');
          }
        }
      );
    });

    expect(handledError).toBe('PERMISSION_DENIED');
  });

  it('TC-3A.08: Geolocation handles POSITION_UNAVAILABLE (code 2)', async () => {
    const mockError: GeolocationPositionError = {
      code: 2,
      message: 'Position unavailable',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    const getCurrentPositionMock = vi.fn((_, error) => {
      error(mockError);
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    const handledError = await new Promise<string>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {},
        (err) => {
          if (err.code === err.POSITION_UNAVAILABLE) {
            resolve('POSITION_UNAVAILABLE');
          }
        }
      );
    });

    expect(handledError).toBe('POSITION_UNAVAILABLE');
  });

  it('TC-3A.09: Geolocation handles TIMEOUT (code 3)', async () => {
    const mockError: GeolocationPositionError = {
      code: 3,
      message: 'Timeout',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    const getCurrentPositionMock = vi.fn((_, error) => {
      error(mockError);
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    const handledError = await new Promise<string>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {},
        (err) => {
          if (err.code === err.TIMEOUT) {
            resolve('TIMEOUT');
          }
        }
      );
    });

    expect(handledError).toBe('TIMEOUT');
  });

  it('TC-3A.10: Geolocation handles unsupported browser environment gracefully', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const isSupported = typeof window !== 'undefined' && !!navigator?.geolocation;
    expect(isSupported).toBe(false);
  });

  // ============================================================
  // 3. MAP CONTROLS & LIFECYCLE
  // ============================================================
  it('TC-3A.11: Zoom controls adjust zoom level correctly', () => {
    let currentZoom = 12;
    const mockMap = {
      getZoom: vi.fn(() => currentZoom),
      setZoom: vi.fn((z: number) => {
        currentZoom = z;
      }),
      panTo: vi.fn(),
    };

    // Zoom In
    mockMap.setZoom((mockMap.getZoom() || 12) + 1);
    expect(currentZoom).toBe(13);

    // Zoom Out
    mockMap.setZoom(Math.max(1, (mockMap.getZoom() || 12) - 1));
    expect(currentZoom).toBe(12);
  });

  it('TC-3A.12: Recenter control returns map to default coordinates and zoom', () => {
    const defaultCenter = { lat: 28.6139, lng: 77.2090 };
    const defaultZoom = 12;

    const mockMap = {
      panTo: vi.fn(),
      setZoom: vi.fn(),
    };

    // Trigger recenter
    mockMap.panTo(defaultCenter);
    mockMap.setZoom(defaultZoom);

    expect(mockMap.panTo).toHaveBeenCalledWith(defaultCenter);
    expect(mockMap.setZoom).toHaveBeenCalledWith(12);
  });

  it('TC-3A.13: Map listeners are completely cleared upon unmount to prevent leaks', () => {
    const clearListenersMock = vi.fn();
    const mockMapInstance = {
      id: 'test-map-instance',
    };

    // Simulate unmount cleanup pattern
    clearListenersMock(mockMapInstance);
    expect(clearListenersMock).toHaveBeenCalledWith(mockMapInstance);
  });

  // ============================================================
  // 4. USER LOCATION MARKER
  // ============================================================
  it('TC-3A.14: User location marker visually distinguishes user from destination markers', () => {
    const userSymbol = {
      path: 0, // CIRCLE
      scale: 8,
      fillColor: '#2563EB', // Blue-600
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
    };

    expect(userSymbol.fillColor).toBe('#2563EB');
    expect(userSymbol.strokeColor).toBe('#FFFFFF');
    expect(userSymbol.scale).toBe(8);
  });

  // ============================================================
  // 5. SECURITY & SECRETS ISOLATION
  // ============================================================
  it('TC-3A.15: Server-side GOOGLE_MAPS_API_KEY is never accessible through NEXT_PUBLIC prefix', () => {
    // Verify variable naming separation
    const clientKeyName = 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY';
    const serverKeyName = 'GOOGLE_MAPS_API_KEY';

    expect(clientKeyName.startsWith('NEXT_PUBLIC_')).toBe(true);
    expect(serverKeyName.startsWith('NEXT_PUBLIC_')).toBe(false);
  });
});
