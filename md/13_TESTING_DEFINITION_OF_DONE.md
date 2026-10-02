# GhumneChalo --- Testing & Definition of Done

## Authentication Tests

-   Register works
-   Invalid email rejected
-   Weak password rejected
-   Duplicate account handled
-   Email login works
-   Wrong password rejected
-   Google login works when configured
-   Logout works
-   Forgot password works
-   Invalid/expired reset token rejected
-   Reset token cannot be reused
-   Change password works
-   Unauthorized user cannot access another account

## Search Tests

-   autocomplete
-   selection
-   recent search
-   deduplication
-   often searched ranking
-   clear history
-   saved place
-   unsave

## Trip Tests

-   create
-   read
-   edit
-   delete
-   duplicate
-   archive
-   favorite
-   user isolation

## Maps Tests

-   map loads
-   place selection
-   route calculation
-   markers
-   provider error
-   mobile behavior

## Weather

-   destination forecast
-   unavailable API
-   stale/cached state

## AI

-   valid structured response
-   malformed response
-   provider failure
-   regeneration
-   no fabricated provider IDs
-   user confirmation before destructive replacement

## PWA

-   installability
-   manifest
-   service worker
-   offline shell
-   saved trip access
-   reconnect
-   update flow

## Notifications

-   permission
-   preference toggles
-   in-app notifications
-   unread state
-   push subscription where configured
-   timezone handling

## UX

Every feature: - loading - empty - error - success

## Build Gate

Before completion: - typecheck passes - lint passes - production build
passes - relevant tests pass - no obvious console errors - no broken
navigation - no placeholder functionality

## Visual Gate

Compare implementation against the supplied UI reference: - hierarchy -
spacing - color language - card style - navigation - responsive layout -
feature discoverability

Do not sacrifice accessibility or usability for pixel matching.
