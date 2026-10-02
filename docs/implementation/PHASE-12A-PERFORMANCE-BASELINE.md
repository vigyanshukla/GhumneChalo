# PHASE 12A — Performance Baseline Audit

**Date:** October 1, 2026  
**Application:** GhumneChalo  
**Environment:** Next.js 16.3.6 (Turbopack Production Build), Node.js v20+, PostgreSQL (Supabase pooler)  
**Devices Tested:**
- Desktop: 1440x900
- Mobile: 390x844
**Browser Engine:** Microsoft Edge / Chromium Headless (Automated Puppeteer Instrumentation)

---

## 1. Executive Summary & Audit Overview

A comprehensive performance baseline audit was executed against the production build of GhumneChalo (`next build` + `next start` on `http://localhost:3000`). All 21 functional test suites (473/473 tests) were verified passing prior to audit collection.

### Key Baseline Findings:
1. **0 Horizontal Scroll Regressions:** All audited routes maintain zero horizontal overflow across 1440x900 (Desktop) and 390x844 (Mobile).
2. **Server Response Time (TTFB):** Ranging from 3ms to 151ms on production localhost.
3. **Core Web Vitals:**
   - **First Contentful Paint (FCP):** 84ms – 740ms across tested viewports.
   - **Largest Contentful Paint (LCP):** 84ms – 824ms.
   - **Total Blocking Time (TBT):** 0ms – 38ms (peak in `/explore` client bundle evaluation).
   - **Cumulative Layout Shift (CLS):** 0.0000 on most views; 0.0851 on `/emergency` due to late nearby list rendering.
4. **Client-Side JS Overhead Bottleneck:**
   - The largest static chunk is `2n2cex1h8s8dn.js` (443.8 KB uncompressed). Investigation revealed this contains `zod`, which was unintentionally bundled into client components (`PackingView`, `AddItemModal`, etc.) due to importing enum constants and types from `src/lib/validation.ts`.
5. **Explore Page API Overhead:**
   - On initial mount, `/explore` generates 10 discovery category API requests, which can be optimized with request deduplication and client-side caching.
6. **External API Latencies:**
   - Weather API (Open-Meteo): ~562ms
   - Google Places Search API: ~320ms

---

## 2. Page-by-Page Baseline Metrics

### A. Desktop (1440 x 900)

| Route | Page Name | TTFB | FCP | LCP | TBT | CLS | Requests | JS Transferred | Total Load Time |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Home / Landing | 151ms | 740ms | 740ms | 0ms | 0.0000 | 39 | 215 B | 1122ms |
| `/explore` | Explore Places | 5ms | 212ms | 824ms | 36ms | 0.0000 | 38 | 445.4 KB | 759ms |
| `/trips` | Trips Dashboard | 5ms | 120ms | 120ms | 0ms | 0.0000 | 21 | 0 B (cached) | 649ms |
| `/emergency` | Emergency Mode | 4ms | 208ms | 528ms | 25ms | 0.0851 | 22 | 0 B (cached) | 832ms |
| `/achievements` | Achievements | 5ms | 140ms | 140ms | 7ms | 0.0000 | 21 | 0 B (cached) | 668ms |
| `/reminders` | Reminders | 4ms | 112ms | 148ms | 0ms | 0.0000 | 24 | 0 B (cached) | 980ms |
| `/notifications` | Notifications | 3ms | 96ms | 96ms | 0ms | 0.0000 | 21 | 0 B (cached) | 622ms |
| `/login` | Login | 4ms | 108ms | 108ms | 0ms | 0.0000 | 20 | 0 B (cached) | 642ms |

### B. Mobile (390 x 844)

| Route | Page Name | TTFB | FCP | LCP | TBT | CLS | Requests | JS Transferred | Overflow |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Home / Landing | 3ms | 84ms | 84ms | 0ms | 0.0000 | 34 | 215 B | No (0px) |
| `/explore` | Explore Places | 3ms | 152ms | 152ms | 38ms | 0.0000 | 38 | 445.4 KB | No (0px) |
| `/trips` | Trips Dashboard | 4ms | 104ms | 104ms | 0ms | 0.0000 | 21 | 0 B (cached) | No (0px) |
| `/emergency` | Emergency Mode | 6ms | 124ms | 204ms | 10ms | 0.0000 | 21 | 0 B (cached) | No (0px) |
| `/achievements` | Achievements | 4ms | 96ms | 96ms | 0ms | 0.0000 | 21 | 0 B (cached) | No (0px) |
| `/reminders` | Reminders | 3ms | 96ms | 120ms | 0ms | 0.0000 | 24 | 0 B (cached) | No (0px) |
| `/notifications` | Notifications | 3ms | 96ms | 96ms | 0ms | 0.0000 | 21 | 0 B (cached) | No (0px) |
| `/login` | Login | 4ms | 96ms | 96ms | 0ms | 0.0000 | 20 | 0 B (cached) | No (0px) |

---

## 3. Bundle Composition & Static Analysis

From Next.js production build output analysis:
- **Total Compiled Routes:** 54 static/dynamic routes
- **Largest Client JavaScript Chunk:** `2n2cex1h8s8dn.js` (443.8 KB)
  - Identifiers detected: `zod` schema validator
  - Source: Imported directly by `validation.ts` which was referenced for client enum definitions.
- **Second Largest Client JavaScript Chunk:** `22c_b-ybo-b25.js` (229.1 KB)
  - Identifiers detected: `react-dom` runtime
- **Third Largest Client JavaScript Chunk:** `1cndjfzxioh25.js` (165.7 KB)
  - Core app runtime and common utilities
- **CSS Bundle:** `0sdpdwkre_956.css` (138.1 KB)
  - Tailwind v4 generated utility stylesheet
- **Next Font:** `Inter` font files (~52.3 KB transfer per page load)

---

## 4. API & Backend Latency Baseline

| Endpoint | Method | Latency | Response Size | Status | Notes |
|---|---|---|---|---|---|
| `/api/places/search?query=Delhi` | GET | 320ms | 220 B | 200 OK | Outbound Google Places API call |
| `/api/weather?latitude=28.61&longitude=77.20` | GET | 562ms | 4,058 B | 200 OK | Outbound Open-Meteo API call |
| `/api/notifications/unread-count` | GET | 4ms | 102 B | 401 Unauthorized | Auth check overhead |
| `/api/trips` | GET | 2ms | 102 B | 401 Unauthorized | Auth check overhead |
| `/api/achievements` | GET | 4ms | 102 B | 401 Unauthorized | Auth check overhead |
| `/api/emergency/contacts` | GET | 4ms | 3,203 B | 200 OK | Static country catalog |

---

## 5. Identified Bottlenecks & Optimization Roadmap

| Phase | Category | Identified Bottleneck | Optimization Strategy |
|---|---|---|---|
| **12B** | Next.js Architecture | Client components doing initial data fetches or rendering static metadata | Separate server components from interactive client wrappers; lazy-load heavy subtrees. |
| **12C** | JS Bundle Optimization | 443 KB `zod` library pulled into client bundle via enum imports in `PackingView` / `AddItemModal` | Decouple UI constant arrays / enums (`PACKING_CATEGORIES`, etc.) into a lightweight `types.ts` without importing `zod`. |
| **12D** | Google Maps / Places | Google Maps scripts loaded on map-enabled pages, potential duplicate script tags | Lazy-load Maps script using dynamic import, viewport intersection, or user-initiated map tab activation. |
| **12E** | Database / Prisma | Some queries fetching full object graphs when only specific scalar fields are needed | Audit Prisma queries to use specific `select: {}` projections, parallelize queries with `Promise.all()`. |
| **12F** | API Performance | Weather and Places API caching headers; in-memory caching for repeated lookups | Add cache-control headers and in-memory TTL caching for non-sensitive public metadata (e.g. weather forecasts, place details). |
| **12G** | Client Data Fetching | Duplicate fetches or sequential calls in client components | Add SWR/stale-while-revalidate pattern or React `cache()` / in-memory deduplication. |
| **12H** | Image / Font / Assets | Static assets caching and preload strategies | Ensure font-display swap and optimized static caching headers. |
| **12I** | Loading UX | Layout shift (CLS 0.0851 on Emergency page) before contacts/hospitals render | Add skeleton placeholders for smooth perceived load and stable layout dimensions. |
| **12K** | Notifications Overhead | Service Worker and Web Push checks running on mount | Ensure SW registration is deferred/idle and does not block critical rendering path. |
| **12L** | AI Planner Performance | Multi-step DB fetches before invoking Vertex/Gemini | Consolidate context queries in `ai-planner-service.ts` into parallel `Promise.all()`. |
| **12M** | Mobile Optimization | Maintain 0 horizontal scroll; minimize JS thread blocking | Keep mobile TBT < 50ms and eliminate any long script execution. |
