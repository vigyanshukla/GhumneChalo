# GhumneChalo --- Environment & Security

## Environment

Server:

``` env
DATABASE_URL=
DIRECT_URL=

GOOGLE_MAPS_API_KEY=

GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=
```

Auth provider values depend on the selected framework.

Possible Google OAuth configuration:

``` env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Browser:

``` env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Only expose values that are safe for browser use.

## Google Maps Key Restrictions

Browser key: - restrict by HTTP referrer - restrict to required APIs

Server key: - restrict by server/application environment where
supported - restrict to required APIs

## Security

-   no secrets in source
-   no `.env` committed
-   password hashes never returned
-   secure cookies/session handling
-   CSRF protections where applicable
-   authorization on every private resource
-   input validation
-   rate limiting for auth and abuse-prone endpoints
-   safe error messages
-   no sensitive logs
-   reset tokens expire
-   reset tokens are single-use
-   OAuth secrets server-side

## Data Ownership

Every query for: - trips - saved places - searches - notifications -
budgets - itineraries - transportation - achievements

must be scoped to the authenticated user.

## External API Failures

Never convert provider failures into fake data.

Show a useful fallback state and allow retry.
