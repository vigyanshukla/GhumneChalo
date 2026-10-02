# GhumneChalo — Complete Architecture, System Design & Progress Master Doc

> **Single Source of Truth (SSOT)**: This document summarizes the complete application architecture, APIs, data flows, database schemas, and all completed development phases to avoid redundant file reads and token waste.

---

## 1. Project Overview & Tech Stack

- **Framework**: Next.js 16.3.6 (Turbopack, App Router, React 19.2)
- **Styling**: Tailwind CSS v4, Vanilla CSS utilities, Dark/Light theme toggle
- **Database**: PostgreSQL (Prisma ORM v6.19.3)
- **Authentication**: Custom JWT Session Tokens via `jose` + Google OAuth (NextAuth v5 beta fallback)
- **Maps & Discovery**: Google Maps JavaScript API + Google Places Autocomplete + Open-Meteo Weather API
- **Push & Offline PWA**: Web Push (`web-push` + VAPID), Service Worker (`/public/sw.js`), IndexedDB offline snapshots (`idb`), Client Cache (`localStorage` + Stale-While-Revalidate)
- **Deployment**: Vercel Serverless (`https://ghumne-chalo.vercel.app/`)

---

## 2. Key Directories & File Architecture

```
d:\ghumnechalo
├── public/
│   ├── sw.js                 # Service worker (push notifications, offline cache, 7s timeout)
│   ├── manifest.json         # PWA Manifest
│   ├── og-image.png          # 1200x630 OpenGraph / Twitter social banner
│   ├── logo-transparent.png  # App logo
│   └── icons/                # PWA icons (192x192, 512x512, badge-72)
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout, ThemeProvider, RouteProgressBar, PWARegistration, SEO metadata
│   │   ├── loading.tsx       # Root instant skeleton loader for zero-freeze transitions
│   │   ├── globals.css       # Core tokens, touch-action: manipulation, tap delay removal
│   │   ├── page.tsx          # Public Landing page (redirects to /home if authenticated)
│   │   ├── home/page.tsx     # Authenticated traveler dashboard
│   │   ├── trips/            # Trip management list & [tripId] detail (Itinerary, Transportation, Weather, Packing, Budget)
│   │   ├── explore/          # Interactive map, directions, route polyline, discovery places
│   │   ├── reminders/        # Departure countdowns, custom alerts, email/push reminders
│   │   ├── achievements/     # Travel milestone badges & progress tracking
│   │   ├── emergency/        # Nearby police/hospital/pharmacy finder & offline emergency numbers
│   │   ├── notifications/    # In-app notifications feed & push toggle
│   │   ├── profile/          # User profile management & avatar
│   │   ├── login/ & register/# Authentication flows, OTP email verification, 2FA
│   │   └── api/              # Serverless backend endpoints
│   ├── components/
│   │   ├── navigation/       # AppNav (DesktopNav + MobileBottomNav with optimistic tabs), RouteProgressBar
│   │   ├── home/             # HomeDashboard (optimized with single-fetch lifecycle)
│   │   ├── trips/            # TripCard, TripForm, TripsDashboard, DeleteTripModal
│   │   ├── itinerary/        # Day itinerary items, timeline, reordering, activities
│   │   ├── maps/             # GoogleMap, MapMarker, MapRoutePolyline, UserLocationMarker
│   │   ├── explore/          # PopularDestinations, DiscoveryFeed, RouteCard
│   │   ├── emergency/        # EmergencyDashboard, EmergencyPlaceCard, OfflineContacts
│   │   ├── notifications/    # NotificationBell, NotificationPreferencesModal
│   │   ├── pwa/              # PWARegistration banner
│   │   └── theme/            # ThemeProvider, ThemeToggle
│   └── lib/
│       ├── auth-server.ts    # Server-side auth session verification with in-memory userCache
│       ├── session.ts        # Cryptographic JWT creation and verification (jose HS256)
│       ├── prisma.ts         # Singleton PrismaClient instance
│       ├── cache/
│       │   └── client-cache.ts # SWR client cache, in-flight deduplication, 8s fetch timeout
│       ├── offline/
│       │   ├── offline-storage.ts # IndexedDB snapshots for trips & emergency contacts
│       │   └── use-network-status.ts # Online/Offline network state hook
│       ├── push/             # Web Push subscription management & VAPID key handling
│       ├── maps/             # Directions API, Places Search, Route Polyline decoder
│       └── ai/               # Gemini AI trip itinerary generator
```

---

## 3. Completed Phases & Features Summary

| Phase | Module | Status | Highlights |
|---|---|---|---|
| **Phase 1-4** | Auth & Core Trips | Completed | Email/password, Google OAuth, 2FA, CRUD trips, dates, budgets |
| **Phase 5** | Itineraries | Completed | Multi-day itineraries, custom activities, timeline ordering |
| **Phase 6** | Transportation | Completed | Flights, trains, buses, car rentals, cost tracking |
| **Phase 7** | Weather | Completed | Open-Meteo live weather forecasts, packing recommendations |
| **Phase 8** | AI Planner | Completed | Gemini AI itinerary generation & smart schedule auto-apply |
| **Phase 9** | Reminders | Completed | Real-time countdowns, custom notifications, daily cron jobs |
| **Phase 10A** | Packing Assistant | Completed | Smart packing checklist, categorized items, progress bar |
| **Phase 10B** | Achievements | Completed | Traveler milestone badges (Explorer, GlobeTrotter, etc.) |
| **Phase 10C** | Emergency | Completed | Nearby emergency services, 112/100/108 offline quick-dial |
| **Phase 11** | Notifications | Completed | In-app feed, unread counter badge, Web Push with VAPID |
| **Phase 12** | PWA & Offline | Completed | Service Worker v1.3.0, IndexedDB snapshots, offline banner |
| **Phase 13** | Explore & Maps | Completed | Google Maps directions, travel modes, route polylines, discovery |
| **Phase 14** | Data Optimization | Completed | SWR caching, request deduplication, memory tab cache |
| **Phase 15** | Production Release | Completed | Vercel deployment, daily cron, OG tags, responsive design |

---

## 4. Critical Performance Bug Fixes (Phase 16)

1. **Fixed Infinite Re-render Loop on `/home`**:
   - `HomeDashboard.tsx` previously had `[user, reloadTrigger]` in its `useEffect` while calling `setUser()` inside it. This created an infinite fetch/re-render loop consuming 100% CPU and triggering "Page Not Responsive".
   - **Resolution**: Removed `user` from dependencies, added identity check `prev.id === profileData.id`, and stabilized on `[reloadTrigger]`.
2. **Fixed Google Maps DOM Thrashing in `MapMarker.tsx`**:
   - `MapMarker.tsx` previously ran `markerRef.current.setMap(null)` on every re-render because of inline object dependencies.
   - **Resolution**: Delegated click listener via `onClickRef`, updated marker coordinates in-place (`setPosition()`), and only detached from map on component unmount.
3. **Throttled Google Maps ResizeObserver**:
   - `GoogleMap.tsx` resize listener is now throttled via `requestAnimationFrame` and `center` object references are stabilized (`[center.lat, center.lng]`).
4. **Instant SWR Caching & Fetch Timeouts**:
   - `cachedFetch()` returns stored data in **0ms** even if stale, and revalidates in the background. Added an 8-second `AbortController` timeout so stalled requests never freeze the UI.
5. **Eliminated Mobile 300ms Tap Delay**:
   - Added `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` to `globals.css`.
   - Added tactile feedback (`active:scale-90`) and optimistic tab switching in `AppNav.tsx`.
6. **Instant Navigation Progress**:
   - Added `RouteProgressBar.tsx` and `loading.tsx` so route clicks show immediate progress indicators.

---

## 5. Environment Variables Reference

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_URL="https://ghumne-chalo.vercel.app"
NEXTAUTH_SECRET="..."
AUTH_SECRET="..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:support@ghumnechalo.com"
GEMINI_API_KEY="..."
CRON_SECRET="..."
```
