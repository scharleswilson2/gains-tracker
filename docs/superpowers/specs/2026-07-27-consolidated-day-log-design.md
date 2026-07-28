# Consolidated Day Log — Design

## Overview

Phase 1 of a two-phase rework of the logging UI. This phase is purely
structural/functional — no visual design system work (colors, spacing,
typography, cards) is in scope here; that's a separate follow-up spec applied
on top of the structure defined below.

Goals, taken from the requested changes:

1. Per-set weight tracking — each prescribed set gets its own weight field.
2. Bodyweight-type sets (reps/time/distance, no weight) get a completion
   checkbox instead of a value input.
3. Left/right arrows at the top of the screen become the primary way to move
   between program days.
4. RPE tracking is removed from the app entirely.
5. The separate "Program" and "Log Lift" tabs are merged into one
   consolidated view, navigated via the day arrows.
6. A "Log Bodyweight" tab is added to the bottom nav bar (moving out of the
   header icon).

## Non-Goals (deferred to the visual-design phase)

- Card layout, button/input styling, typography hierarchy, spacing scale,
  color system, dark mode, bottom-nav icon/active-state styling.
- Any change to `LogCatching`, `Progress`, `History`, or `Settings` screens.
- Any change to the category-choice slot form's structure (Arm Farm) beyond
  what's needed to drop RPE (which it never had) — its visual treatment is
  phase 2.

## Data model changes

- **Remove `rpe` from `SetRecord`** (`src/db/schema.ts`). No Dexie version
  bump needed — `rpe` was never indexed, so existing rows simply keep an
  unused `rpe` property that nothing reads anymore.
- **`ProgramLogEntry` and `ProgramExercise` are unchanged.** They already
  have no RPE concept.

## New/changed DB functions

`src/db/workouts.ts`:

- `addSet` / `logWeightSet` drop the `rpe` parameter.
- New `getSetsForExerciseOnDate(exerciseId, date): Promise<{ warmup: SetRecord[]; working: SetRecord[] }>`
  — the sets logged for one exercise on one date, split by `isWarmup`, in
  insertion order (relying on ascending auto-increment `id`, same ordering
  assumption `flattenHistorySets` and the existing "today's sets" list
  already depend on). Row *i* of the fixed-row UI maps to element *i* of the
  matching list: present → that row is logged; absent → that row is still
  open.
- New `updateSet(setId, { weightLbs, reps }): Promise<void>` — in-place edit
  of an already-logged set, used when a row's weight/reps are changed after
  the fact. No ordering constraint: any row can be edited any time, since
  each row is backed by a real `SetRecord.id`.

`src/db/programLogEntries.ts`:

- New `removeLastProgramLogValue(programExerciseId, date, weekNumber): Promise<void>`
  — pops the last value (and its `isWarmup` flag) off the date's
  no-category entry; deletes the entry row entirely if that empties it.
  This is the "uncheck" side of the bodyweight-row checkbox. Checkbox rows
  are sequential — you check the next open row (→ `appendProgramLogValue`
  with that row's target value) or uncheck the most recently checked one
  (→ `removeLastProgramLogValue`); there's no arbitrary-index toggle, which
  keeps the array-backed storage simple and matches how a set actually gets
  performed (in order).

`src/db/programs.ts`:

- New `listAllProgramDaysChronological(): Promise<DatedProgramDay[]>` where
  `DatedProgramDay = { program: Program; week: ProgramWeek; day: ProgramDay; date: string }`
  — every day across every seeded program, each resolved to its concrete
  calendar date (same `addDays(week.startDate, day.dayNumber - 1)`
  calculation `Program.tsx` already does), sorted ascending by date. This is
  the backing list the day-arrows step through — with only two ~16-day
  programs today this is a trivial in-memory list, no pagination needed.

## Component architecture

### `DayNavigator`

New component: left/right arrow buttons plus a header showing
`Day {n} — {date}` and `Week {n} · {program.name}`. Holds the current
position as an index into `listAllProgramDaysChronological()`'s result,
defaulting to whichever entry matches today's date (falling back to the
closest entry if today isn't inside any program). Arrows move the index by
±1; disabled at the two ends of the list. Days outside the current live
week (`today` not between `week.startDate`/`endDate`) render read-only,
exactly as `Program.tsx` does today via `isLiveWeek` / `SlotHeader`-only
fallback — browsing is unrestricted, logging isn't.

### Consolidated screen (replaces `Program.tsx` and `LogLift.tsx`)

`LogLift.tsx` is rewritten in place (kept as the `/` route) to:

1. Render `DayNavigator` at the top.
2. Render the selected day's slots grouped by block (same
   `groupSlotsByBlock` call as today), using `ProgramSlotCard` when the day
   is live and interactive, `SlotHeader` alone when it's read-only/historical.
3. Keep the existing free-form "search any exercise, log a set" section
   below, unchanged except for RPE removal (see below). It has no
   prescription to build fixed rows from, so it stays append-only.

`Program.tsx` is deleted; the `/program` route is removed from `App.tsx`.

### Fixed-row set entry (`ProgramSlotCard`)

`WeightSlotForm` becomes a list of rows: warmup rows first (from
`prescription.warmupTargets`), then working rows (from
`prescription.workingTargets`), each row labeled with its target rep count.
Each row has its own Weight + Reps inputs (Reps pre-filled with that row's
target, editable); an already-logged row's inputs are pre-filled from its
`SetRecord` and edits call `updateSet`. A row with no target yet — i.e. the
next unlogged one — calls `logWeightSet`/`addSet` (with the row's
`isWarmup` flag) on submit. Below the fixed rows, a "+ Add extra set"
control appends one more open row (still weight+reps, `isWarmup: false`,
uncapped) for AMRAP/bonus volume; extra sets aren't deletable in this
phase, matching the app's current lack of any delete affordance elsewhere.

`SimpleValueSlotForm` (bodyweight_reps/time/distance) becomes the same
row-per-target layout, but each row is a checkbox instead of a value input.
Checking the next open row logs that row's target value via
`appendProgramLogValue`; unchecking the most recently checked row calls
`removeLastProgramLogValue`. A "+ Add extra set" control is offered here
too, for consistency with weight rows — it logs the same value as the last
defined working target (`workingTargets[workingTargets.length - 1]`), since
that's the only target value available once the prescribed rows are
exhausted.

`CategoryChoiceSlotForm` is untouched structurally.

### Free-form logging (bottom of the consolidated screen)

Unchanged except:

- RPE input removed.
- A "No weight (bodyweight)" checkbox appears once an exercise is selected;
  checking it hides the Weight input, leaving only Reps (there's no
  prescribed target here to default a checkbox to, so this stays a numeric
  Reps field rather than becoming a pure checkbox — the goal is just
  dropping the irrelevant weight box, not losing rep-count fidelity for
  ad hoc lifts).

### Nav bar

`NavBar.tsx`: replace the `Log Lift` / `Program` links with a single `Log`
link to `/`. Add a `Bodyweight` link to `/bodyweight` (currently only
reachable via the header ⚖ icon — that header icon is removed once the tab
exists, to avoid a duplicate entry point). Resulting tabs: `Log`,
`Log Catching`, `Progress`, `History`, `Bodyweight`. `Settings` stays as a
header icon (not part of this rework).

## Testing approach

- `Program.test.tsx` and its scenarios are folded into a rewritten
  `LogLift.test.tsx` covering the consolidated view + `DayNavigator`.
- `ProgramSlotCard.test.tsx` updated for row-based rendering (per-row
  weight/reps, per-row checkboxes, extra-set control).
- New unit tests for `getSetsForExerciseOnDate`, `updateSet`,
  `removeLastProgramLogValue`, `listAllProgramDaysChronological`.
- `programIntegration.test.tsx` updated for the new row-completion flow
  (it currently drives a single Weight/Reps/Add-Set interaction — becomes
  "fill row 1's weight/reps, submit that row").
- Any assertion on an `rpe`/`RPE` label anywhere is deleted.
