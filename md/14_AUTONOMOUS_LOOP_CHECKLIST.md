# GhumneChalo --- Autonomous Loop Checklist

Antigravity must continuously work through this checklist.

## Loop

``` text
[ ] Read current state
[ ] Find highest-priority incomplete feature
[ ] Plan smallest coherent implementation
[ ] Implement
[ ] Typecheck
[ ] Lint
[ ] Test
[ ] Inspect UI
[ ] Fix errors
[ ] Re-test
[ ] Mark feature complete
[ ] Move to next incomplete feature
```

## Priority Queue

### P0

\[ \] Auth security \[ \] User authorization \[ \] Secrets \[ \]
Database integrity

### P1

\[ \] Email auth \[ \] Google auth \[ \] Password recovery \[ \] Profile
\[ \] Trips \[ \] Itinerary \[ \] Budget \[ \] Maps \[ \] Places \[ \]
Routes \[ \] Geocoding \[ \] Weather \[ \] Gemini

### P2

\[ \] Search \[ \] Recent search \[ \] Often searched \[ \] Saved places
\[ \] Saved trips \[ \] Duplicate/archive \[ \] Transportation \[ \]
Packing \[ \] Emergency \[ \] Achievements

### P3

\[ \] Notifications \[ \] PWA \[ \] Offline saved data \[ \] Push
support \[ \] Dashboard personalization

### P4

\[ \] Accessibility \[ \] Responsive refinement \[ \]
Loading/empty/error states \[ \] Motion \[ \] visual polish

## No-Approval Rule

Do not ask the user whether to continue between phases.

If a design or implementation choice is not explicitly specified: 1.
choose the simplest architecture consistent with these documents; 2.
preserve existing working code; 3. implement; 4. test; 5. continue.

Only stop when a true external blocker prevents further progress.
