# GhumneChalo --- Search, Saved, History & Personalization

## Search

Search must support: - destination search - place search -
autocomplete - recent searches - often searched - search history - clear
history

## Recent Search

Store meaningful searches/selections.

Rules: - deduplicate - update timestamp on repeat - cap history - allow
clear all - user-specific

Suggested fields: - id - userId - query - placeId - placeName -
latitude - longitude - searchedAt - searchCount

## Often Searched

Compute from search activity.

Ranking can combine: - frequency - recency

Example conceptual score:

``` text
score = frequencyWeight + recencyWeight
```

Do not expose private aggregate data between users.

## Saved Place

Fields: - id - userId - placeId - name - latitude - longitude -
category - savedAt

Actions: - save - unsave - list - search saved - add to trip

## Saved Trip

A trip is a normal user-owned Trip with favorite/saved status.

Actions: - favorite - unfavorite - open - duplicate - archive - delete

## Recently Viewed

Optionally maintain a bounded user-specific history of viewed
places/trips.

## Privacy

Allow: - clear search history - remove saved place - remove history
entries

Do not retain unnecessary personal activity forever.
