# Program Tab Logging & Last-Week Progress — Design Spec

Date: 2026-07-26

## Purpose

The Program tab (added in the "Weekly Program — UI Integration" plan) is
currently read-only reference: it shows the current week's full schedule
across all days, but logging only happens from Log Lift, and only for
today's actual training day. This left two gaps the user hit immediately
after using the app:

1. Looking at the Program tab's schedule, there's no way to log an actual
   result against a slot — you have to remember the target, switch to Log
   Lift, and hope today happens to be that day.
2. Nothing in the app shows what you actually did last week next to what's
   prescribed this week, and nothing tells you at a glance whether you
   progressed. You'd have to open Progress's charts and do the comparison
   yourself.

This spec closes both gaps: the Program tab becomes a full logging surface
for whichever day you're viewing (not just today), and every loggable slot —
in both Log Lift and the Program tab, since they share the same component —
shows last week's actual result next to this week's target, plus a
beat/matched/fell-short signal computed automatically.

This is one of three sub-projects scoped out of a larger ask (the others —
a full visual design pass, and giving bodyweight logging its own dedicated
section — are deferred to separate specs). Explicitly out of scope here:
any visual/styling changes, and browsing between *weeks* within the current
program (Program still shows one week at a time; only which *day* within
that week is loggable is changing).

## Data model

No schema changes. Three new read-only query functions, following the
existing patterns in `src/db/workouts.ts` and `src/db/programLogEntries.ts`:

- **`getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber)`**
  (`src/db/workouts.ts`) — returns the last logged `SetRecord` (weightLbs,
  reps) for this exact slot at `weekNumber - 1`, or `null`. Scoped by both
  `exerciseId` and `programExerciseId` (not just `exerciseId`, which
  `getWorkingSetHistory`'s `ExerciseHistoryEntry` doesn't carry) since two
  different slots could in principle share the same exercise.
- **`getLastWeekSimpleValue(programExerciseId, weekNumber)`**
  (`src/db/programLogEntries.ts`) — the `ProgramLogEntry.values` last entry
  for this slot at `weekNumber - 1` (bodyweight_reps/time/distance slots,
  `chosenCategory` unset), or `undefined`.
- **`getLastWeekCategoryValue(programExerciseId, weekNumber, category)`**
  (`src/db/programLogEntries.ts`) — same, scoped to a specific
  `chosenCategory` (Arm Farm), since the category picked can differ week to
  week and only a same-category match is comparable.

Plus one date helper, **`addDays(dateIso, n)`** in `src/lib/dates.ts`, used to
resolve a viewed day's actual calendar date as
`addDays(week.startDate, day.dayNumber - 1)` — the same Monday-start-week
alignment `getActiveProgramDay` already assumes (a pre-existing, documented
forward risk; this reuses it in one more place, doesn't worsen it).

## Comparison logic

A new pure module, `src/lib/compareProgress.ts`, no DB access:

```ts
export type ProgressBadge = 'beat' | 'matched' | 'fell-short'

export function compareWeightSets(
  thisWeek: { weightLbs: number; reps: number },
  lastWeek: { weightLbs: number; reps: number } | null,
  targetReps: number | null // last value of this week's workingTargets
): ProgressBadge | null // null when lastWeek is null — nothing to compare

export function compareSimpleValues(
  thisWeek: number,
  lastWeek: number | null
): ProgressBadge | null
```

`compareWeightSets` rules (matching the user's own framing):
- **matched** — same weight AND same reps as last week's last set.
- **beat** — heavier weight AND target reps hit, OR the same weight with
  more reps than last week (this second case wasn't explicit in the
  original three rules but was confirmed as intentional during design).
- **fell short** — everything else (less weight, fewer reps, or heavier
  weight that missed the target).

`compareSimpleValues` is a plain three-way numeric comparison (beat = greater,
matched = equal, fell short = less) — no target-reps nuance, since
bodyweight/time/distance slots have no separate "weight" axis. Used for
non-weight measure types and, once a matching category is found, for Arm
Farm.

Both return `null` when there's no prior-week data (Week 1, or the slot
didn't exist yet) — the UI omits the "Last week" line and badge entirely in
that case, not an "N/A" placeholder.

## Screens & flow

- **`ProgramSlotCard`** (`src/components/ProgramSlotCard.tsx`, currently used
  by Log Lift's program-day section only) — each measure-type sub-form
  fetches its own last-week value via the new queries above and renders a
  "Last week: …" line plus the badge, recomputed live via `useLiveQuery` as
  new sets are logged. The existing all-time "PR!" badge is unrelated and
  unaffected — both can show together (e.g. you beat last week and it's also
  an all-time PR).
  - `WeightSlotForm`: "Last week: {weightLbs} lbs x {reps}" + badge, using
    `getLastWeekWeightResult` and `compareWeightSets` against the most
    recently logged set today and this week's final `workingTargets` value.
  - `SimpleValueSlotForm`: "Last week: {value}" + badge, using
    `getLastWeekSimpleValue` and `compareSimpleValues` against the most
    recently logged value today.
  - `CategoryChoiceSlotForm`: once a category is selected, "Last week
    ({category}): {value}" + badge, using `getLastWeekCategoryValue` scoped
    to that category — omitted entirely if that category wasn't logged last
    week.

- **`Program.tsx`** — currently renders a read-only `SlotHeader` per slot for
  the current week only. Changes to render the full `ProgramSlotCard`
  (header + logging form + last-week/badge) for every slot on every day
  shown, exactly as Log Lift already does for today — the only change is
  which `date` gets passed in: `addDays(week.startDate, day.dayNumber - 1)`
  instead of always today's date. `SlotHeader` and `ExerciseInfo` are no
  longer imported directly by `Program.tsx` once `ProgramSlotCard` (which
  already renders `SlotHeader` internally) takes over per-slot rendering.

## Edge cases

- **No prior week** (Week 1, or a slot's first week existing): last-week
  queries return `null`/`undefined`; badge and line are omitted, not shown as
  empty/N/A.
- **Multiple sets per session**: "this week's" value for the comparison is
  always the most recently logged set/value today — logging a 2nd or 3rd set
  re-evaluates the badge against the same last-week anchor.
- **Arm Farm, no matching category logged last week**: comparison and line
  are omitted for that category until a category you also logged last week
  is picked.
- **Day-of-week alignment**: computing a viewed day's calendar date via
  `week.startDate + (dayNumber - 1)` relies on the pre-existing
  Monday-start-week assumption documented as a forward risk in the original
  Weekly Program plan. Unaffected in scope or severity by this change.

## Testing approach

Following the existing TDD patterns in this codebase (Vitest + RTL +
fake-indexeddb):

- **Data layer** — unit tests for the three new query functions against real
  Dexie, including the "no prior week" → `null`/`undefined` case, in the
  style of the existing `programLogEntries.test.ts`/`workouts.test.ts`.
- **`compareProgress.ts`** — pure-function tests, one per rule: beat via
  heavier weight + target hit, beat via same weight + more reps, matched,
  and each fell-short path (less weight, fewer reps, heavier-but-missed-target).
- **`ProgramSlotCard`** — extend its existing suite: last-week line + badge
  correct per measure type; omitted when there's no prior week; Arm Farm
  category-mismatch omission.
- **`Program.tsx`** — extend its existing suite: a non-today day is now
  loggable (previously read-only), and the resulting entry lands on the
  correctly computed calendar date.
