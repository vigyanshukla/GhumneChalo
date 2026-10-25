# GhumneChalo --- Google Maps Implementation

## Enabled APIs

The project currently has: - Maps JavaScript API - Places API (New) -
Routes API - Geocoding API

Do not enable additional Google Maps APIs unless a feature genuinely
requires one.

## Maps JavaScript API

Use for: - interactive maps - markers - route visualization -
destination context - trip map - selected place display

Client-side API keys must be restricted appropriately.

## Places API (New)

Use for: - destination search - autocomplete/suggestions - place
discovery - place details - popular destinations where provider data
supports it

Do not store unnecessary provider response data.

Store provider place ID when useful.

## Routes API

Use for: - origin → destination route - multi-stop route - distance -
duration - travel mode - itinerary route optimization at the application
level

Never let Gemini invent route distance or duration.

## Geocoding API

Use for: - address → coordinates - coordinates → readable address -
normalizing user-entered location where appropriate

## Architecture

``` text
UI
 |
 +--> Maps JavaScript API
 |
 +--> /api/places
 |       ↓
 |   Places API (New)
 |
 +--> /api/routes
 |       ↓
 |    Routes API
 |
 +--> /api/geocode
         ↓
     Geocoding API
```

## Search Flow

``` text
Search input
 -> Places suggestions
 -> user selection
 -> place ID + coordinates
 -> place details
 -> save/search-history event
 -> map update
```

## Route Flow

``` text
Trip itinerary
 -> ordered coordinates
 -> Route API
 -> distance/duration/polyline
 -> map display
```

## Failure

If Maps is unavailable: - show useful non-map place information -
preserve selected destination - show retry - never crash the entire page

## Security

Use separate restricted keys when browser and server access have
different requirements. Never expose server-only credentials.
