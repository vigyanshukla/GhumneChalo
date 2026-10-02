# GhumneChalo --- Antigravity v3 Documentation

This is the comprehensive implementation context for GhumneChalo.

## Start Here

Read in this order:

1.  `00_MASTER_AUTONOMOUS_PROMPT.md`
2.  `01_PRODUCT_SPEC.md`
3.  `02_FEATURE_MATRIX.md`
4.  `03_MAPS_IMPLEMENTATION.md`
5.  `04_PWA_IMPLEMENTATION.md`
6.  `05_NOTIFICATIONS.md`
7.  `06_SEARCH_SAVED_HISTORY.md`
8.  `07_TRIPS_ITINERARY_BUDGET.md`
9.  `08_AI_PLANNER.md`
10. `09_PACKING_EMERGENCY_ACHIEVEMENTS.md`
11. `10_API_AND_BACKEND.md`
12. `11_DATABASE.md`
13. `12_ENVIRONMENT_SECURITY.md`
14. `13_TESTING_DEFINITION_OF_DONE.md`
15. `14_AUTONOMOUS_LOOP_CHECKLIST.md`
16. `15_UI_REFERENCE.md`

## Core Architecture

Frontend: Next.js + React + TypeScript + Tailwind + PWA

Backend: Next.js Route Handlers

Database: Supabase PostgreSQL + Prisma

External: Google Maps Platform + Open-Meteo + Gemini/Vertex AI

## Required Google APIs

-   Maps JavaScript API
-   Places API (New)
-   Routes API
-   Geocoding API

## Product Must Include

Authentication, profile, trips, itinerary, budget, transportation, Maps,
weather, AI, search, recent searches, often searched, saved places,
saved trips, packing assistant, emergency mode, achievements,
notifications, PWA/offline behavior and responsive UI.

## Autonomous Execution

Antigravity must work continuously without asking for yes/no
confirmation after each phase.

Use: inspect → implement → test → fix → verify → continue.

The UI reference image supplied with the project should guide the visual
implementation.
