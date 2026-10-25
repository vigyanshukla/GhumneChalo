# GhumneChalo --- Backend & Route Handler Specification

## Backend Decision

Next.js Route Handlers are the backend.

No Express server.

## Suggested Routes

### Auth

-   `/api/auth/*`

### Profile

-   GET/PATCH `/api/profile`

### Trips

-   GET/POST `/api/trips`
-   GET/PATCH/DELETE `/api/trips/[tripId]`
-   POST `/api/trips/[tripId]/duplicate`
-   POST `/api/trips/[tripId]/archive`
-   POST `/api/trips/[tripId]/favorite`

### Search

-   GET `/api/search/places`
-   GET `/api/search/recent`
-   GET `/api/search/often`
-   DELETE `/api/search/history`

### Saved

-   GET/POST `/api/saved/places`
-   DELETE `/api/saved/places/[id]`

### Itinerary

-   `/api/trips/[tripId]/itinerary`

### Budget

-   `/api/trips/[tripId]/budget`
-   `/api/trips/[tripId]/expenses`

### Transportation

-   `/api/trips/[tripId]/transportation`

### Maps

-   `/api/places`
-   `/api/routes`
-   `/api/geocode`

### Weather

-   `/api/weather`

### AI

-   `/api/ai/itinerary`
-   `/api/ai/chat`

### Notifications

-   `/api/notifications`
-   `/api/notifications/preferences`
-   `/api/push/subscribe`
-   `/api/push/unsubscribe`

## Response Shape

Success:

``` json
{
  "success": true,
  "data": {}
}
```

Error:

``` json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe user-facing message"
  }
}
```

## Authorization

Every user-owned route: 1. authenticate session 2. obtain user identity
server-side 3. load resource 4. verify ownership 5. perform operation

Never trust `userId` from request body.
