# GhumneChalo --- AI Planner

## Inputs

-   destination
-   dates
-   number of days
-   budget
-   interests
-   pace
-   traveler preferences

## Context

Before calling Gemini, gather real data where required: - place
information - coordinates - weather - routes - existing itinerary -
budget

## AI Output

Structured JSON only for database-oriented operations.

Example:

``` json
{
  "summary": "...",
  "days": [
    {
      "dayNumber": 1,
      "title": "...",
      "items": [
        {
          "placeId": "...",
          "name": "...",
          "startTime": "09:00",
          "reason": "..."
        }
      ]
    }
  ],
  "budgetNotes": []
}
```

## Validation

Validate: - schema - dates - day numbers - referenced provider IDs -
required fields - time format

Reject invalid output.

## Regeneration

Allow: - regenerate full itinerary - regenerate one day - change pace -
change budget - add/remove interests

Do not destroy the previous saved itinerary until the user confirms
replacement.

## AI Chat

The travel assistant can answer: - planning questions - itinerary
modifications - packing suggestions - budget suggestions - weather-aware
planning

Live factual questions should trigger appropriate APIs rather than
hallucinated answers.
