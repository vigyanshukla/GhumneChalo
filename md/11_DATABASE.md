# GhumneChalo --- Expanded Database Design

## Core

``` text
User
 ├── Trip
 │    ├── ItineraryDay
 │    │    └── ItineraryItem
 │    ├── Budget
 │    │    └── Expense
 │    ├── Transportation
 │    └── WeatherSnapshot
 │
 ├── SavedPlace
 ├── SearchHistory
 ├── Notification
 ├── NotificationPreference
 └── Achievement
```

## User

-   id
-   name
-   email
-   image
-   emailVerified
-   createdAt
-   updatedAt

## Trip

-   id
-   userId
-   title
-   destinationName
-   destinationPlaceId
-   latitude
-   longitude
-   startDate
-   endDate
-   totalBudget
-   currency
-   status
-   isFavorite
-   createdAt
-   updatedAt

## SavedPlace

-   id
-   userId
-   placeId
-   name
-   latitude
-   longitude
-   category
-   savedAt

Unique userId + placeId.

## SearchHistory

-   id
-   userId
-   query
-   placeId
-   placeName
-   latitude
-   longitude
-   searchCount
-   searchedAt

## Notification

-   id
-   userId
-   type
-   title
-   body
-   data
-   readAt
-   createdAt

## NotificationPreference

-   id
-   userId
-   tripReminders
-   itineraryReminders
-   weatherAlerts
-   budgetAlerts
-   pushEnabled

## ItineraryDay

-   id
-   tripId
-   dayNumber
-   date
-   title

## ItineraryItem

-   id
-   itineraryDayId
-   placeId
-   name
-   latitude
-   longitude
-   startTime
-   endTime
-   notes
-   order

## Budget

-   id
-   tripId
-   totalAmount
-   currency

## Expense

-   id
-   budgetId
-   category
-   description
-   amount
-   expenseDate
-   createdAt

## Transportation

-   id
-   tripId
-   type
-   origin
-   destination
-   departureTime
-   arrivalTime
-   cost
-   currency
-   notes

## WeatherSnapshot

-   id
-   tripId
-   date
-   latitude
-   longitude
-   temperature
-   precipitationProbability
-   weatherCode
-   fetchedAt

## Achievement

-   id
-   userId
-   type
-   progress
-   earnedAt

## Auth

Use the selected auth framework's required Account/Session/verification
tables. Do not invent incompatible auth schemas.
