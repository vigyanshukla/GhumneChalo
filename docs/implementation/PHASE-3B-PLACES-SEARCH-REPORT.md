# Phase 3B Places Search Report

## Executive Summary

Phase 3B has been successfully implemented and verified for **GhumneChalo**. This phase delivers an enterprise-grade, server-backed **Places Search, Autocomplete & Search History** system fully integrated with the Phase 3A Google Maps foundation.

All features strictly observe the Phase 3B boundary:
- **Implemented**: Real Google Places API (New) search, debounced autocomplete suggestions, normalized place details, map centering & selected marker synchronization, search history persistence, recent searches, often searched ranking, user isolation, guest search support, keyboard accessibility, and responsive desktop/mobile UX.
- **Strictly Excluded**: Saved Places (Phase 4), Save/Unsave buttons, Directions & Routes (Phase 5), Trip planning, AI Planner, Notifications, and PWA installation.

---

## Architecture

```
User Input
    │
    ▼
Client Debounce (350ms)
    │
    ▼
Next.js Route Handler (/api/places/search?q=...)
    │
    ▼
Server Places Service (src/lib/maps/places.ts)
    │
    ▼
Google Places API (New) [places:searchText]
    │ (Protected Server Key: GOOGLE_MAPS_API_KEY)
    │ (Field Mask: id, displayName, formattedAddress, location, types, primaryType, rating, userRatingCount)
    ▼
Normalized Search Response (NormalizedPlace[])
    │
    ▼
Client State & Autocomplete Dropdown
    │
    ▼
User Selects Place
    ├── 1. Center Map & Update Zoom (map.panTo, map.setZoom)
    ├── 2. Render Selected Place Marker (MapMarker)
    ├── 3. Open Place Details Card (/api/places/[placeId])
    └── 4. Persist Search History:
            ├── Authenticated: POST /api/search/recent -> PostgreSQL (search_history)
            └── Guest: Persist to localStorage (ghumnechalo_guest_recent_searches)
```

---

## Search Flow & Debouncing

1. **User Types**:
   - As the user types in `<SearchInput />`, queries under 2 characters or whitespace-only inputs are ignored without firing external network requests.
   - Input updates immediately in the UI with an accessible clear button (`X`).
2. **Debounce (350ms)**:
   - A 350ms debounce timer prevents excessive API queries.
   - Consecutive keystrokes clear pending timers.
3. **Execution**:
   - The client invokes `GET /api/places/search?q={query}&limit=8`.
   - The route handler validates and sanitizes the query, enforces max character bounds (120 chars), checks the 5-minute memory cache, and queries Google Places API (New).

---

## Places API Integration (New)

- **Search Endpoint**: `POST https://places.googleapis.com/v1/places:searchText`
  - Headers:
    - `X-Goog-Api-Key`: `GOOGLE_MAPS_API_KEY` (server-side only)
    - `X-Goog-FieldMask`: `places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.rating,places.userRatingCount`
  - Caching: 5-minute TTL in-memory cache to minimize Google Cloud billing and latency.
- **Place Details Endpoint**: `GET https://places.googleapis.com/v1/places/{placeId}`
  - Headers:
    - `X-Goog-Api-Key`: `GOOGLE_MAPS_API_KEY`
    - `X-Goog-FieldMask`: `id,displayName,formattedAddress,location,types,primaryType,rating,userRatingCount,nationalPhoneNumber,websiteUri,regularOpeningHours`
  - Caching: 15-minute TTL in-memory cache.
- **Data Normalization**:
  Google API responses are transformed into clean, stable internal models (`NormalizedPlace`, `NormalizedPlaceDetails`):
  ```typescript
  export interface NormalizedPlace {
    placeId: string;
    name: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    primaryType?: string;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
  }
  ```
  Raw Google API responses and credentials never leak to the client or error logs.

---

## Autocomplete & Keyboard Accessibility

- **Semantics**:
  - `role="combobox"` on the search input
  - `aria-autocomplete="list"`
  - `aria-expanded={isOpen}`
  - `aria-controls="search-suggestions-listbox"`
  - `aria-activedescendant={suggestion-{index}}`
  - `role="listbox"` and `role="option"` with `aria-selected`
- **Keyboard Navigation**:
  - `ArrowDown`: Moves selection forward through suggestions.
  - `ArrowUp`: Moves selection backward through suggestions.
  - `Enter`: Selects the currently highlighted suggestion.
  - `Escape`: Closes the suggestions list and clears active index.
  - `Tab`: Closes suggestions and allows natural focus traversal.
- **Touch & Mobile**:
  - Minimum 48px touch targets for inputs, clear buttons, and list options.

---

## Map Synchronization & Place Selection

When a user selects a suggestion:
1. **Existing Map Instance Reused**: The map instance from `GoogleMap` (`mapRef.current`) is panned using `map.panTo({ lat, lng })` and zoomed to level `15`. No duplicate map instances or script reloads occur.
2. **Selected Place Marker**: A high-visibility `<MapMarker />` with `zIndex={100}` is rendered at the selected coordinates. Clicking the marker re-centers the map.
3. **Place Details Card**:
   - Displays place name, category pill, formatted address, rating stars with review counts, open/closed status, phone link, and website link.
   - Includes "Center on Map" button and close dismiss button.
   - Closing the search panel or clicking outside does NOT remove the map marker or details card.

---

## Search History & User Isolation

- **Persistence**:
  - Database table: `search_history` (Prisma model).
  - Unique constraint: `@@unique([userId, query])`.
  - On place selection, `POST /api/search/recent` records the query, place name, place ID, and coordinates.
  - Deduplication: If a user searches the same query again, `searchCount` increments (`{ increment: 1 }`) and `searchedAt` updates to `new Date()`. No duplicate database rows are created.
- **User Isolation**:
  - `requireAuth(request)` derives identity strictly from JWT / session token or headers.
  - Body `userId` is strictly ignored to eliminate IDOR / identity-spoofing vulnerabilities.
  - User A cannot view, access, or delete User B's search history.
- **Recent Searches**:
  - Ordered by `searchedAt: 'desc'`, limit 6.
  - Displays clock icon, place name, and quick-select interaction.
  - "Clear" button invokes `DELETE /api/search/history` to remove only the authenticated user's records.

---

## Often Searched Ranking Algorithm

Implemented in `src/app/api/search/often/route.ts`:
- Retrieves up to 100 historical searches for the authenticated user.
- Scores each destination using combined frequency and exponential recency decay:
  $$\text{score} = (\text{searchCount} \times 2) + \left(\frac{1}{1 + \text{daysOld} \times 0.1}\right) \times 5$$
- Sorts descending by score and takes the top results.
- Rendered as accessible quick-filter pills in `<OftenSearched />`.
- If no searches exist yet, cleanly hides without displaying fake hardcoded cities.

---

## Guest Behavior

- Unauthenticated guests can freely search all destinations via `/api/places/search`.
- Guest recent searches are stored in browser `localStorage` (`ghumnechalo_guest_recent_searches`) up to 10 items.
- Selecting a place centers the map, places the marker, and loads place details identically to authenticated users.
- No dummy user accounts are created in PostgreSQL for guests.

---

## Security Audit

| Check | Status | Verification Detail |
|---|---|---|
| Server API Key Protection | PASS | `GOOGLE_MAPS_API_KEY` is loaded server-side only in `places.ts` |
| Client Key Scope | PASS | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` used solely for Maps JS SDK |
| No Credential Leaks | PASS | Error handler sanitizes all Google upstream errors; no keys returned |
| User Isolation | PASS | Verified by `TC-3B.11` & `TC-1.27`. User A cannot view User B history |
| IDOR Prevention | PASS | Verified by `TC-3B.13`. Body `userId` is completely ignored |
| Input Sanitization | PASS | Query length validated (2-120 chars); regex check on `placeId` |
| DB Safety | PASS | Zero schema changes needed; existing `search_history` schema reused |

---

## Test Verification

### 1. Phase 3B Test Suite (`tests/search.test.ts`)
15 new unit and integration tests covering all requirements:

| Test ID | Description | Status |
|---|---|---|
| **TC-3B.01** | Empty or whitespace query returns empty array without API call | PASS |
| **TC-3B.02** | Queries under minimum length (<2 chars) return empty array | PASS |
| **TC-3B.03** | Valid query calls Google Places API (New) with correct endpoint & field mask | PASS |
| **TC-3B.04** | Search results are safely cached in memory for identical queries | PASS |
| **TC-3B.05** | Upstream Google Places API error is handled safely without leaking credentials | PASS |
| **TC-3B.06** | Rejects malformed or suspicious placeId with 400 Bad Request | PASS |
| **TC-3B.07** | Returns normalized place details for valid placeId | PASS |
| **TC-3B.08** | Non-existent place returns 404 Not Found | PASS |
| **TC-3B.09** | Authenticated user saves search history on place selection | PASS |
| **TC-3B.10** | Duplicate searches increment searchCount without duplicate rows | PASS |
| **TC-3B.11** | User Isolation: User B cannot view or access User A search history | PASS |
| **TC-3B.12** | Unauthenticated user cannot access or modify server search history | PASS |
| **TC-3B.13** | Forged userId in request body is completely ignored by server | PASS |
| **TC-3B.14** | Often searched ranks by frequency and recency accurately | PASS |
| **TC-3B.15** | Clear history deletes only the authenticated user search history | PASS |

### 2. Regression Testing
All 93 prior tests from Phase 1, Phase 2, and Phase 3A continue to pass:
- `tests/maps.test.ts`: 15/15 passed
- `tests/database.test.ts`: 15/15 passed
- `tests/api.test.ts`: 18/18 passed
- `tests/authorization.test.ts`: 10/10 passed
- `tests/auth.test.ts`: 35/35 passed
- **Total**: 108/108 passed

### 3. Build & Static Analysis
- `npx tsc --noEmit`: 0 errors
- `npx eslint src`: 0 errors, 0 warnings
- `npm run build`: 0 errors, all 36 routes compiled and optimized

---

## Manual & Browser Subagent Verification

Performed live in the browser using the autonomous browser subagent on `http://localhost:3000/explore`:
1. **Live Search**: Typed `"Jaipur"`. Debounced call triggered `POST https://places.googleapis.com/v1/places:searchText`.
2. **Suggestions Dropdown**: Rendered with place name, address (`"Jaipur, Rajasthan, India"`), and category badge (`"Locality"`).
   - Artifact: `live_suggestions_dropdown_1790459810459.png`
3. **Selection & Map Centering**: Clicking suggestion centered the map on `(26.9124, 75.7873)`, placed `<MapMarker />`, and displayed `<PlaceDetailsCard />` with website link (`http://www.jaipur.nic.in/`), coordinates, and "Center on Map" button.
   - Artifact: `selected_place_details_card_1790459836047.png`
4. **Recent Searches**: Clearing search input opened Recent Searches with `"Jaipur"` and "Clear" button.
   - Artifact: `recent_searches_jaipur_1790459873790.png`
5. **Mobile Viewport (390x844)**: Responsive search bar, bottom details card, and floating controls verified.
   - Artifact: `mobile_explore_view_1790459903611.png`
   - Video recording: `phase3b_search_demo_1790459717816.webp`

---

## Files Changed / Created

### Created
- `src/lib/maps/places.ts`: Server-side Google Places API (New) service with caching, sanitization, and normalization.
- `src/app/api/places/search/route.ts`: Places search route handler.
- `src/app/api/places/[placeId]/route.ts`: Place details route handler.
- `src/app/api/search/places/route.ts`: Route alias handler.
- `src/components/search/types.ts`: TypeScript interfaces for normalized places and search history.
- `src/components/search/SearchInput.tsx`: Accessible search input with combobox semantics.
- `src/components/search/SearchSuggestions.tsx`: Suggestion listbox with categories and ratings.
- `src/components/search/RecentSearches.tsx`: Recent search list with clear history.
- `src/components/search/OftenSearched.tsx`: Frequency + recency ranked destination chips.
- `src/components/search/PlaceDetailsCard.tsx`: Floating place details card with map centering.
- `src/components/search/SearchBox.tsx`: Master search orchestrator with debounce and keyboard handling.
- `src/components/search/index.ts`: Search barrel export.
- `tests/search.test.ts`: 15 Phase 3B unit and integration tests.

### Modified
- `src/lib/auth-server.ts`: Added `getOptionalAuthenticatedUser` helper for safe guest fallback.
- `src/lib/api-error.ts`: Exported `BadRequestError`.
- `src/app/explore/page.tsx`: Integrated `SearchBox`, `MapMarker`, and `PlaceDetailsCard` with map synchronization.

---

## Known Issues

- None. All functionality is operational, secured, and verified.

---

## Phase 3B Status: PASS
