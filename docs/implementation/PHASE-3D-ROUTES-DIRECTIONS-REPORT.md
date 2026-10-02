# Phase 3D Routes & Directions Report

## Executive Summary

Phase 3D has been successfully implemented and verified for **GhumneChalo**. This phase delivers an enterprise-grade **Routes & Directions Experience** powered by the verified **Google Routes API** (`v2:computeRoutes`).

The routing system integrates seamlessly with the existing Explore interface, Places Search, Place Details Card, and Google Maps foundation. It allows users to calculate, visualize, and toggle multi-modal routes (Drive, Two-Wheeler, Walk, Transit) between determined origin points (user geolocation, destination anchors, or default city center) and any discovered or searched destination.

All features strictly observe the Phase 3D boundary:
- **Implemented**: Google Routes API (`v2:computeRoutes`), server-side API key proxying, coordinate & travel mode validation, normalized route and leg models, polyline decoding, interactive Google Maps polyline rendering with custom start/end markers, automatic map viewport fitting, responsive `RouteCard` with multi-mode switcher, live header route badge, route clearing logic, stale-response protection, 5-minute in-memory caching, comprehensive accessibility, unit/integration test suite, and full browser verification with live screenshots.
- **Strictly Excluded**: AI Trip Planner, Gemini itinerary generation, Saved Trips, Itinerary management, Budget & Expenses, Notifications, and PWA features (all reserved for subsequent phases).

---

## 1. Architecture

```
User Selects Destination (PlaceCard or SearchBox)
                           │
                           ▼
          PlaceDetailsCard ("Directions" button clicked)
                           │
                           ▼
Determine Origin:
Priority 1: User Geolocation (if permitted)
Priority 2: Active Anchor (e.g. New Delhi, Jaipur, Mumbai)
Priority 3: Default City Center (28.6139, 77.2090)
                           │
                           ▼
        Next.js Route Handler (POST /api/routes)
  (Validates origin & destination coords [-90,90], [-180,180],
   validates travelMode: DRIVE | TWO_WHEELER | WALK | TRANSIT | BICYCLE)
                           │
                           ▼
      Server Service (src/lib/maps/routes.ts)
  (Checks 5-minute memory cache: route:{origin}->{destination}:{mode})
                           │
                           ▼
          Google Routes API (v2:computeRoutes)
  POST https://routes.googleapis.com/directions/v2:computeRoutes
       │  (Protected Server Key: GOOGLE_MAPS_API_KEY)
       │  (Field Mask: routes.duration, routes.distanceMeters,
       │   routes.polyline.encodedPolyline, routes.description,
       │   routes.legs.distanceMeters, routes.legs.duration, routes.warnings)
       ▼
  Normalized Route Model (NormalizedRoute)
  (Distance in meters -> "210.4 km" / "450 m";
   Duration in seconds -> "3 hr 25 min" / "13 min" / "< 1 min")
                           │
                           ▼
  Client State Update (Sequence Counter & Stale Protection)
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  RouteCard UI                           MapRoutePolyline
  - Origin / Destination indicators      - Decodes encoded polyline
  - Travel mode switcher tabs            - Draws blue geodesic polyline (#2563eb)
  - Duration & distance highlights       - Green start pin & Red end pin
  - "Fastest" route badge                - Fits map bounds to route geometry
  - Route description & warnings         - Smooth unmount & cleanup on clear
  - Close / Clear Route action
```

---

## 2. API Integration

- **Route**: `POST /api/routes`
- **Upstream Target**: `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Goog-Api-Key: GOOGLE_MAPS_API_KEY` (kept strictly on server)
  - `X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.legs.distanceMeters,routes.legs.duration,routes.warnings`
- **Travel Modes Supported**:
  - `DRIVE` (Automobile)
  - `TWO_WHEELER` (Motorcycle / Scooter)
  - `WALK` (Pedestrian)
  - `TRANSIT` (Public transit)
  - `BICYCLE` (Bicycle)

---

## 3. Request Model

### Client to Server (`POST /api/routes`)
```json
{
  "origin": {
    "lat": 28.6139,
    "lng": 77.2090,
    "name": "New Delhi"
  },
  "destination": {
    "lat": 27.1767,
    "lng": 78.0081,
    "name": "Taj Mahal, Agra"
  },
  "travelMode": "DRIVE"
}
```

### Server to Google Routes API
```json
{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 28.6139,
        "longitude": 77.2090
      }
    }
  },
  "destination": {
    "location": {
      "latLng": {
        "latitude": 27.1767,
        "longitude": 78.0081
      }
    }
  },
  "travelMode": "DRIVE"
}
```

---

## 4. Response Model

### Internal Normalized Route (`NormalizedRoute`)
```typescript
export interface NormalizedRouteLeg {
  distanceMeters?: number;
  durationSeconds?: number;
  distanceText: string;
  durationText: string;
}

export interface NormalizedRoute {
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
  polyline: string;
  description?: string;
  travelMode: TravelMode;
  legs?: NormalizedRouteLeg[];
  warnings?: string[];
}
```

### Sample Normalized API Output
```json
{
  "success": true,
  "data": {
    "distanceMeters": 210434,
    "durationSeconds": 12273,
    "distanceText": "210.4 km",
    "durationText": "3 hr 25 min",
    "polyline": "_tsmDg{fvM?e@dIHPDhGgMP_AKYA_@J_@RWXI...",
    "description": "Yamuna Expy",
    "travelMode": "DRIVE",
    "legs": [
      {
        "distanceMeters": 210435,
        "durationSeconds": 12275,
        "distanceText": "210.4 km",
        "durationText": "3 hr 25 min"
      }
    ],
    "warnings": []
  }
}
```

---

## 5. Security

1. **Server-Side API Key Protection**:
   - `GOOGLE_MAPS_API_KEY` is accessed exclusively in server-side functions (`src/lib/maps/routes.ts`).
   - Verified that client bundles and error messages never leak the Google API key.
2. **Strict Input Sanitization**:
   - Latitudes validated strictly within `[-90, 90]`.
   - Longitudes validated strictly within `[-180, 180]`.
   - Travel modes validated against `SUPPORTED_TRAVEL_MODES` whitelist.
   - Malformed JSON and payload types rejected with clean HTTP 400 Bad Request.
3. **Sanitized Error Responses**:
   - Upstream Google Routes API 4xx/5xx errors caught and sanitized into generic `500 Internal Server Error` with `ROUTES_API_ERROR` code.
   - Raw stack traces, upstream headers, and credentials stripped.

---

## 6. Route Rendering

- **Single Google Maps Instance**:
  - Reuses the existing Google Maps instance without creating duplicate map instances.
- **Polyline Decoding**:
  - Fast, zero-dependency implementation of the standard Google Encoded Polyline Algorithm (`decodePolyline`).
  - Converts encoded strings into `{ lat, lng }[]` arrays.
- **Polyline Presentation**:
  - Rendered using `google.maps.Polyline` with `#2563eb` (royal blue), `strokeWeight: 5`, and `strokeOpacity: 0.85`.
- **Start and End Markers**:
  - Start point marked with a distinct emerald green circle pin (`#10b981`).
  - Destination point marked with a vibrant red arrow pin (`#ef4444`).
- **Viewport Bounds Fitting**:
  - Automatically calculates `google.maps.LatLngBounds` containing all route points.
  - Calls `map.fitBounds(bounds, { top: 60, right: 60, bottom: 80, left: 60 })` to ensure the entire journey fits comfortably in the viewport.
- **Cleanup & Tear-down**:
  - When the user closes or clears the route, `poly.setMap(null)` and marker unmount cleanup are executed immediately.

---

## 7. UI Implementation

1. **`PlaceDetailsCard` Integration**:
   - Added a prominent **"Directions"** button (`<Navigation className="w-3.5 h-3.5" />`) alongside "Center on Map".
   - Clicking Directions switches directly to the route calculation view.
2. **`RouteCard` Component**:
   - Displays Origin ("From: New Delhi") with green bullet and Destination ("To: India Gate") with red bullet.
   - Interactive travel mode tabs (`Drive`, `Two-Wheeler`, `Walk`, `Transit`) with Lucide icons.
   - Prominent duration display (e.g. `5 min`, `34 min`) with distance badge (`(2.3 km)`).
   - "Fastest" route badge and primary road description (`via Maulana Azad Rd`).
   - Close button (`X`) to cancel and clear the active route.
3. **Live Header Badge**:
   - When a route is active, a status badge displays in the header bar:
     `<Navigation /> 5 min (2.3 km)` / `34 min (2.5 km)`.
4. **Dynamic Refetching on Destination Change**:
   - If the user selects another place from search or discovery feed while directions are active, the destination updates and recalculates automatically.

---

## 8. Responsive Behavior

- **Desktop (>= 1024px)**:
  - Sidebar feed on the left (440px) remains accessible.
  - `RouteCard` floats at the bottom-left of the map area (`w-[400px]`, `bottom-4`, `left-4`) with glassmorphism backdrop blur.
  - Tested at 1440x900 viewport.
- **Mobile (< 1024px)**:
  - `RouteCard` docks cleanly as a bottom card (`bottom-4`, `left-4`, `right-4`).
  - Travel mode tabs scroll horizontally with no-scrollbar styling.
  - Does not overlap the top floating search bar or the right floating map controls.
  - Tested at 390x844 mobile viewport with zero horizontal overflow.

---

## 9. Error Handling

- **`400 Bad Request`**:
  - Missing origin or destination.
  - Invalid coordinate ranges (lat < -90 or > 90, lng < -180 or > 180).
  - Unsupported travel modes.
  - Malformed JSON body.
- **`404 Not Found`**:
  - Returned when Google Routes API finds no route between points (`ROUTE_NOT_FOUND`).
- **`500 Internal Server Error`**:
  - Upstream network errors or quota limits sanitized without leaking secrets.
- **Client Error State**:
  - `RouteCard` displays a friendly alert banner with error explanation and a **"Retry route calculation"** button.

---

## 10. Tests

### Phase 3D Dedicated Test Suite (`tests/routes.test.ts`)
21 unit and integration test cases covering:
- **TC-3D.01**: Valid origin + destination returns normalized route with distance, duration & polyline.
- **TC-3D.02**: Invalid or missing origin returns 400 Bad Request.
- **TC-3D.03**: Invalid or missing destination returns 400 Bad Request.
- **TC-3D.04**: Invalid latitude (< -90 or > 90) rejected with 400 Bad Request.
- **TC-3D.05**: Invalid longitude (< -180 or > 180) rejected with 400 Bad Request.
- **TC-3D.06**: Unsupported travel mode rejected with 400 Bad Request.
- **TC-3D.07**: Google Routes API request uses server-side API key header.
- **TC-3D.08**: Correct field mask is passed to Google Routes API.
- **TC-3D.09**: Google response is normalized into clean internal model.
- **TC-3D.10**: Raw Google response & API key are never leaked in payload or error.
- **TC-3D.11**: Google API failure returns sanitized error.
- **TC-3D.12**: No-route response handled correctly with 404.
- **TC-3D.13**: Route polyline is returned and accurately decoded to coordinates.
- **TC-3D.14**: Distance is normalized correctly for meters and kilometers.
- **TC-3D.15**: Duration is normalized correctly for seconds, minutes, and hours.
- **TC-3D.16**: Route clearing removes route state cleanly.
- **TC-3D.17**: Changing destination updates route with new query.
- **TC-3D.18**: Changing travel mode updates route with updated travel mode parameter.
- **TC-3D.19**: Stale route response cannot overwrite newer route (Sequence Counter).
- **TC-3D.20**: All supported travel modes are defined and recognized.
- **TC-3D.21**: In-memory cache returns identical route without duplicate upstream request.

**Test Suite Result: 21/21 PASS (100%)**

---

## 11. Browser Verification

Browser verification was performed against the live development server on Chrome at `http://localhost:3000/explore`.

### Captured Verification Artifacts
1. **Desktop Place Details Card with Directions Button**:
   - File: `desktop_place_details_card.png`
   - Shows selected place ("India Gate"), details, and the new blue "Directions" button in the footer.
2. **Desktop Drive Route Success**:
   - File: `desktop_route_success.png`
   - Shows active `RouteCard` with "From: New Delhi", "To: India Gate", `Drive` mode selected, `5 min (2.3 km)`, `Fastest`, `via Maulana Azad Rd`, and top status pill.
3. **Desktop Walk Route Mode Switch**:
   - File: `desktop_route_walk.png`
   - Shows switched travel mode to `Walk`, updated duration `34 min (2.5 km)`, and updated header badge.
4. **Desktop Route Cleared**:
   - File: `desktop_route_cleared.png`
   - Shows that closing the route cleanly removes the polyline and restores `PlaceDetailsCard` and default map view.
5. **Mobile Viewport Route Display (390x844)**:
   - File: `mobile_route_view.png`
   - Shows responsive mobile bottom drawer for directions with horizontal travel mode pills, full map controls, and header route badge.

---

## 12. Performance & Cost Controls

1. **In-Memory TTL Caching**:
   - Key: `route:{originLat},{originLng}->{destLat},{destLng}:{travelMode}`
   - 5-minute TTL prevents duplicate billing for rapid back-and-forth toggles.
2. **Restricted FieldMask**:
   - Google Routes API charges by SKU tier. Only essential fields (`routes.duration, routes.distanceMeters, routes.polyline.encodedPolyline, routes.description, routes.legs.distanceMeters, routes.legs.duration, routes.warnings`) are requested.
3. **Race-Condition & Stale Request Protection**:
   - `routeFetchIdRef` sequence counter and `AbortController` ensure in-flight slow requests cannot overwrite newer user selections.

---

## 13. Regression Results

All existing quality gates and regression test suites pass without issues:
- **`tests/routes.test.ts`**: 21/21 PASS
- **`tests/explore.test.ts`**: 18/18 PASS
- **`tests/maps.test.ts`**: 15/15 PASS
- **TypeScript (`npx tsc --noEmit`)**: 0 errors
- **ESLint (`npx eslint src`)**: 0 errors, 0 warnings
- **Production Build (`npm run build`)**: 0 errors, all 38 routes compiled

---

## 14. Known Limitations

- Real-time turn-by-turn navigation audio guidance is out of scope for Phase 3D (static route display with distance, duration, and multi-modal overview).
- Certain localized bicycle routing data may be sparse in specific Indian city center areas where Google Routes does not have dedicated bicycle lane indexing (falls back cleanly with empty route or error handling).

---

## 15. Final Status

# STATUS: PASS

All acceptance criteria and Definition of Done requirements for **Phase 3D — Routes & Directions** are satisfied.
The repository is in a clean, stable state. Execution is stopped per the strict Phase Boundary.
