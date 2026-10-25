/**
 * Google Maps JavaScript API Loader
 * 
 * Provides a client-safe singleton promise loader for the Google Maps JavaScript API.
 * Ensures:
 * - Single script tag injection across all components
 * - React 19 / StrictMode resilience
 * - gm_authFailure detection
 * - Clear error states without exposing credentials
 */

export type GoogleMapsLoadError =
  | 'MISSING_API_KEY'
  | 'SCRIPT_LOAD_ERROR'
  | 'AUTH_FAILURE'
  | 'TIMEOUT';

let loadPromise: Promise<typeof google.maps> | null = null;
let authFailureDetected = false;

// Global listener for Google Maps authentication failures
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).gm_authFailure = () => {
    authFailureDetected = true;
    console.error('[Google Maps] Authentication failure: The provided API key or project configuration was rejected.');
  };
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.maps?.Map === 'function';
}

export function loadGoogleMaps(apiKey?: string): Promise<typeof google.maps> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in a browser environment.'));
  }

  // If already globally loaded, resolve immediately
  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google.maps);
  }

  // Return existing singleton promise if in flight
  if (loadPromise) {
    return loadPromise;
  }

  const resolvedKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!resolvedKey || resolvedKey.trim() === '') {
    return Promise.reject(new Error('MISSING_API_KEY'));
  }

  loadPromise = new Promise<typeof google.maps>((resolve, reject) => {
    // Check if script element already exists in document
    const existingScript = document.querySelector('script[data-google-maps-loader="true"]') as HTMLScriptElement | null;

    if (existingScript) {
      if (isGoogleMapsLoaded()) {
        resolve(window.google.maps);
        return;
      }
      existingScript.addEventListener('load', () => {
        if (isGoogleMapsLoaded()) {
          resolve(window.google.maps);
        } else {
          reject(new Error('SCRIPT_LOAD_ERROR'));
        }
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('SCRIPT_LOAD_ERROR'));
      });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(resolvedKey.trim())}&v=weekly&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';

    const timeoutId = setTimeout(() => {
      if (!isGoogleMapsLoaded()) {
        loadPromise = null;
        reject(new Error('TIMEOUT'));
      }
    }, 15000);

    script.onload = () => {
      clearTimeout(timeoutId);
      if (authFailureDetected) {
        loadPromise = null;
        reject(new Error('AUTH_FAILURE'));
        return;
      }
      if (isGoogleMapsLoaded()) {
        resolve(window.google.maps);
      } else {
        loadPromise = null;
        reject(new Error('SCRIPT_LOAD_ERROR'));
      }
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      loadPromise = null;
      reject(new Error('SCRIPT_LOAD_ERROR'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Reset helper for testing
 */
export function _resetLoaderForTesting(): void {
  loadPromise = null;
  authFailureDetected = false;
  if (typeof document !== 'undefined') {
    const existing = document.querySelector('script[data-google-maps-loader="true"]');
    existing?.remove();
  }
}
