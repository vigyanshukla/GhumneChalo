# Phase 5 — Day-Wise Itinerary Implementation Report

**Status:** PASS  
**Completed Date:** September 27, 2026  
**Module:** GhumneChalo Itinerary Core (`src/components/itinerary`, `src/lib/itinerary-service.ts`, `src/app/api/trips/[tripId]/...`)  

---

## 1. Executive Summary

Phase 5 implements the complete **Day-Wise Itinerary** system for GhumneChalo. Users can organize trips into individual days, create and manage activities within each day, reorder activities deterministically, search for attractions using the existing Google Places autocomplete system, link locations to Phase 3D Routes & Directions, and synchronize itinerary days when trip dates change while preventing silent data destruction.

All operations enforce strict server-side authorization and user isolation (IDOR protection). The implementation satisfies all 25 test cases in `tests/itinerary.test.ts` and preserves 100% backward compatibility across all existing test suites (123/123 tests passing repo-wide).

---

## 2. Existing Schema Audit & Database Safety

A deep audit of `prisma/schema.prisma` confirmed that the database already contained the required models from the infrastructure phase:

```prisma
model ItineraryDay {
  id        String          @id @default(cuid())
  tripId    String
  dayNumber Int
  date      DateTime
  title     String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  trip      Trip            @relation(fields: [tripId], references: [id], onDelete: Cascade)
  items     ItineraryItem[]

  @@unique([tripId, dayNumber])
  @@index([tripId])
  @@map("itinerary_days")
}

model ItineraryItem {
  id             String       @id @default(cuid())
  itineraryDayId String
  placeId        String?
  name           String
  latitude       Float?
  longitude      Float?
  startTime      String?
  endTime        String?
  notes          String?
  order          Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  itineraryDay   ItineraryDay @relation(fields: [itineraryDayId], references: [id], onDelete: Cascade)

  @@index([itineraryDayId])
  @@index([itineraryDayId, order])
  @@map("itinerary_items")
}
```

### Database Changes
- **Zero Schema Migrations Required:** Existing columns and cascade constraints (`onDelete: Cascade`) perfectly accommodate the Phase 5 requirements.
- **Normalized Storage:** Only essential normalized fields (`name`, `placeId`, `latitude`, `longitude`, `startTime`, `endTime`, `notes`, `order`) are persisted. Raw Google Places API responses and credentials are never stored.

---

## 3. Architecture & API Endpoints

### Service Layer (`src/lib/itinerary-service.ts`)
- `calculateDuration(startDate, endDate)`: Accurately calculates day span (e.g. 10 June to 12 June = 3 days).
- `calculateDayDate(startDate, dayNumber)`: Calculates calendar date for an itinerary day.
- `verifyTripOwnership(tripId, userId)`: Prevents unauthorized trip-level actions.
- `verifyDayOwnership(tripId, dayId, userId)`: Validates that `day.tripId === tripId` and `trip.userId === userId`.
- `verifyItemOwnership(tripId, dayId, itemId, userId)`: Validates full ownership chain from Item → Day → Trip → User.
- `getOrCreateItineraryDays(tripId, startDate, endDate)`: Auto-initializes default itinerary days (Day 1..Day N) for trips that have 0 days.
- `syncDaysWithTripDates(tripId, newStart, newEnd, confirmShorten)`: Handles date range changes safely.

### API Routes
| Method | Route | Description | Auth / Security |
|---|---|---|---|
| `GET` | `/api/trips/[tripId]/itinerary` | Fetches trip itinerary days and items; auto-initializes if 0 days | Bearer / Session Auth, Trip Ownership |
| `POST` | `/api/trips/[tripId]/days` | Creates a new itinerary day | Trip Ownership |
| `GET` | `/api/trips/[tripId]/days/[dayId]` | Retrieves single day details with items | Day & Trip Ownership |
| `PATCH` | `/api/trips/[tripId]/days/[dayId]` | Updates day title or date | Day & Trip Ownership |
| `DELETE` | `/api/trips/[tripId]/days/[dayId]` | Deletes an itinerary day (cascade items) | Day & Trip Ownership |
| `POST` | `/api/trips/[tripId]/days/[dayId]/items` | Adds activity/place to a day with auto-order | Day & Trip Ownership |
| `GET` | `/api/trips/[tripId]/days/[dayId]/items/[itemId]` | Retrieves single activity | Item, Day & Trip Ownership |
| `PATCH` | `/api/trips/[tripId]/days/[dayId]/items/[itemId]` | Updates activity fields | Item, Day & Trip Ownership |
| `DELETE` | `/api/trips/[tripId]/days/[dayId]/items/[itemId]` | Removes activity | Item, Day & Trip Ownership |
| `PUT` | `/api/trips/[tripId]/days/[dayId]/items/reorder` | Batch updates item ordering atomically | Day & Trip Ownership, Transaction |

---

## 4. Date Synchronization & Duration Safeguard

### Duration Calculation
`calculateDuration` evaluates calendar day differences inclusively:
```typescript
const diffTime = end.getTime() - start.getTime();
return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
```
- Start: `2026-06-10`, End: `2026-06-12` → **3 days**.
- Same-day trip (`2026-06-10` to `2026-06-10`) → **1 day**.

### Date Synchronization on Trip Edit (`PATCH /api/trips/[tripId]`)
- **Trip Extension:** When `endDate` is extended, existing days' dates are updated to align with `startDate`, and new days (`Day N+1`, `Day N+2`...) are automatically appended.
- **Trip Shortening Protection:** If dates are shortened such that days with planned activities would be eliminated (`dayNumber > newDuration`), the API checks if any affected days contain items:
  - If items exist and `confirmShorten` is `false`/omitted, the request is rejected with `422 Unprocessable Entity` and a message specifying which days have planned activities.
  - If `confirmShorten: true` is passed, the excess days are safely purged within a database transaction.

---

## 5. Places & Routes Integration

1. **Places Autocomplete (`/api/places/search?q=...`)**:
   - Reused inside `AddActivityModal.tsx` with a 280ms debounce.
   - Selecting a suggestion populates `placeId`, `name`, `latitude`, and `longitude`.
   - Allows user to customize or edit the activity title (e.g. "Amber Palace Guided Tour").
2. **Routes & Directions (`/explore`)**:
   - Each item card with geographic coordinates displays a "Route Directions" link.
   - Navigates directly to `/explore?destLat=...&destLng=...&destName=...&directions=true`, automatically opening Google Routes in the Explore view.

---

## 6. Item Ordering & Reordering

- **Deterministic Ordering:** Items have an integer `order` column (`0, 1, 2...`).
- **Sequential Creation:** New items added to a day receive `max(order) + 1`.
- **Atomic Reorder:** `PUT /api/trips/[tripId]/days/[dayId]/items/reorder` receives `itemIds: string[]`. It verifies that every ID belongs to the target day, then executes a `prisma.$transaction` updating `order = index` for each item.
- **Optimistic UI:** `ItineraryView.tsx` updates local state instantly when Move Up or Move Down is clicked, falling back gracefully if the server request fails.

---

## 7. UI Components & Responsive Layout

All components follow GhumneChalo design standards:
- **`DayTabs.tsx`**: Horizontal scrollable day selector with day number, date, places count pill, and "+ Add Day" action.
- **`DayHeader.tsx`**: Day title, formatted date, activity count, inline edit, delete day, and "+ Add Activity" button.
- **`ItineraryItemCard.tsx`**: Step sequence badge (#1, #2), scheduled time slot pill (`09:00 – 12:00`), coordinates, user notes callout, Move Up/Down buttons, Directions link, Edit, and Delete actions.
- **`AddActivityModal.tsx`**: Accessible modal with Places search dropdown, place linked confirmation indicator, manual title input, HTML5 time pickers, and notes textarea.
- **`EditDayModal.tsx`**: Quick modal for editing day title and date.
- **`DeleteModal.tsx`**: Accessible confirmation modal identifying the item or day to be deleted.
- **`ItineraryView.tsx`**: Primary container orchestrating state, optimistic reordering, skeletons, and empty state ("No plans yet for Day X").

### Responsive Verification
- **Desktop (1440 × 900):** Clean layout, well-proportioned timeline connector, comfortable padding, no wasted whitespace.
- **Mobile (390 × 844):** Verified with zero horizontal overflow, touch-friendly day tabs with horizontal momentum scroll (`overflow-x-auto scrollbar-none`), stacked controls, and responsive cards.

---

## 8. Security & User Isolation (IDOR Protection)

1. **Authentication:** Server session verified on every request using `requireAuth`. Client-provided `userId` is never trusted.
2. **IDOR Protection:**
   - User B cannot read User A's itinerary (`403 Forbidden`).
   - User B cannot create a day in User A's trip (`403 Forbidden`).
   - User B cannot add an item to User A's day (`403 Forbidden`).
   - User B cannot update or delete User A's items (`403 Forbidden`).
   - Cross-day/cross-trip reorder injection is blocked (`422 Unprocessable Entity`).
3. **Secrets Safety:** `GOOGLE_MAPS_API_KEY` and database credentials remain strictly server-side.

---

## 9. Quality Gates & Test Results

### Vitest Test Suite (`tests/itinerary.test.ts`)
```
✓ TC-5.01: Authenticated user can fetch itinerary
✓ TC-5.02: Unauthenticated user cannot access itinerary
✓ TC-5.03: User can create itinerary day
✓ TC-5.04: Day belongs to correct trip
✓ TC-5.05: User cannot create day in another user's trip
✓ TC-5.06: User can add itinerary item
✓ TC-5.07: Item belongs to correct day
✓ TC-5.08: User cannot add item to another user's day
✓ TC-5.09: User can update own itinerary item
✓ TC-5.10: User cannot update another user's item
✓ TC-5.11: User can delete own itinerary item
✓ TC-5.12: User cannot delete another user's item
✓ TC-5.13: User can reorder itinerary items
✓ TC-5.14: Order persists after reload
✓ TC-5.15: Duplicate order corruption is prevented
✓ TC-5.16: Invalid date/day relationship rejected
✓ TC-5.17: Trip duration calculated correctly
✓ TC-5.18: Extending trip creates required additional days
✓ TC-5.19: Shortening trip does not silently destroy planned items
✓ TC-5.20: Places integration works when adding an activity
✓ TC-5.21: Raw Google Place response is not persisted
✓ TC-5.22: User isolation verified across all itinerary operations
✓ TC-5.23: Existing trip operations remain functional
✓ TC-5.24: Existing places search remains functional
✓ TC-5.25: Existing routes compute remains functional

Tests: 25 passed (25)
Duration: 74.83s
```

### Full Repository Regression Status
- `tests/itinerary.test.ts`: **25 / 25 PASS**
- `tests/trips.test.ts`: **27 / 27 PASS**
- `tests/routes.test.ts`: **21 / 21 PASS**
- `tests/search.test.ts`: **15 / 15 PASS**
- `tests/auth.test.ts`: **35 / 35 PASS**
- **Total Tests:** **123 / 123 PASS** (0 failures, 0 regressions)

### Code Quality & Build Verification
- **TypeScript (`npx tsc --noEmit`):** PASS (0 errors)
- **ESLint (`npm run lint`):** PASS (0 errors, 0 warnings)
- **Next.js Production Build (`npm run build`):** PASS (7.3s, 26 static pages and all dynamic routes compiled)

---

## 10. Phase Boundary & Known Limitations

### Phase 5 Boundaries Strictly Respected:
- **No AI / Gemini Planner:** AI itinerary generation is deferred to Phase 6.
- **No Transportation Booking:** Transportation tracking foundation is reserved for future phases.
- **No Live Weather Sync:** Weather snapshots reserved for future phases.
- **No Real-Time Collaboration:** Collaboration/sharing remains out of scope.

---

## 11. Final Verification Artifacts
- Desktop Itinerary Screenshot: `jaipur_trip_itinerary_1790486281462.png`
- Mobile Itinerary Screenshot (390x844): `jaipur_itinerary_mobile_1790486435187.png`
- Browser Session Video: `phase5_itinerary_verification_1790485365065.webp`
- Mobile Verification Video: `phase5_mobile_verification_1790486333853.webp`
