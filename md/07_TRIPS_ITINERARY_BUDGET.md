# GhumneChalo --- Trip, Itinerary & Budget

## Trip Lifecycle

``` text
Draft
 ↓
Planned
 ↓
Upcoming
 ↓
Active
 ↓
Completed
 ↓
Archived
```

## Trip Fields

-   title
-   destination
-   place ID
-   coordinates
-   dates
-   budget
-   currency
-   status
-   favorite
-   created/updated timestamps

## Trip Actions

-   create
-   edit
-   delete
-   duplicate
-   archive
-   favorite

## Itinerary

Each trip contains days.

Each day contains ordered activities.

Activity: - place - start time - end time - notes - order - optional
route context

## Smart Itinerary

Use: - destination - weather - route duration - user interests -
budget - trip dates

AI can propose. User confirms. Only validated data is persisted.

## Budget

Categories: - accommodation - food - transport - activities - shopping -
miscellaneous

Show: - total - spent - remaining - category breakdown - warnings

## Budget Alerts

Suggested thresholds: - 70% informational - 80% warning - 100% exceeded

Make thresholds configurable.

## Transportation

Manual tracking first: - type - origin - destination - departure -
arrival - cost - notes
