# Gains Tracker — Design Spec

Date: 2026-07-24

## Purpose

A personal strength and catching progress tracker for a catcher who lifts 4–5 days/week
focused on strength and athletic performance. Logs lifts (sets/reps/weight/RPE) and
catching-specific metrics (pop time, blocking, framing) over time, with progress charts
and PR tracking.

Single user, single-device, local-only — no accounts, no server, no network calls.

## Data model

- **Exercise** — `id`, `name`, optional `category`. Created freely (free-form picker,
  add-as-you-type — no fixed program/template).
- **WorkoutSession** — `id`, `date`, optional `notes`. Has many ExerciseEntries.
- **ExerciseEntry** — `id`, `sessionId`, `exerciseId`. Has many Sets.
- **Set** — `id`, `exerciseEntryId`, `weightLbs`, `reps`, optional `rpe` (1–10).
- **CatchingSession** — `id`, `date`, optional `notes`. Has zero or more of each:
  - **PopTimeRep** — `id`, `catchingSessionId`, `seconds`.
  - **BlockingDrill** — `id`, `catchingSessionId`, `repCount`, `successCount`.
  - **FramingDrill** — `id`, `catchingSessionId`, `repCount`, `successCount`.
- **BodyweightEntry** — `id`, `date`, `weightLbs`.

All records are keyed by date so trend charts and history all derive from the same
timeline. Weight unit is lbs throughout.

## Core screens & flows

Mobile-first, bottom tab bar navigation: **Log Lift / Log Catching / Progress / History**.
Log Lift is the default landing screen (used most often).

- **Log Lift**: pick or create today's session → pick or add an exercise → add sets one
  at a time (weight, reps, optional RPE) with quick +/- steppers for fast entry mid-workout.
  Shows the previous session's numbers for that exercise inline as reference
  (e.g. "last time: 225×5").
- **Log Catching**: pick or create today's catching session → three quick-add blocks:
  - Pop Time: tap to add a single rep's time; running list for the session with live
    best/average shown as you add reps.
  - Blocking: rep count + success count for the session.
  - Framing: rep count + success count for the session.
- **Log Bodyweight**: single quick-entry field, date defaults to today.
- **History**: flat reverse-chronological list of all sessions (lift, catching,
  bodyweight combined), tap into any entry to view or edit it.

## Progress & analytics

- **Progress screen**: pick an exercise → line chart of weight over time. Toggle between
  "top set weight" and "estimated 1RM" (Epley formula, computed from each session's
  heaviest set). Secondary chart: total volume (sets × reps × weight) per session — this
  trends differently than top weight and is useful on its own.
- **PR detection**: logging a set that beats the prior best weight-at-that-rep-count, or
  the prior best estimated 1RM, for that exercise triggers an immediate "PR!" indicator
  after logging. PRs for an exercise are also listed on its Progress view.
- **Catching progress**: pop time chart (best + average per session — trending down over
  time is the goal). Blocking/framing success-rate percentage per session as a bar or
  line chart.
- **Bodyweight**: simple line chart over time, shown as context alongside lift progress
  (not a separate top-level tab).

## Tech & non-functionals

- **Stack**: React + Vite + TypeScript, Dexie.js over IndexedDB for storage, Recharts for
  charts, plain CSS (mobile-first; no heavy UI framework needed at this scope).
- **Persistence**: entirely client-side/local to the browser in use. No accounts, no
  backend, no network calls.
- **Data safety net**: Settings screen with Export/Import as JSON, since local-only
  storage has no built-in backup or cross-device sync — this is the mitigation for that
  trade-off (e.g. switching browsers, clearing site data, moving devices).
- **PWA**: manifest + service worker so the app can be added to a phone's home screen and
  opens full-screen. Still browser-based/local-only storage under the hood — this only
  affects presentation, not persistence model.
- **Testing**: unit tests focused on the data layer — Dexie queries, PR-detection logic,
  estimated 1RM calculation — since bugs there would silently corrupt training data.
  Light/no automated testing on pure UI layout.

## Explicitly out of scope (for this spec)

- Multi-device sync / cloud storage.
- Fixed workout program/template system.
- Throwing velocity tracking.
- User accounts or authentication.
