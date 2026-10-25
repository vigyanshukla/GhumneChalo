# GhumneChalo --- PWA Implementation

## Goal

Make GhumneChalo installable and useful on mobile while preserving clear
boundaries around live network features.

## Required

-   web app manifest
-   app icons
-   service worker
-   installability
-   offline shell
-   cache strategy
-   online/offline indicator
-   update handling
-   saved trip offline access
-   saved places offline access where practical

## Cache Categories

### Static

Cache: - app shell - icons - stable static assets

### User Data

Cache carefully: - recently opened saved trips - saved places -
itinerary data

Never cache: - passwords - auth secrets - sensitive server credentials

## Offline UX

Show: "You're offline. Your saved trips are available. Live maps,
weather and fresh search may be unavailable."

## Sync

When connectivity returns: - refresh stale weather - refresh provider
data - reconcile pending local changes where supported - avoid
overwriting newer server data blindly

## PWA Install UX

Provide a non-intrusive install prompt when browser support allows it.

## Update UX

When a new version is available: "New version available --- refresh to
update."

## Push

Use a proper web push architecture for background notifications. Do not
assume the basic Notification API alone provides reliable background
delivery.
