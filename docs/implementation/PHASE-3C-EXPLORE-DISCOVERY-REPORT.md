# Phase 3C Explore & Discovery Report

## Executive Summary

Phase 3C has been successfully implemented and verified for **GhumneChalo**. This phase delivers an enterprise-grade **Explore & Discovery Experience** that enables users to browse, filter, and discover destinations and points of interest without being forced to type manual search queries.

The implementation builds directly upon the Phase 3A Google Maps foundation and Phase 3B Places Search & Autocomplete architecture, delivering complete Map ↔ List synchronization, data-driven category discovery, location-aware nearby exploration, and quick-pivot popular destinations.

All features strictly adhere to the Phase 3C boundary:
- **Implemented**: Data-driven category discovery, Places API (New) `places:searchNearby`, curated popular destination anchors, interactive PlaceCards with accurate geographic distance calculations, Map ↔ List bi-directional synchronization, stale request race-condition protection, responsive desktop split-view and mobile map/list views, loading skeletons, empty states, error retry handling, and comprehensive ARIA keyboard accessibility.
- **Strictly Excluded**: Saved Places (Phase 4), Save/Unsave buttons, Directions & Routes (Phase 5), Trip planning, AI Planner, Notifications, and PWA installation.

---

## Scope

### Included in Phase 3C
1. **Explore Page Experience**: Unified interface presenting search, categories, popular anchors, list feed, interactive map, and place details.
2. **Discovery Sections**: Curated popular destination pills and active category filtering.
3. **Popular Destinations**: Curated high-intent travel anchors (New Delhi, Jaipur, Mumbai, Goa, Agra, Varanasi, Manali, Bengaluru).
4. **Nearby Places**: Exploration around user or anchor coordinates using Google Places API (New) `searchNearby`.
5. **Category Discovery & Filtering**: 8 data-driven categories (Attractions, Restaurants, Cafes, Hotels, Museums, Parks, Shopping, Heritage).
6. **Place Cards**: Rich cards with categories, user ratings, review counts, formatted addresses, and Haversine distance calculations.
7. **Map/List Synchronization**: Single source of truth for `selectedPlace`; selecting in list centers map and highlights marker; clicking marker highlights list card and opens details.
8. **Place Selection & Details**: Seamless reuse of Phase 3B `PlaceDetailsCard` with phone, website, and operating hours.
9. **Location Strategy**: Explicit priority (User geolocated coords -> Curated destination anchor -> Default New Delhi fallback). Never forces geolocation on load.
10. **Responsive Design**: Desktop split-view (sidebar feed + persistent map) and mobile layout (full-screen map with bottom drawer and list toggle).
11. **Performance & API Cost Control**: 5-minute memory cache, tight FieldMask specification, 20-item paging limits, and stale request sequence tracking.

### Strictly Out of Scope
- Saved Places (Phase 4)
- Save/unsave actions or favorites toggling
- Travel modes, routing, and directions (Phase 5)
- Trip creation & itinerary management
- AI Trip Planner / Gemini LLM
- Notifications & PWA installation
- Budget, expenses, and gamified achievements

---

## Architecture

```
User Action (Select Category / Change Anchor / Click Search Result)
                             │
                             ▼
             State: category, location, anchor
                             │
            Stale Request Protection (Sequence ID)
                             │
                             ▼
        Next.js Route Handler (/api/places/discover)
      (Validates latitude [-90,90], longitude [-180,180],
       category key, and rate limits)
                             │
                             ▼
           Server Service (src/lib/maps/places.ts)
                             │
            In-Memory LRU/TTL Cache Check (5 min)
              [Key: discover:{category}:{lat}:{lng}:{radius}]
                             │
                             ▼
           Google Places API (New) [searchNearby]
         POST https://places.googleapis.com/v1/places:searchNearby
             │  (Protected Server Key: GOOGLE_MAPS_API_KEY)
             │  (Field Mask: places.id, places.displayName,
             │   places.formattedAddress, places.location,
             │   places.types, places.primaryType, places.rating,
             │   places.userRatingCount)
             ▼
        Normalized Server Response (NormalizedDiscoveryPlace[])
        + Haversine Distance Calculation (km)
                             │
                             ▼
              DiscoveryFeed State Update
                             │
       ┌─────────────────────┴─────────────────────┐
       ▼                                           ▼
PlaceCard Feed                                Google Map
- List of normalized places                   - Syncs all discovery markers
- Active selection ring                       - Centers viewport if desired
- Distance indicator ("2.4 km away")          - Interactive click to select
       │                                           │
       └─────────────────────┬─────────────────────┘
                             ▼
                 selectedPlace (Unified State)
                             │
                             ▼
                      PlaceDetailsCard
               (Address, phone, hours, website)
```

---

## Existing Components Reused

1. **`SearchBox` (`src/components/maps/SearchBox.tsx`)**:
   - Reused directly without modifications.
   - Primary direct-search flow seamlessly coordinates with Explore by updating the same `selectedPlace` state.
2. **`PlaceDetailsCard` (`src/components/maps/PlaceDetailsCard.tsx`)**:
   - Reused as the single authoritative place details viewer.
   - Bottom-docked on mobile, floating overlay card on desktop.
3. **`MapMarker` (`src/components/maps/MapMarker.tsx`)**:
   - Reused for rendering discovery markers and selected place pins with custom SVG glyphs.
4. **`MapControls` (`src/components/maps/MapControls.tsx`)**:
   - Geolocation trigger, map type toggles, and recenter actions reused seamlessly.
5. **`GoogleMap` (`src/components/maps/GoogleMap.tsx`)**:
   - Single unified Google Maps instance reused across the entire page. Zero duplicate map instances created.
6. **`RecentSearches` & `OftenSearched` (`src/components/maps/RecentSearches.tsx`, `OftenSearched.tsx`)**:
   - Preserved within `SearchBox` autocomplete dropdown for both guest and authenticated users.

---

## New Components

All new components reside in `src/components/explore/`:

1. **`src/components/explore/types.ts`**:
   - Contains definitions for `NormalizedDiscoveryPlace`, `DiscoveryCategoryKey`, `PopularDestination`, and the curated `POPULAR_DESTINATIONS` constants.
2. **`src/components/explore/CategoryFilterBar.tsx`**:
   - Accessible horizontal scroll container with category chips.
   - Supports keyboard arrow navigation (Left/Right), Enter/Space activation, and active styling.
   - Icons mapped using Lucide-React (`Compass`, `Utensils`, `Coffee`, `Hotel`, `Landmark`, `Trees`, `ShoppingBag`, `Sparkles`).
3. **`src/components/explore/PopularDestinations.tsx`**:
   - Quick-select pill row allowing users to jump discovery anchors between New Delhi, Jaipur, Mumbai, Goa, Agra, Varanasi, Manali, and Bengaluru.
4. **`src/components/explore/PlaceCard.tsx`**:
   - Rich card displaying place name, category badge, star rating with review count, formatted address, and computed distance indicator (`"X.X km away"`).
   - Fully keyboard accessible (`tabIndex={0}`, `Enter`/`Space` handlers, `role="button"`, `aria-selected`).
5. **`src/components/explore/DiscoveryFeed.tsx`**:
   - Manages category selection, anchor coordination, data fetching with stale response cancellation, loading skeleton cards, empty states with search triggers, and error states with retry buttons.
6. **`src/components/explore/index.ts`**:
   - Barrel export file for clean module imports.

---

## Discovery API

- **Endpoint**: `GET /api/places/discover`
- **Query Parameters**:
  - `category` (optional, default: `'attractions'`): Validated against `SUPPORTED_DISCOVERY_CATEGORIES`.
  - `lat` (optional, default: `28.6139` [New Delhi]): Validated number between `-90` and `90`.
  - `lng` (optional, default: `77.2090` [New Delhi]): Validated number between `-180` and `180`.
  - `radius` (optional, default: `10000`, max: `50000` meters): Search radius restriction.
- **Upstream Call**:
  - `POST https://places.googleapis.com/v1/places:searchNearby`
  - FieldMask: `places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount`
  - Body:
    ```json
    {
      "includedTypes": ["tourist_attraction", "historical_landmark"],
      "locationRestriction": {
        "circle": {
          "center": { "latitude": 28.6139, "longitude": 77.2090 },
          "radius": 10000
        }
      },
      "maxResultCount": 20
    }
    ```
- **Error Handling**:
  - Upstream 4xx/5xx errors are caught and transformed into sanitized `500 Internal Server Error` responses.
  - Server credentials (`GOOGLE_MAPS_API_KEY`) and raw stack traces are strictly stripped before reaching clients.

---

## Categories

Eight curated, data-driven categories are supported with direct mappings to Google Places API (New) types:

| Category Key | Label | Google Places (New) Types |
| :--- | :--- | :--- |
| `attractions` | Attractions | `tourist_attraction`, `historical_landmark` |
| `restaurants` | Restaurants | `restaurant`, `food` |
| `cafes` | Cafes | `cafe`, `coffee_shop` |
| `hotels` | Hotels | `hotel`, `lodging` |
| `museums` | Museums | `museum`, `art_gallery` |
| `parks` | Parks & Nature | `park`, `national_park`, `campground` |
| `shopping` | Shopping | `shopping_mall`, `department_store`, `market` |
| `heritage` | Spiritual & Heritage | `place_of_worship`, `hindu_temple`, `church`, `mosque` |

---

## Popular Destinations

To avoid arbitrary or random mock data, 8 deterministic travel destination anchors across India are provided as quick-switch pivots:

1. **New Delhi** (`28.6139, 77.2090`) — Default discovery anchor
2. **Jaipur** (`26.9124, 75.7873`)
3. **Mumbai** (`19.0760, 72.8777`)
4. **Goa** (`15.2993, 74.1240`)
5. **Agra** (`27.1767, 78.0081`)
6. **Varanasi** (`25.3176, 82.9739`)
7. **Manali** (`32.2432, 77.1892`)
8. **Bengaluru** (`12.9716, 77.5946`)

Switching anchors immediately re-centers the map and discovers nearby places around that specific destination.

---

## Nearby Places & Location Strategy

- **Zero Involuntary Geolocation**: The application **never** requests user coordinates on page load.
- **Priority Order**:
  1. Explicit user geolocation (triggered via the location button in `MapControls`).
  2. Selected destination anchor (from `PopularDestinations`).
  3. Default product fallback: New Delhi (`28.6139, 77.2090`).
- **Distance Calculation**:
  - Uses the true spherical Haversine formula (`calculateDistanceKm`).
  - Only displayed when an origin coordinate is available.
  - Formatted cleanly as `"X.X km away"` or `"< 100 m away"`.
  - Accurately labeled without fabricating driving travel times.

---

## Map/List Synchronization

- **Single Source of Truth**: `selectedPlace` state is hoisted to the page root (`src/app/explore/page.tsx`).
- **List -> Map**:
  - Clicking any `PlaceCard` updates `selectedPlace`, triggers `map.panTo({ lat, lng })`, opens `PlaceDetailsCard`, and sets the active marker highlight.
- **Map -> List**:
  - Clicking any marker on the map updates `selectedPlace`, scrolls the corresponding `PlaceCard` into view, and displays `PlaceDetailsCard`.
- **Selected Marker Distinctness**:
  - Unselected markers render as high-contrast emerald location pins (`#059669`).
  - The selected marker renders with an amber highlight pin (`#f59e0b`), a white dot, and an increased z-index (`zIndex: 999`).

---

## Stale Request Handling (Race-Condition Protection)

Rapidly toggling between categories (`Restaurants` -> `Attractions` -> `Cafes`) can cause slow out-of-order network responses to overwrite newer requests.
- **Mechanism**:
  - A monotonically increasing sequence counter (`fetchIdRef`) is incremented on every fetch start.
  - An `AbortController` aborts previous in-flight HTTP requests.
  - When the promise resolves, the response is discarded if `fetchIdRef.current !== currentFetchId`.
  - Verified explicitly by test `TC-3C.09`.

---

## Caching & API Cost Controls

- **In-Memory TTL Cache**:
  - Cache key: `discover:${category}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`
  - TTL: 5 minutes.
  - Cache prevents repeat Google Places billing during back-and-forth category browsing.
- **Tight Field Masking**:
  - Google Places API (New) charges by SKU tier. Discovery requests **only** basic fields (`places.id, places.displayName, places.formattedAddress, places.location, places.types, places.primaryType, places.rating, places.userRatingCount`).
  - Photo data and expensive detailed attributes are excluded from bulk discovery lists.
- **Result Capping**:
  - Discovery responses are capped at 20 places (`pageSize: 20`) to preserve mobile memory and rendering speed.

---

## Responsive Behavior

- **Desktop (>= 1024px)**:
  - 420px fixed sidebar containing search, destination pills, category filters, and scrollable `PlaceCard` list.
  - Right pane dedicated to full interactive Google Map with overlay `PlaceDetailsCard`.
- **Mobile (< 1024px)**:
  - Header with `SearchBox`.
  - Floating pill toggle button to switch between **List View** and **Map View**.
  - In Map view, `PlaceDetailsCard` docks seamlessly to the bottom viewport (`bottom-6`) with smooth dismiss (`X`).
  - Viewport verified at standard 390x844 dimensions with zero horizontal overflow.

---

## Accessibility

- **Keyboard Navigation**:
  - Category tabs navigate with Left/Right arrows and activate on Enter/Space.
  - Place cards are standard interactive elements (`tabIndex={0}`, `role="button"`, `aria-selected`).
- **Screen Reader Support**:
  - `aria-label` provided for icon-only action buttons.
  - Active category tab has `aria-selected="true"` and `role="tab"`.
  - Loading skeleton states marked with `aria-busy="true"` and `aria-label="Loading places"`.
- **Visible Focus**:
  - Prominent focus rings (`focus:ring-2 focus:ring-emerald-500`) across all interactive cards and chips.

---

## Security

- `GOOGLE_MAPS_API_KEY` is kept strictly server-side in API routes.
- Latitude and Longitude strictly bounded (`-90 <= lat <= 90`, `-180 <= lng <= 180`).
- Category keys checked against strict whitelist.
- Upstream Google Places API errors sanitized to generic messages before sending to client.
- No user credentials, tokens, or personal history leaked across requests.

---

## Database Impact

- **Zero Database Migrations Required**: Explore and discovery uses live Google Places API (New) proxied through the server and in-memory caching.
- PostgreSQL models (`User`, `Session`, `SearchHistory`, `Trip`, etc.) remained completely untouched.
- No database bloat from temporary discovery listings.

---

## Tests

### Phase 3C Test Suite (`tests/explore.test.ts`)
18 unit and integration tests covering:
- **TC-3C.01**: Valid category returns normalized places with coordinates and ratings.
- **TC-3C.02**: Invalid category rejected with 400 Bad Request.
- **TC-3C.03**: Invalid latitude (>90 or <-90) rejected with 400 Bad Request.
- **TC-3C.04**: Invalid longitude (>180 or <-180) rejected with 400 Bad Request.
- **TC-3C.05**: Missing location parameters gracefully fall back to default coordinates.
- **TC-3C.06**: Upstream Places API failure sanitized without leaking credentials.
- **TC-3C.07**: Empty upstream Places response handled gracefully.
- **TC-3C.08**: Category change triggers new request and updates results.
- **TC-3C.09**: Rapid category changes prevent stale responses from overwriting latest state.
- **TC-3C.10**: Selected place centers map and triggers coordinate pan.
- **TC-3C.11**: Selected marker updates visual state and zIndex.
- **TC-3C.12**: Switching anchors cleanly replaces old markers.
- **TC-3C.13**: Marker click updates selected place state.
- **TC-3C.14**: Search selection uses same selected-place state.
- **TC-3C.15**: Explore place selection opens PlaceDetailsCard.
- **TC-3C.16**: Guest users can discover places without authentication.
- **TC-3C.17**: Identical discovery queries reuse cache without duplicate upstream fetch.
- **TC-3C.18**: Server API key is never exposed in response body or headers.

### Regression Test Suite
- `tests/maps.test.ts`: 15/15 tests PASS.
- `tests/search.test.ts`: 15/15 tests PASS.
- Total test suite: 111+ tests PASS.

---

## Manual Verification Matrix

| Check | Desktop Viewport | Mobile Viewport (390x844) | Status |
| :--- | :--- | :--- | :--- |
| Explore Page Loads | Yes | Yes | PASS |
| SearchBox Functionality | Yes | Yes | PASS |
| Category Filter Rendering & Switching | Yes | Yes (Horizontal scroll) | PASS |
| Popular Destination Anchors | Yes | Yes (Horizontal scroll) | PASS |
| Place Cards Rendering | Yes (Sidebar) | Yes (List View) | PASS |
| Distance Indicator | Yes (`X.X km away`) | Yes (`X.X km away`) | PASS |
| Map Markers Display | Yes | Yes (Map View) | PASS |
| Marker Click Selection | Yes | Yes | PASS |
| PlaceCard Click Selection | Yes | Yes | PASS |
| PlaceDetailsCard Presentation | Overlay card | Bottom-docked drawer | PASS |
| Loading Skeleton States | Yes | Yes | PASS |
| Error State & Retry Button | Yes | Yes | PASS |
| No Horizontal Overflow | Yes | Yes | PASS |

---

## Browser Verification

Browser verification was conducted using the integrated browser subagent on both Desktop and Mobile viewports against the live development server on `http://localhost:3000/explore`.

### Artifacts Captured
1. **Desktop Initial Explore**: `desktop_initial_explore_1790460734178.png`
   - Split view showing attractions in New Delhi, category chips, popular destination anchors, and map markers.
2. **Desktop Place Selection**: `desktop_place_selected_1790460760195.png`
   - Selection of a restaurant card, active card highlight, map marker highlighting, and `PlaceDetailsCard` open over the map.
3. **Desktop Anchor Switching**: `desktop_jaipur_explore_1790460782479.png`
   - Discovery anchored to Jaipur, showing local tea houses, cafes, and updated map markers.
4. **Mobile List View (390x844)**: `mobile_list_view_1790460838957.png`
   - Responsive feed with horizontally scrollable categories, full-width PlaceCards, and floating map toggle.
5. **Mobile Map View (390x844)**: `mobile_map_view_1790460997944.png`
   - Full-screen interactive map with floating controls and floating list toggle button.
6. **Full Session Recording**: `phase3c_explore_demo_1790460704422.webp`
   - Complete animated workflow recording showing category switching, place card selection, and responsive layout toggling.

---

## Files Changed

### Created
- `src/app/api/places/discover/route.ts`: API route for discovery.
- `src/components/explore/types.ts`: Type definitions and constants.
- `src/components/explore/CategoryFilterBar.tsx`: Accessible category tabs.
- `src/components/explore/PopularDestinations.tsx`: Curated anchor destination pills.
- `src/components/explore/PlaceCard.tsx`: Interactive place card component.
- `src/components/explore/DiscoveryFeed.tsx`: Data-fetching feed and list management.
- `src/components/explore/index.ts`: Barrel export.
- `tests/explore.test.ts`: Complete Phase 3C test suite (18 test cases).
- `docs/implementation/PHASE-3C-EXPLORE-DISCOVERY-REPORT.md`: This report.

### Modified
- `src/lib/maps/places.ts`: Added `discoverPlaces`, `calculateDistanceKm`, `formatDistance`, `SUPPORTED_DISCOVERY_CATEGORIES`, and `NormalizedDiscoveryPlace`.
- `src/app/explore/page.tsx`: Rewritten to integrate desktop split-view, mobile toggle, live discovery markers, and shared `selectedPlace` state.

---

## Known Issues

- None. All quality gates (TypeScript, ESLint, Vitest, Next.js build) pass with 0 errors.

---

## Phase 3C Status

**STATUS: PASS**

All acceptance criteria and Definition of Done requirements for Phase 3C have been met. The system is in a stable, fully verified state. Phase 3D (Routes & Directions) is ready to begin when authorized.
