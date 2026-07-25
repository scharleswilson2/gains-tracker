# Weekly Program Feature — Design Spec

Date: 2026-07-25

## Purpose

Add coach-given monthly training programs to Gains Tracker. A **Program** covers a
calendar date range (e.g. June 29 – July 24, 2026) and is organized into
**Days** (Day 1, 2, 4, 5 — Day 3 is a rest day and stays untracked) and
**Weeks** (1–4, each with explicit start/end dates). Each day has one or more
**exercise slots**, grouped visually by block letter (A/B/C), with a
prescription (sets/reps/tempo/RIR) that can differ week to week.

Log Lift becomes program-aware: on a program day, it shows that day's
prescribed exercises with the current week's target as a guide, and you log
your actual performance right there. Free-form logging (today's existing
flow) remains fully available alongside it — the program guides, it doesn't
replace. Every month the coach issues a new program; past programs remain
browsable, and exercise history (Progress screen) shows which program/week a
given session belonged to.

An exercise glossary (a `description` field on the existing `Exercise`
entity) is added so unfamiliar movement names show a short how-to.

## Data model

- **Program** — `id`, `name` (e.g. "June 29 – July 24, 2026"), `startDate`,
  `endDate` (ISO dates).
- **ProgramWeek** — `id`, `programId`, `weekNumber` (1–4), `startDate`,
  `endDate` — taken directly from the coach's literal week boundaries, not
  computed from `startDate`/7-day math (the given ranges aren't perfectly
  uniform 7-day blocks).
- **ProgramDay** — `id`, `programId`, `dayNumber` (1, 2, 4, or 5 — 3 is
  intentionally absent).
- **ProgramExercise** (one slot in one day) — `id`, `dayId`, `exerciseId`
  (FK to `Exercise`), `blockLabel` ("A" | "B" | "C" | null — display grouping
  only, not an enforced circuit), `orderIndex`, `measureType` (`weight` |
  `bodyweight_reps` | `time` | `distance` | `category_choice`), `eachSide`
  (bool), `tempo` (raw string, e.g. `"4/1/0"` — informational only, not
  parsed/validated). `category_choice` slots additionally carry
  `categoryOptions`: an array of `{ categoryLabel: string, exercises: string[] }`
  (the fixed menu, e.g. 4 entries for Arm Farm) and `categoriesToPick: number`
  (e.g. 3 of 4).
- **ProgramPrescription** (one row per `ProgramExercise` per week) — `weekNumber`,
  `rir` (`'L' | 'M' | 'H' | null`), `warmupTargets: number[]` (rep targets for
  warmup sets, e.g. `[5, 4]`), `workingTargets: number[]` (rep/time/distance
  targets per working set, NOT assumed uniform — e.g. `[3, 3, 3, 5]`),
  `isTest: boolean` (true only for the Week 4 Vertical Jump case).
- **Exercise** (existing table) — add optional `description: string`.

**Logging split by measure type:**
- `weight` slots log through the *existing* `WorkoutSession` → `ExerciseEntry`
  → `SetRecord` chain (Tasks 3–5), unchanged — PR detection, estimated 1RM,
  and volume charts keep working exactly as today. `ExerciseEntry` gains
  optional `programExerciseId` + `weekNumber` fields so later views can show
  which cycle a session belonged to. Warmup sets are logged the same way,
  flagged `isWarmup: boolean` on `SetRecord` and excluded from PR/volume/1RM
  math.
- `bodyweight_reps` / `time` / `distance` / `category_choice` slots log into a
  new **ProgramLogEntry** table: `id`, `programExerciseId`, `date`,
  `weekNumber`, `values: number[]` (one number per set — reps, seconds, or
  yards, per the slot's `measureType`), `isWarmup: boolean[]` (parallel
  array), and for `category_choice` only: `chosenCategory: string`,
  `chosenExercise: string`. Deliberately decoupled from PR/1RM — that math
  doesn't mean anything for a plank hold or a sprint time.

## Screens & flow

- **Log Lift** (route `/`) detects the active `Program`/`ProgramWeek`/`ProgramDay`
  for today's date (matched by date range + day-of-week position within the
  program) and, when one exists, shows that day's exercise slots grouped by
  block letter, each showing the current week's prescription as a target
  (e.g. "Target: 3, 3, 3, 5 @ M RIR", or "TEST" for a test week) above a
  logging form matched to that slot's `measureType`. A "Log something else"
  affordance stays available for free-form logging, unchanged from today.
  Days with no active program slot (including Day 3) fall back to pure
  free-form, exactly as the app behaves today.
- **New "Program" tab** — 5th bottom-nav entry (Log Lift / Log Catching /
  Program / Progress / History). Shows the current week's full schedule
  across all days, and a picker to browse past months' programs.
- **Exercise glossary** — tapping an exercise name (in the Program tab, in
  Log Lift's program view, or in Progress/History) opens its description in
  a small detail view.

## History & Progress integration

- Progress screen's per-exercise history (weight/est-1RM/volume charts) shows
  a small program/week label per data point when `programExerciseId` is set
  (e.g. "July 2026, Wk 3"), so a lift's history reads against the coach cycle
  it belonged to, not just a bare date.
- History screen's combined feed gains a 4th row type for `ProgramLogEntry`
  records (e.g. "Copenhagen Plank: 25s × 3 each"), alongside the existing
  lift / catching / bodyweight rows.
- Past programs remain fully intact and browsable via the Program tab after
  a new month's program is entered — nothing is overwritten or archived out
  of reach.

## Seed data: June 29 – July 24, 2026 program

This is real, live data entered as the first `Program` record (not test
fixtures) — the exact coach-given plan from the brainstorming conversation,
covering Days 1, 2, 4, 5 across Weeks 1–4, plus glossary descriptions for
every exercise named in it. The full transcription (every slot's block
letter, measure type, tempo, RIR, and per-week targets) is worked out during
implementation planning directly from the coach's original text — re-copying
all ~30 exercises × 4 weeks here would just be a second, error-prone
transcription of the same source. The plan must reference the original
program text (reproduced in the brainstorming conversation this spec came
from) as its source of truth for exact values, and follow the interpretive
assumptions below for the handful of ambiguous notations.

### Assumptions (confirm/correct during plan review if any are wrong)

- **Copenhagen Plank, Week 3** ("3x30s", no "ea" in the coach's text unlike
  weeks 1/2/4): assumed still per-side, i.e. `eachSide: true` throughout,
  consistent with weeks 1, 2, and 4.
- **"Nx"-style speed/agility drills** with no reps/distance given (Day 2's
  "5-10-5, 4x"; Day 4's "10yd build-up with 20yd sprints, 4x"): modeled as
  `bodyweight_reps` slots with a single working target of `[4]` (4
  reps/attempts), since no other unit is specified.
- **DB Pull Throughs, "5ea, 5ea"**: per-side (`eachSide: true`), 2 working
  sets of 5 reps each side — confirmed, matching Reverse Lunge's `ea` usage
  elsewhere rather than "each set."
- **"Recovery"** (listed at the end of every day) is a plain display note,
  not a loggable slot.
- **Arm Farm / Arm Care** (Day 5): modeled with a simplified logging shape —
  rather than fully typing each of the ~20 individual accessory exercises'
  own measure type (they vary: some are weight+reps, some are holds, some
  are timed), a `category_choice` log entry just records a number value
  (reps or seconds, whichever applies to the chosen exercise) plus which
  exercise was picked. This keeps the category-menu slot flexible without
  over-modeling every possible accessory movement's measurement type.

## Tech & non-functionals

- No new dependencies — same stack (Dexie/IndexedDB, React, Recharts).
- Program data is entered once (this seed) via a data-layer script/migration
  during implementation, not through a "create program" UI — building a full
  program-authoring UI is out of scope for this spec; editing/adding future
  months' programs happens the same way (a data-entry task) until/unless a
  dedicated authoring UI is requested later.
- Existing lbs/ISO-date/Epley-formula global constraints from the original
  design spec continue to apply unchanged.

## Explicitly out of scope (for this spec)

- A UI for authoring/editing programs (coach enters it, or it's data-entered
  during implementation for now).
- Enforced circuit/alternating-set flow for A/B/C blocks (display grouping
  only, per earlier decision).
- Deep per-exercise measurement typing for Arm Farm's accessory menu (see
  Assumptions above).
- Any change to the existing free-form logging, PR detection, or 1RM/volume
  math for weight-based lifts — this feature adds context on top, it doesn't
  change that logic.
