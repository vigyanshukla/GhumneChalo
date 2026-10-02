# GhumneChalo --- Notification System

## Notification Types

### Trip Reminder

Example: "Your Goa trip starts tomorrow."

### Itinerary Reminder

Example: "Your Day 2 activity starts in 1 hour."

### Weather Alert

Example: "Rain is expected during your planned outdoor activity."

### Budget Alert

Example: "You have used 80% of your trip budget."

## Notification Preferences

``` text
Trip reminders      ON/OFF
Itinerary reminders ON/OFF
Weather alerts      ON/OFF
Budget alerts       ON/OFF
Push notifications  ON/OFF
```

## Architecture

``` text
Database
  ↓
Scheduled/triggered server process
  ↓
Notification service
  ↓
Web Push
  ↓
Service Worker
  ↓
User device
```

The exact scheduling mechanism depends on the production deployment
environment.

## Rules

-   Ask permission only at a useful moment.
-   Respect browser permission.
-   Respect user preferences.
-   Do not spam.
-   Do not send notifications for deleted/archived trips.
-   Use timezone-aware scheduling.
-   Do not expose subscription secrets.
-   Allow users to disable categories.

## In-App Notifications

Maintain a notification center: - unread count - mark read - mark all
read - delete/dismiss

## Fallback

If push is unsupported, provide in-app reminders and clear UI messaging.
