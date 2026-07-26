# Weekly Program — UI Integration Implementation Plan (Plan B of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UI on top of Plan A's data layer: Log Lift becomes program-aware
(shows today's prescribed exercises with an adaptive logging form per measure
type), a new Program tab shows the current week's schedule and past programs,
an exercise glossary detail view is reachable everywhere an exercise name
appears, and Progress/History show program/week context.

**Architecture:** Extends the existing screens rather than replacing them.
`LogLift` gains a program-day section (rendered via a new `ProgramSlotCard`
component that adapts its logging form to the slot's `measureType`) above the
existing free-form logging section, which is retained unchanged in spirit but
refactored to share PR-detection logic with the new program path via a new
`logWeightSet` helper — this also fixes a real bug: today, neither the
free-form nor a future program-aware weight log excludes warmup-flagged sets
from PR/volume/1RM math, even though `workingSetsOnly()` was built for exactly
that in Plan A and nothing calls it yet. A new `Program` screen becomes a 5th
bottom-nav tab. A small reusable `ExerciseInfo` component gives every exercise
name a tap-for-description affordance. Progress and History get small,
additive changes: Progress's per-exercise queries switch to the
warmup-excluding history variant and gain a week-number label; History gains a
4th combined-feed row type for non-weight program log entries.

**Tech Stack:** Same as the existing app — React, TypeScript, Dexie.js,
Recharts, Vitest + React Testing Library + fake-indexeddb. No new
dependencies.

## Global Constraints

- Weight unit is lbs throughout (existing constraint).
- Dates are ISO strings `YYYY-MM-DD` throughout (existing constraint).
- Warmup-flagged sets (`SetRecord.isWarmup: true`) must never be included in
  PR detection, estimated-1RM, or volume calculations, anywhere in the app —
  this was true in intent since Plan A but is not yet true in practice for
  either LogLift's free-form logging or Progress's charts, since nothing
  calls `workingSetsOnly()` yet. This plan closes that gap as part of Task 1
  and Task 5/7, not as an optional extra.
- A/B/C/Speed block labels are a display grouping only, never an enforced
  alternating circuit (existing decision from the original app design,
  reaffirmed for the program feature in its design spec).
- Free-form logging must remain available on every Log Lift visit, program
  day or not — the program guides, it does not replace (explicit design
  decision, confirmed with the user during brainstorming).
- Arm Farm's `category_choice` slot allows up to `categoriesToPick` (3)
  distinct logged categories per day; re-logging the same category on the
  same date updates that category's entry in place rather than creating a
  duplicate row.

---

### Task 1: Data-layer and shared-logic additions

**Files:**
- Modify: `src/db/workouts.ts`, `src/db/workouts.test.ts`
- Modify: `src/db/programLogEntries.ts`, `src/db/programLogEntries.test.ts`
- Modify: `src/db/programs.ts`, `src/db/programs.test.ts`
- Modify: `src/db/exercises.ts`, `src/db/exercises.test.ts`
- Modify: `src/db/programExercises.ts`, `src/db/programExercises.test.ts`
- Create: `src/lib/logWeightSet.ts`
- Test: `src/lib/logWeightSet.test.ts`

**Interfaces:**
- Consumes: everything already in `src/db/*.ts` and `src/lib/prDetection.ts`
  from Plan A and the original app build.
- Produces:
  - `workouts.ts`: `getWorkingSetHistory(exerciseId: number):
    Promise<ExerciseHistoryEntry[]>` (like `getExerciseHistory`, but each
    entry's `sets` is pre-filtered through `workingSetsOnly`, and entries left
    with zero sets after filtering are dropped entirely). `ExerciseHistoryEntry`
    gains an optional `weekNumber?: number` field, sourced from the
    `ExerciseEntry` it was built from. `getOrCreateExerciseEntry` now
    backfills `programExerciseId`/`weekNumber` onto an **existing** entry if
    that entry currently has no `programExerciseId` (e.g. it was created
    earlier the same day by free-form logging, then later tagged by a
    program-aware log) — still never overwrites an entry that already has a
    *different* program tag (the existing "does not overwrite" test keeps
    passing unchanged).
  - `programLogEntries.ts`: `getProgramLogEntriesForDate(programExerciseId:
    number, date: string): Promise<ProgramLogEntry[]>`; `upsertProgramLogEntry(
    input: AddProgramLogEntryInput): Promise<number>` (upserts by
    `(programExerciseId, date, chosenCategory ?? null)` — same slot+date+
    category re-submitted updates in place; a different category on the same
    slot+date is a new row, which is exactly Arm Farm's "up to 3 categories
    per day" shape).
  - `programs.ts`: `listPrograms(): Promise<Program[]>` (descending by
    `startDate`, i.e. newest first), `listProgramWeeks(programId: number):
    Promise<ProgramWeek[]>` (ascending by `weekNumber`), `listProgramDays(
    programId: number): Promise<ProgramDay[]>` (ascending by `dayNumber`),
    `CurrentProgramWeek` (`{ program: Program; week: ProgramWeek }`),
    `getCurrentProgramWeek(date: string): Promise<CurrentProgramWeek | null>`
    (finds the program/week whose date range contains `date`, regardless of
    day-of-week — unlike `getActiveProgramDay`, this doesn't require an actual
    training day; falls back to the most recently started program's final
    week if `date` isn't inside any program, so there's always something
    sensible for the Program tab to show even on a rest day or weekend).
  - `exercises.ts`: `listExercisesWithHistory(): Promise<Exercise[]>` (only
    exercises that have at least one `ExerciseEntry`, for Progress's picker).
  - `programExercises.ts`: `groupSlotsByBlock(slots: ResolvedSlot[]):
    [string, ResolvedSlot[]][]` (groups already-sorted `getDaySlots` output
    into consecutive same-`blockLabel` runs, using `'Other'` for `null`
    labels — a pure function, reused by both the Log Lift day view and the
    Program tab's schedule view).
  - `src/lib/logWeightSet.ts`: `LogWeightSetInput` (`{ exerciseId: number;
    date: string; weightLbs: number; reps: number; rpe?: number; isWarmup?:
    boolean; programExerciseId?: number; weekNumber?: number }`),
    `logWeightSet(input: LogWeightSetInput): Promise<PrResult>` — the shared
    "log a weight set and tell me if it was a PR" operation. **Warmup sets
    never trigger a PR check** (returns `{ isWeightPr: false,
    isEstimated1RmPr: false }` immediately) since a PR badge on an
    intentionally submaximal warmup makes no sense. Non-warmup sets check PR
    status against `getWorkingSetHistory` (so a prior warmup can never be
    mistaken for a working-set record). Task 5 (Log Lift) and Task 4
    (`ProgramSlotCard`) both call this instead of duplicating the
    session/entry/set/PR sequence.

- [ ] **Step 1: Write the failing tests for workouts.ts changes**

Add to `src/db/workouts.test.ts` (keep all existing tests; add these):
```ts
describe('getWorkingSetHistory', () => {
  it('excludes warmup sets and drops entries left with zero sets', async () => {
    const exerciseId = await addExercise('Test Warmup Exercise')
    const session1 = await getOrCreateSessionForDate('2026-07-01')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 45, 5, undefined, true) // warmup only this session

    const session2 = await getOrCreateSessionForDate('2026-07-08')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 45, 5, undefined, true) // warmup
    await addSet(entry2, 225, 5, undefined, false) // working set

    const history = await getWorkingSetHistory(exerciseId)
    expect(history).toHaveLength(1) // 2026-07-01 dropped entirely (all warmup)
    expect(history[0].date).toBe('2026-07-08')
    expect(history[0].sets).toHaveLength(1)
    expect(history[0].sets[0].weightLbs).toBe(225)
  })
})

it('getExerciseHistory includes weekNumber from the entry when present', async () => {
  const exerciseId = await addExercise('Test Week Tag Exercise')
  const sessionId = await getOrCreateSessionForDate('2026-07-06')
  const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2)
  await addSet(entryId, 135, 5)
  const history = await getExerciseHistory(exerciseId)
  expect(history[0].weekNumber).toBe(2)
})

it('getOrCreateExerciseEntry backfills a program tag onto an existing untagged entry', async () => {
  const exerciseId = await addExercise('Test Backfill Exercise')
  const sessionId = await getOrCreateSessionForDate('2026-07-06')
  const entryId1 = await getOrCreateExerciseEntry(sessionId, exerciseId) // untagged, e.g. free-form
  const entryId2 = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2) // same slot, now tagged
  expect(entryId1).toBe(entryId2)
  const entry = await db.exerciseEntries.get(entryId1)
  expect(entry?.programExerciseId).toBe(42)
  expect(entry?.weekNumber).toBe(2)
})
```
(`db` is already imported in this test file; no new imports needed beyond
adding `getWorkingSetHistory` to the existing `from './workouts'` import
list.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: FAIL — `getWorkingSetHistory` not exported; `weekNumber`/backfill
assertions fail against current behavior.

- [ ] **Step 3: Implement the workouts.ts changes**

In `src/db/workouts.ts`, update `ExerciseHistoryEntry`, `getExerciseHistory`,
`getOrCreateExerciseEntry`, and add `getWorkingSetHistory`:

```ts
export interface ExerciseHistoryEntry {
  date: string
  sets: SetRecord[]
  weekNumber?: number
}

export async function getOrCreateExerciseEntry(
  sessionId: number,
  exerciseId: number,
  programExerciseId?: number,
  weekNumber?: number
): Promise<number> {
  return db.transaction('rw', db.exerciseEntries, async () => {
    const existing = await db.exerciseEntries
      .where('sessionId')
      .equals(sessionId)
      .and((e) => e.exerciseId === exerciseId)
      .first()
    if (existing) {
      if (existing.programExerciseId === undefined && programExerciseId !== undefined) {
        await db.exerciseEntries.update(existing.id!, { programExerciseId, weekNumber })
      }
      return existing.id!
    }
    return db.exerciseEntries.add({ sessionId, exerciseId, programExerciseId, weekNumber })
  })
}

export async function getExerciseHistory(
  exerciseId: number
): Promise<ExerciseHistoryEntry[]> {
  const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
  const results: ExerciseHistoryEntry[] = []
  for (const entry of entries) {
    const session = await db.workoutSessions.get(entry.sessionId)
    if (!session) continue
    const sets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
    results.push({ date: session.date, sets, weekNumber: entry.weekNumber })
  }
  results.sort((a, b) => a.date.localeCompare(b.date))
  return results
}

export async function getWorkingSetHistory(exerciseId: number): Promise<ExerciseHistoryEntry[]> {
  const history = await getExerciseHistory(exerciseId)
  return history
    .map((h) => ({ ...h, sets: workingSetsOnly(h.sets) }))
    .filter((h) => h.sets.length > 0)
}
```
(`getLastSessionSets` and `flattenHistorySets` are unchanged — leave them
exactly as they are.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: PASS (all prior tests plus the 3 new ones)

- [ ] **Step 5: Write the failing tests for programLogEntries.ts changes**

In `src/db/programLogEntries.test.ts`, replace the existing import line:
```ts
import { addProgramLogEntry, getProgramLogEntries } from './programLogEntries'
```
with:
```ts
import {
  addProgramLogEntry,
  getProgramLogEntries,
  getProgramLogEntriesForDate,
  upsertProgramLogEntry,
} from './programLogEntries'
```

Then add to `src/db/programLogEntries.test.ts`:
```ts
describe('upsertProgramLogEntry / getProgramLogEntriesForDate', () => {
  it('inserts a new entry when none exists for the slot+date+category', async () => {
    const id = await upsertProgramLogEntry({
      programExerciseId: 10,
      date: '2026-07-03',
      weekNumber: 1,
      values: [12],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })
    const entries = await getProgramLogEntriesForDate(10, '2026-07-03')
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe(id)
  })

  it('updates the existing entry in place when the same slot+date+category is re-submitted', async () => {
    const id1 = await upsertProgramLogEntry({
      programExerciseId: 11,
      date: '2026-07-03',
      weekNumber: 1,
      values: [10],
      isWarmup: [false],
    })
    const id2 = await upsertProgramLogEntry({
      programExerciseId: 11,
      date: '2026-07-03',
      weekNumber: 1,
      values: [15],
      isWarmup: [false],
    })
    expect(id1).toBe(id2)
    const entries = await getProgramLogEntriesForDate(11, '2026-07-03')
    expect(entries).toHaveLength(1)
    expect(entries[0].values).toEqual([15])
  })

  it('treats a different category on the same slot+date as a separate entry', async () => {
    await upsertProgramLogEntry({
      programExerciseId: 12,
      date: '2026-07-03',
      weekNumber: 1,
      values: [8],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })
    await upsertProgramLogEntry({
      programExerciseId: 12,
      date: '2026-07-03',
      weekNumber: 1,
      values: [10],
      isWarmup: [false],
      chosenCategory: 'Biceps',
      chosenExercise: 'Hammer Curl',
    })
    const entries = await getProgramLogEntriesForDate(12, '2026-07-03')
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.chosenCategory).sort()).toEqual(['Biceps', 'Triceps'])
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: FAIL — `upsertProgramLogEntry`/`getProgramLogEntriesForDate` not exported.

- [ ] **Step 7: Implement the programLogEntries.ts changes**

Add to `src/db/programLogEntries.ts`:
```ts
export async function getProgramLogEntriesForDate(
  programExerciseId: number,
  date: string
): Promise<ProgramLogEntry[]> {
  return db.programLogEntries
    .where('programExerciseId')
    .equals(programExerciseId)
    .and((e) => e.date === date)
    .toArray()
}

export async function upsertProgramLogEntry(input: AddProgramLogEntryInput): Promise<number> {
  return db.transaction('rw', db.programLogEntries, async () => {
    const existing = await db.programLogEntries
      .where('programExerciseId')
      .equals(input.programExerciseId)
      .and(
        (e) =>
          e.date === input.date &&
          (e.chosenCategory ?? null) === (input.chosenCategory ?? null)
      )
      .first()
    if (existing) {
      await db.programLogEntries.update(existing.id!, input)
      return existing.id!
    }
    return db.programLogEntries.add(input)
  })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: PASS (all prior tests plus the 3 new ones)

- [ ] **Step 9: Write the failing tests for programs.ts changes**

In `src/db/programs.test.ts`, replace the existing import line:
```ts
import { addProgramDay, addProgramWeek, createProgram, getActiveProgramDay } from './programs'
```
with:
```ts
import {
  addProgramDay,
  addProgramWeek,
  createProgram,
  getActiveProgramDay,
  getCurrentProgramWeek,
  listProgramDays,
  listPrograms,
  listProgramWeeks,
} from './programs'
```

Then add to `src/db/programs.test.ts`:
```ts
describe('listPrograms / listProgramWeeks / listProgramDays', () => {
  it('lists programs newest-first by startDate', async () => {
    await createProgram('Older', '2026-05-01', '2026-05-28')
    await createProgram('Newer', '2026-06-29', '2026-07-24')
    const all = await listPrograms()
    expect(all.map((p) => p.name)).toEqual(['Newer', 'Older'])
  })

  it('lists weeks ascending by weekNumber and days ascending by dayNumber', async () => {
    const programId = await createProgram('Test', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 2, '2026-07-06', '2026-07-10')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    await addProgramDay(programId, 5)
    await addProgramDay(programId, 1)

    const weeks = await listProgramWeeks(programId)
    expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2])

    const days = await listProgramDays(programId)
    expect(days.map((d) => d.dayNumber)).toEqual([1, 5])
  })
})

describe('getCurrentProgramWeek', () => {
  it('resolves the program/week containing a date even on a non-training day', async () => {
    const programId = await createProgram('Test', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    const current = await getCurrentProgramWeek('2026-07-01') // Wednesday, rest day
    expect(current?.week.weekNumber).toBe(1)
  })

  it('falls back to the most recent program\'s final week when the date is outside any program', async () => {
    const programId = await createProgram('Old Program', '2026-05-01', '2026-05-28')
    await addProgramWeek(programId, 1, '2026-05-01', '2026-05-05')
    await addProgramWeek(programId, 4, '2026-05-22', '2026-05-28')
    const current = await getCurrentProgramWeek('2099-01-01')
    expect(current?.program.name).toBe('Old Program')
    expect(current?.week.weekNumber).toBe(4)
  })

  it('returns null when there are no programs at all', async () => {
    const current = await getCurrentProgramWeek('2026-07-01')
    expect(current).toBeNull()
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/db/programs.test.ts`
Expected: FAIL — new exports don't exist yet.

- [ ] **Step 11: Implement the programs.ts changes**

Add to `src/db/programs.ts`:
```ts
export async function listPrograms(): Promise<Program[]> {
  const all = await db.programs.toArray()
  return all.sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export async function listProgramWeeks(programId: number): Promise<ProgramWeek[]> {
  const weeks = await db.programWeeks.where('programId').equals(programId).toArray()
  return weeks.sort((a, b) => a.weekNumber - b.weekNumber)
}

export async function listProgramDays(programId: number): Promise<ProgramDay[]> {
  const days = await db.programDays.where('programId').equals(programId).toArray()
  return days.sort((a, b) => a.dayNumber - b.dayNumber)
}

export interface CurrentProgramWeek {
  program: Program
  week: ProgramWeek
}

export async function getCurrentProgramWeek(date: string): Promise<CurrentProgramWeek | null> {
  const weeks = await db.programWeeks
    .filter((w) => w.startDate <= date && date <= w.endDate)
    .toArray()
  if (weeks.length > 0) {
    const week = weeks[0]
    const program = await db.programs.get(week.programId)
    if (program) return { program, week }
  }

  const programs = await listPrograms()
  if (programs.length === 0) return null
  const latestProgram = programs[0]
  const weeksForLatest = await listProgramWeeks(latestProgram.id!)
  if (weeksForLatest.length === 0) return null
  return { program: latestProgram, week: weeksForLatest[weeksForLatest.length - 1] }
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/db/programs.test.ts`
Expected: PASS (all prior tests plus the 5 new ones)

- [ ] **Step 13: Write the failing test for exercises.ts changes**

Add to `src/db/exercises.test.ts`:
```ts
it('listExercisesWithHistory only returns exercises with at least one logged entry', async () => {
  const loggedId = await addExercise('Logged Exercise')
  await addExercise('Never Logged Exercise')
  const sessionId = await db.workoutSessions.add({ date: '2026-07-01' })
  await db.exerciseEntries.add({ sessionId, exerciseId: loggedId })

  const withHistory = await listExercisesWithHistory()
  expect(withHistory.map((e) => e.name)).toEqual(['Logged Exercise'])
})
```
This test file already imports `db` from `./schema` (used by the existing
"stores a description" test). Replace the existing `from './exercises'`
import line:
```ts
import { addExercise, findExerciseByName, listExercises } from './exercises'
```
with:
```ts
import { addExercise, findExerciseByName, listExercises, listExercisesWithHistory } from './exercises'
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run src/db/exercises.test.ts`
Expected: FAIL — `listExercisesWithHistory` not exported.

- [ ] **Step 15: Implement the exercises.ts change**

Add to `src/db/exercises.ts`:
```ts
export async function listExercisesWithHistory(): Promise<Exercise[]> {
  const entries = await db.exerciseEntries.toArray()
  const exerciseIds = new Set(entries.map((e) => e.exerciseId))
  const all = await listExercises()
  return all.filter((ex) => exerciseIds.has(ex.id!))
}
```
`src/db/exercises.ts` already has `import { db } from './schema'` at the top
(alongside `import type { Exercise } from './schema'`) — no import changes
needed in this file, only the new function.

- [ ] **Step 16: Run test to verify it passes**

Run: `npx vitest run src/db/exercises.test.ts`
Expected: PASS

- [ ] **Step 17: Write the failing test for groupSlotsByBlock**

Add to `src/db/programExercises.test.ts`:
```ts
describe('groupSlotsByBlock', () => {
  it('groups consecutive same-blockLabel slots, using "Other" for null', () => {
    const makeSlot = (blockLabel: string | null, exerciseName: string): ResolvedSlot => ({
      programExercise: {
        id: 1,
        dayId: 1,
        exerciseId: 1,
        blockLabel,
        orderIndex: 0,
        measureType: 'bodyweight_reps',
        eachSide: false,
        tempo: null,
      },
      exerciseName,
      prescription: null,
    })
    const slots = [
      makeSlot('A', 'Ex A1'),
      makeSlot('A', 'Ex A2'),
      makeSlot('B', 'Ex B1'),
      makeSlot(null, 'Ex None'),
    ]
    const grouped = groupSlotsByBlock(slots)
    expect(grouped.map(([label, group]) => [label, group.map((s) => s.exerciseName)])).toEqual([
      ['A', ['Ex A1', 'Ex A2']],
      ['B', ['Ex B1']],
      ['Other', ['Ex None']],
    ])
  })
})
```
Replace this test file's `from './programExercises'` import line:
```ts
import { addProgramExercise, addProgramPrescription, getDaySlots } from './programExercises'
```
with:
```ts
import {
  addProgramExercise,
  addProgramPrescription,
  getDaySlots,
  groupSlotsByBlock,
  type ResolvedSlot,
} from './programExercises'
```

- [ ] **Step 18: Run test to verify it fails**

Run: `npx vitest run src/db/programExercises.test.ts`
Expected: FAIL — `groupSlotsByBlock` not exported.

- [ ] **Step 19: Implement groupSlotsByBlock**

Add to `src/db/programExercises.ts`:
```ts
export function groupSlotsByBlock(slots: ResolvedSlot[]): [string, ResolvedSlot[]][] {
  const groups: [string, ResolvedSlot[]][] = []
  for (const slot of slots) {
    const label = slot.programExercise.blockLabel ?? 'Other'
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup[0] === label) {
      lastGroup[1].push(slot)
    } else {
      groups.push([label, [slot]])
    }
  }
  return groups
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `npx vitest run src/db/programExercises.test.ts`
Expected: PASS

- [ ] **Step 21: Write the failing test for logWeightSet**

`src/lib/logWeightSet.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addExercise } from '../db/exercises'
import { getOrCreateExerciseEntry, getOrCreateSessionForDate, addSet } from '../db/workouts'
import { db } from '../db/schema'
import { logWeightSet } from './logWeightSet'

describe('logWeightSet', () => {
  it('logs a set and reports a PR against prior working history', async () => {
    const exerciseId = await addExercise('Test Bench')
    const priorSession = await getOrCreateSessionForDate('2026-07-01')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId)
    await addSet(priorEntry, 185, 5)

    const result = await logWeightSet({
      exerciseId,
      date: '2026-07-08',
      weightLbs: 195,
      reps: 5,
    })

    expect(result.isWeightPr).toBe(true)
    const history = await db.sets.toArray()
    expect(history.some((s) => s.weightLbs === 195 && s.reps === 5)).toBe(true)
  })

  it('never reports a PR for a warmup set, even if the weight would otherwise be one', async () => {
    const exerciseId = await addExercise('Test Squat')
    const result = await logWeightSet({
      exerciseId,
      date: '2026-07-01',
      weightLbs: 315,
      reps: 5,
      isWarmup: true,
    })
    expect(result.isWeightPr).toBe(false)
    expect(result.isEstimated1RmPr).toBe(false)
  })

  it('does not let a prior warmup set count as history when checking a later real PR', async () => {
    const exerciseId = await addExercise('Test Deadlift')
    await logWeightSet({ exerciseId, date: '2026-07-01', weightLbs: 405, reps: 3, isWarmup: true })
    const result = await logWeightSet({ exerciseId, date: '2026-07-01', weightLbs: 225, reps: 3 })
    // 225 beats "nothing" (the 405 was a warmup and doesn't count), so this is a PR
    expect(result.isWeightPr).toBe(true)
  })

  it('tags the exercise entry with programExerciseId/weekNumber when provided', async () => {
    const exerciseId = await addExercise('Test Program Tagged Lift')
    await logWeightSet({
      exerciseId,
      date: '2026-07-06',
      weightLbs: 100,
      reps: 5,
      programExerciseId: 7,
      weekNumber: 2,
    })
    const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
    expect(entries[0].programExerciseId).toBe(7)
    expect(entries[0].weekNumber).toBe(2)
  })
})
```

- [ ] **Step 22: Run test to verify it fails**

Run: `npx vitest run src/lib/logWeightSet.test.ts`
Expected: FAIL — cannot find module `./logWeightSet`

- [ ] **Step 23: Implement logWeightSet**

`src/lib/logWeightSet.ts`:
```ts
import {
  addSet,
  flattenHistorySets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
  getWorkingSetHistory,
} from '../db/workouts'
import { detectPr } from './prDetection'
import type { PrResult } from './prDetection'

export interface LogWeightSetInput {
  exerciseId: number
  date: string
  weightLbs: number
  reps: number
  rpe?: number
  isWarmup?: boolean
  programExerciseId?: number
  weekNumber?: number
}

export async function logWeightSet(input: LogWeightSetInput): Promise<PrResult> {
  const sessionId = await getOrCreateSessionForDate(input.date)
  const entryId = await getOrCreateExerciseEntry(
    sessionId,
    input.exerciseId,
    input.programExerciseId,
    input.weekNumber
  )

  if (input.isWarmup) {
    await addSet(entryId, input.weightLbs, input.reps, input.rpe, true)
    return { isWeightPr: false, isEstimated1RmPr: false }
  }

  const priorHistory = await getWorkingSetHistory(input.exerciseId)
  const priorSets = flattenHistorySets(priorHistory)
  const pr = detectPr({ weightLbs: input.weightLbs, reps: input.reps }, priorSets)
  await addSet(entryId, input.weightLbs, input.reps, input.rpe, false)
  return pr
}
```

Check `src/lib/prDetection.ts` exports a `PrResult` type (it does, from the
original build) — if the exact export name differs, adjust the import to
match rather than redefining the type.

- [ ] **Step 24: Run test to verify it passes**

Run: `npx vitest run src/lib/logWeightSet.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 25: Run the full suite**

Run: `npm test`
Expected: all tests pass, no regressions.

- [ ] **Step 26: Commit**

```bash
git add src/db/workouts.ts src/db/workouts.test.ts \
  src/db/programLogEntries.ts src/db/programLogEntries.test.ts \
  src/db/programs.ts src/db/programs.test.ts \
  src/db/exercises.ts src/db/exercises.test.ts \
  src/db/programExercises.ts src/db/programExercises.test.ts \
  src/lib/logWeightSet.ts src/lib/logWeightSet.test.ts
git commit -m "Add data-layer support for program-aware logging and warmup exclusion"
```

---

### Task 2: App shell — Program tab

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/NavBar.tsx`, `src/components/NavBar.test.tsx`
- Create: `src/screens/Program.tsx` (placeholder — Task 6 fills in the real content)

**Interfaces:**
- Produces: route `/program` → `Program` screen; `NavBar` now renders 5 links
  (Log Lift / Log Catching / Program / Progress / History), matching the
  design spec's stated tab order. Task 6 replaces the placeholder body of
  `Program.tsx` without touching this task's routing/nav wiring.

- [ ] **Step 1: Write the failing test**

Replace the existing test in `src/components/NavBar.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavBar } from './NavBar'

describe('NavBar', () => {
  it('renders links to all five primary screens', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /log lift/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /log catching/i })).toHaveAttribute('href', '/catching')
    expect(screen.getByRole('link', { name: /^program$/i })).toHaveAttribute('href', '/program')
    expect(screen.getByRole('link', { name: /progress/i })).toHaveAttribute('href', '/progress')
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/NavBar.test.tsx`
Expected: FAIL — no link named "Program".

- [ ] **Step 3: Update NavBar**

`src/components/NavBar.tsx`:
```tsx
import { NavLink } from 'react-router-dom'

export function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Log Lift
      </NavLink>
      <NavLink to="/catching" className={({ isActive }) => (isActive ? 'active' : '')}>
        Log Catching
      </NavLink>
      <NavLink to="/program" className={({ isActive }) => (isActive ? 'active' : '')}>
        Program
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => (isActive ? 'active' : '')}>
        Progress
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
        History
      </NavLink>
    </nav>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/NavBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Create the Program screen placeholder**

`src/screens/Program.tsx`:
```tsx
export function Program() {
  return <h1>Program</h1>
}
```

- [ ] **Step 6: Wire up the route**

In `src/App.tsx`, add the import and route (keep everything else unchanged):
```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { LogLift } from './screens/LogLift'
import { LogCatching } from './screens/LogCatching'
import { Program } from './screens/Program'
import { Progress } from './screens/Progress'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">Gains Tracker</span>
          <Link to="/settings" aria-label="Settings" className="settings-link">
            ⚙
          </Link>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<LogLift />} />
            <Route path="/catching" element={<LogCatching />} />
            <Route path="/program" element={<Program />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: Run the full suite and verify the app builds**

Run: `npm test` — expected: all pass.
Run: `npm run build` — expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/NavBar.tsx src/components/NavBar.test.tsx src/screens/Program.tsx
git commit -m "Add Program tab to app shell"
```

---

### Task 3: Exercise glossary detail component

**Files:**
- Create: `src/components/ExerciseInfo.tsx`
- Test: `src/components/ExerciseInfo.test.tsx`

**Interfaces:**
- Consumes: `findExerciseByName` from `../db/exercises`.
- Produces: `ExerciseInfo` (props: `{ name: string }`) — renders the exercise
  name as a toggle button; clicking it looks up the exercise by name and
  expands its `description` (if any) in a `<p>` below. Collapses on a second
  click. Used by Task 4 (`ProgramSlotCard`) and Task 6 (`Program` screen)
  everywhere a program exercise's name is shown.

- [ ] **Step 1: Write the failing test**

`src/components/ExerciseInfo.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseInfo } from './ExerciseInfo'
import { addExercise } from '../db/exercises'

describe('ExerciseInfo', () => {
  it('shows the description when tapped, and hides it again on a second tap', async () => {
    const user = userEvent.setup()
    await addExercise('Front Squat', undefined, 'A barbell squat held in the front rack.')

    render(<ExerciseInfo name="Front Squat" />)

    expect(screen.queryByText(/front rack/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Front Squat' }))
    expect(await screen.findByText(/front rack/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Front Squat' }))
    expect(screen.queryByText(/front rack/i)).not.toBeInTheDocument()
  })

  it('shows a fallback message when the exercise has no description', async () => {
    const user = userEvent.setup()
    await addExercise('Mystery Move')

    render(<ExerciseInfo name="Mystery Move" />)
    await user.click(screen.getByRole('button', { name: 'Mystery Move' }))
    expect(await screen.findByText(/no description/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ExerciseInfo.test.tsx`
Expected: FAIL — cannot find module `./ExerciseInfo`

- [ ] **Step 3: Implement ExerciseInfo**

`src/components/ExerciseInfo.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { findExerciseByName } from '../db/exercises'

export function ExerciseInfo({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false)
  const exercise = useLiveQuery(() => findExerciseByName(name), [name])

  return (
    <div>
      <button type="button" onClick={() => setExpanded((prev) => !prev)}>
        {name}
      </button>
      {expanded && <p>{exercise?.description || 'No description available.'}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ExerciseInfo.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ExerciseInfo.tsx src/components/ExerciseInfo.test.tsx
git commit -m "Add exercise glossary detail component"
```

---

### Task 4: ProgramSlotCard — per-slot logging UI for all measure types

**Files:**
- Create: `src/components/ProgramSlotCard.tsx`
- Test: `src/components/ProgramSlotCard.test.tsx`

**Interfaces:**
- Consumes: `ResolvedSlot` from `../db/programExercises`; `ExerciseInfo` from
  `./ExerciseInfo`; `logWeightSet` from `../lib/logWeightSet`;
  `getProgramLogEntriesForDate`, `upsertProgramLogEntry` from
  `../db/programLogEntries`.
- Produces: `ProgramSlotCard` (props: `{ slot: ResolvedSlot; date: string;
  weekNumber: number }`) — renders the exercise name via `ExerciseInfo`,
  tempo/RIR/target display, and a logging form that adapts to
  `slot.programExercise.measureType`:
  - `'weight'`: weight/reps/rpe inputs (mirroring the existing free-form
    LogLift form) plus a warmup checkbox shown only when the current week's
    `warmupTargets.length > 0`; calls `logWeightSet` on submit, shows "PR!"
    when applicable.
  - `'bodyweight_reps' | 'time' | 'distance'`: a single numeric input + "Add
    Set" button, appending to a running list fetched via
    `getProgramLogEntriesForDate` and saved via `upsertProgramLogEntry` after
    each addition (mirrors the existing Log Catching pop-time quick-add
    pattern already in the app).
  - `'category_choice'`: renders each of `categoryOptions` as a pickable
    category; selecting one reveals its exercise list (a `<select>`); after
    picking both a category and a specific exercise, a numeric input + "Save"
    logs via `upsertProgramLogEntry` with `chosenCategory`/`chosenExercise`
    set. Shows which categories are already logged today (via
    `getProgramLogEntriesForDate`).
  - `prescription.isTest === true` (currently only Week 4's "1 Step Approach
    Vertical Jump"): replaces the numeric target display with "TEST — log
    your result", but still uses the slot's normal `measureType` input for
    logging — there's no separate "test result" field in the data model, and
    adding one for a single slot in the whole program is out of scope for
    this plan.
  Task 5 renders one `ProgramSlotCard` per slot returned by `getDaySlots`,
  grouped via `groupSlotsByBlock`.

- [ ] **Step 1: Write the failing tests**

`src/components/ProgramSlotCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgramSlotCard } from './ProgramSlotCard'
import { addExercise } from '../db/exercises'
import type { ResolvedSlot } from '../db/programExercises'

function makeSlot(overrides: Partial<ResolvedSlot['programExercise']>, prescription: ResolvedSlot['prescription']): ResolvedSlot {
  return {
    programExercise: {
      id: 1,
      dayId: 1,
      exerciseId: 1,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
      ...overrides,
    },
    exerciseName: 'Test Exercise',
    prescription,
  }
}

describe('ProgramSlotCard', () => {
  it('logs a weight set via the weight-type form and shows a PR badge', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Front Squat')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight', tempo: '4/1/0' },
      { id: 1, programExerciseId: 1, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/weight/i), '225')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
  })

  it('shows a warmup checkbox only when the week has warmup targets, and does not flag warmups as PRs', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Bench Press')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 2, programExerciseId: 2, weekNumber: 1, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const warmupCheckbox = screen.getByLabelText(/warmup/i)
    await user.click(warmupCheckbox)
    await user.type(screen.getByLabelText(/weight/i), '45')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
  })

  it('logs a bodyweight_reps set via the simple numeric form', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Depth Drop')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 3, programExerciseId: 3, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/value/i), '3')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/3$/)).toBeInTheDocument()
  })

  it('logs a category_choice (Arm Farm) entry with the picked category and exercise', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Arm Farm')
    const slot = makeSlot(
      {
        exerciseId,
        measureType: 'category_choice',
        categoryOptions: [
          { categoryLabel: 'Triceps', exercises: ['Cable Push Downs', 'OH Tricep Ext'] },
          { categoryLabel: 'Biceps', exercises: ['Hammer Curl', 'Zottman Curl'] },
        ],
        categoriesToPick: 3,
      },
      { id: 4, programExerciseId: 4, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.click(screen.getByRole('button', { name: 'Triceps' }))
    await user.selectOptions(screen.getByLabelText(/exercise/i), 'Cable Push Downs')
    await user.type(screen.getByLabelText(/value/i), '12')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/Triceps.*logged/i)).toBeInTheDocument()
  })

  it('shows TEST instead of numeric targets when the prescription is a test week', async () => {
    const exerciseId = await addExercise('Test Vertical Jump')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 5, programExerciseId: 5, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [], isTest: true }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(screen.getByText(/TEST/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: FAIL — cannot find module `./ProgramSlotCard`

- [ ] **Step 3: Implement ProgramSlotCard**

`src/components/ProgramSlotCard.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { ExerciseInfo } from './ExerciseInfo'
import { logWeightSet } from '../lib/logWeightSet'
import { getProgramLogEntriesForDate, upsertProgramLogEntry } from '../db/programLogEntries'

interface ProgramSlotCardProps {
  slot: ResolvedSlot
  date: string
  weekNumber: number
}

function targetSummary(slot: ResolvedSlot): string {
  const { prescription } = slot
  if (!prescription) return ''
  if (prescription.isTest) return 'TEST'
  const parts: string[] = []
  if (prescription.warmupTargets.length > 0) parts.push(`Warmup: ${prescription.warmupTargets.join(', ')}`)
  if (prescription.workingTargets.length > 0) parts.push(`Working: ${prescription.workingTargets.join(', ')}`)
  return parts.join(' | ')
}

export function ProgramSlotCard({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const { programExercise, prescription } = slot

  return (
    <div>
      <ExerciseInfo name={slot.exerciseName} />
      {programExercise.tempo && <span> Tempo: {programExercise.tempo}</span>}
      {prescription?.rir && <span> RIR: {prescription.rir}</span>}
      <p>{targetSummary(slot)}</p>

      {programExercise.measureType === 'weight' && (
        <WeightSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
      {programExercise.measureType === 'category_choice' && (
        <CategoryChoiceSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
      {(programExercise.measureType === 'bodyweight_reps' ||
        programExercise.measureType === 'time' ||
        programExercise.measureType === 'distance') && (
        <SimpleValueSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
    </div>
  )
}

function WeightSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [isWarmup, setIsWarmup] = useState(false)
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasWarmupTargets = (slot.prescription?.warmupTargets.length ?? 0) > 0

  async function handleAddSet() {
    if (isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: slot.programExercise.exerciseId,
        date,
        weightLbs,
        reps: repsNum,
        isWarmup,
        programExerciseId: slot.programExercise.id,
        weekNumber,
      })
      setWeight('')
      setReps('')
      setIsWarmup(false)
      setPrMessage(!isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const weightId = `weight-${slot.programExercise.id}`
  const repsId = `reps-${slot.programExercise.id}`
  const warmupId = `warmup-${slot.programExercise.id}`

  return (
    <div>
      <label htmlFor={weightId}>Weight (lbs)</label>
      <input id={weightId} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <label htmlFor={repsId}>Reps</label>
      <input id={repsId} type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
      {hasWarmupTargets && (
        <>
          <label htmlFor={warmupId}>Warmup set</label>
          <input
            id={warmupId}
            type="checkbox"
            checked={isWarmup}
            onChange={(e) => setIsWarmup(e.target.checked)}
          />
        </>
      )}
      <button type="button" onClick={handleAddSet} disabled={isSubmitting}>
        Add Set
      </button>
      {prMessage && <p role="status">{prMessage}</p>}
    </div>
  )
}

function SimpleValueSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [value, setValue] = useState('')
  const programExerciseId = slot.programExercise.id!

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedValues = entries[0]?.values ?? []

  async function handleAdd() {
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) return
    const nextValues = [...loggedValues, numValue]
    const nextIsWarmup = [...(entries[0]?.isWarmup ?? []), false]
    await upsertProgramLogEntry({
      programExerciseId,
      date,
      weekNumber,
      values: nextValues,
      isWarmup: nextIsWarmup,
    })
    setValue('')
  }

  const valueId = `value-${programExerciseId}`

  return (
    <div>
      <label htmlFor={valueId}>Value</label>
      <input id={valueId} type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" onClick={handleAdd}>
        Add Set
      </button>
      <ul>
        {loggedValues.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </div>
  )
}

function CategoryChoiceSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState('')
  const [value, setValue] = useState('')
  const programExerciseId = slot.programExercise.id!
  const categoryOptions = slot.programExercise.categoryOptions ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedCategories = entries.map((e) => e.chosenCategory).filter(Boolean)

  async function handleSave() {
    const numValue = Number(value)
    if (!selectedCategory || !selectedExercise || !Number.isFinite(numValue) || numValue <= 0) return
    await upsertProgramLogEntry({
      programExerciseId,
      date,
      weekNumber,
      values: [numValue],
      isWarmup: [false],
      chosenCategory: selectedCategory,
      chosenExercise: selectedExercise,
    })
    setValue('')
  }

  return (
    <div>
      <p>Logged today: {loggedCategories.length > 0 ? loggedCategories.join(', ') : 'none'}</p>
      <div>
        {categoryOptions.map((category) => (
          <button
            key={category.categoryLabel}
            type="button"
            onClick={() => {
              setSelectedCategory(category.categoryLabel)
              setSelectedExercise('')
            }}
          >
            {category.categoryLabel}
          </button>
        ))}
      </div>
      {selectedCategory && (
        <div>
          <label htmlFor={`exercise-${programExerciseId}`}>Exercise</label>
          <select
            id={`exercise-${programExerciseId}`}
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            <option value="" disabled>
              Choose...
            </option>
            {categoryOptions
              .find((c) => c.categoryLabel === selectedCategory)
              ?.exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
          </select>
          <label htmlFor={`value-${programExerciseId}`}>Value</label>
          <input
            id={`value-${programExerciseId}`}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" onClick={handleSave}>
            Save
          </button>
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
```

Note: the test for the bodyweight_reps case expects `screen.findByText(/3$/)`
matching the logged value `3` rendered in the `<li>` list — this works since
`SimpleValueSlotForm` renders each logged value as its own list item.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgramSlotCard.tsx src/components/ProgramSlotCard.test.tsx
git commit -m "Add ProgramSlotCard with adaptive logging forms per measure type"
```

---

### Task 5: Log Lift becomes program-aware

**Files:**
- Modify: `src/screens/LogLift.tsx`, `src/screens/LogLift.test.tsx`

**Interfaces:**
- Consumes: `getActiveProgramDay` from `../db/programs`; `getDaySlots`,
  `groupSlotsByBlock` from `../db/programExercises`; `ProgramSlotCard` from
  `../components/ProgramSlotCard`; `logWeightSet` from `../lib/logWeightSet`
  (replaces the free-form section's inline PR-detection logic).
- Produces: the same `LogLift` export, now rendering a program-day section
  above the existing free-form section when today has an active program day.
  The free-form section's behavior is otherwise unchanged from the user's
  perspective (same inputs, same "last time"/"today's sets" displays, same PR
  badge) — only its internal implementation changes, to close the
  warmup-exclusion gap described in the Global Constraints.

- [ ] **Step 1: Write the failing tests**

In `src/screens/LogLift.test.tsx`, replace the existing import block:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'
```
with:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription } from '../db/programExercises'

vi.mock('../lib/dates', () => ({ todayIso: () => '2026-07-20' }))
```
**Why `2026-07-20` specifically, not an arbitrary date**: the pre-existing
test above ("shows last session reference...") seeds a prior session dated
`2026-07-10` and depends on `today` being AFTER that date for
`getLastSessionSets` to treat it as "last time" — this `vi.mock` applies
file-wide, so it affects that test too, not just the new ones. `2026-07-20`
is both after `2026-07-10` (keeping the existing test correct) and a Monday
(`dayNumber: 1`, matching the new `seedTestProgramDay(1, ...)` calls below).
Do not change this date without re-checking the existing test still passes.

(keep the existing test; add the following alongside it, still inside or
after the existing `describe('LogLift', ...)` block as appropriate):
```tsx
async function seedTestProgramDay(dayNumber: number, exerciseId: number) {
  const programId = await createProgram('Test Program', '2026-07-20', '2026-07-24')
  await addProgramWeek(programId, 1, '2026-07-20', '2026-07-24')
  const dayId = await addProgramDay(programId, dayNumber)
  const slotId = await addProgramExercise({
    dayId,
    exerciseId,
    blockLabel: 'B',
    orderIndex: 0,
    measureType: 'weight',
    eachSide: false,
    tempo: '4/1/0',
  })
  await addProgramPrescription({
    programExerciseId: slotId,
    weekNumber: 1,
    rir: 'M',
    warmupTargets: [5, 4],
    workingTargets: [3, 3, 3, 5],
    isTest: false,
  })
  return { programId, dayId, slotId }
}

it('shows the program day section with a slot when today has an active program day', async () => {
  const exerciseId = await addExercise('Test Program Front Squat')
  await seedTestProgramDay(1, exerciseId) // 2026-07-20 is a Monday = dayNumber 1

  render(<LogLift />)

  expect(await screen.findByText('Test Program Front Squat')).toBeInTheDocument()
  expect(screen.getByText(/Tempo: 4\/1\/0/)).toBeInTheDocument()
})

it('still shows the free-form "Log something else" section on a program day', async () => {
  const exerciseId = await addExercise('Test Program Bench')
  await seedTestProgramDay(1, exerciseId)

  render(<LogLift />)

  expect(await screen.findByText(/log something else/i)).toBeInTheDocument()
})
```

Note: the `vi.mock('../lib/dates', ...)` call already added in the import
block above pins "today" to `2026-07-20` (a Monday), matching
`seedTestProgramDay(1, ...)`'s `dayNumber: 1` argument, so these tests are
deterministic regardless of which real date the suite runs on — `LogLift`
would otherwise use `todayIso()`'s real current date to look up the active
program day.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/LogLift.test.tsx`
Expected: FAIL — no program-day section exists yet in `LogLift`.

- [ ] **Step 3: Implement the program-aware LogLift**

`src/screens/LogLift.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExercise, listExercises } from '../db/exercises'
import { getExerciseHistory, getLastSessionSets } from '../db/workouts'
import { getActiveProgramDay } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { logWeightSet } from '../lib/logWeightSet'
import { todayIso } from '../lib/dates'

export function LogLift() {
  const today = todayIso()
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeDay = useLiveQuery(() => getActiveProgramDay(today), [today])
  const slots = useLiveQuery(
    () => (activeDay ? getDaySlots(activeDay.day.id!, activeDay.week.weekNumber) : Promise.resolve([])),
    [activeDay]
  ) ?? []

  const allExercises = useLiveQuery(() => listExercises(), []) ?? []
  const matches =
    query.length > 0
      ? allExercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
      : []

  const lastSets = useLiveQuery(
    () => (selectedExerciseId ? getLastSessionSets(selectedExerciseId, today) : Promise.resolve([])),
    [selectedExerciseId, today]
  )

  const todaySets = useLiveQuery(async () => {
    if (!selectedExerciseId) return []
    const history = await getExerciseHistory(selectedExerciseId)
    return history.find((h) => h.date === today)?.sets ?? []
  }, [selectedExerciseId, today])

  async function selectExercise(name: string) {
    const id = await addExercise(name)
    setSelectedExerciseId(id)
    setSelectedExerciseName(name)
    setQuery('')
    setPrMessage(null)
  }

  async function handleAddSet() {
    if (!selectedExerciseId || isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    const rpeNum = rpe ? Number(rpe) : undefined

    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) {
      return
    }

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: selectedExerciseId,
        date: today,
        weightLbs,
        reps: repsNum,
        rpe: rpeNum,
      })

      setWeight('')
      setReps('')
      setRpe('')
      setPrMessage(pr.isWeightPr || pr.isEstimated1RmPr ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // `activeDay === undefined` means the live query hasn't resolved yet;
  // `null` means resolved with "no program today" — both are valid states
  // to render the free-form-only screen below, so there's no loading gate
  // needed here (unlike Progress's exercise picker, nothing downstream of
  // `activeDay` requires synchronous option-list presence for tests).

  return (
    <div>
      <h1>Log Lift</h1>

      {activeDay && (
        <section>
          <h2>
            Day {activeDay.day.dayNumber} — Week {activeDay.week.weekNumber}
          </h2>
          {activeDay.day.note && <p>{activeDay.day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel}>
              <h3>{blockLabel}</h3>
              {blockSlots.map((slot) => (
                <ProgramSlotCard
                  key={slot.programExercise.id}
                  slot={slot}
                  date={today}
                  weekNumber={activeDay.week.weekNumber}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      <hr />
      <h2>Log something else</h2>

      <label htmlFor="exercise-input">Exercise</label>
      <input
        id="exercise-input"
        value={selectedExerciseName || query}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelectedExerciseName('')
          setSelectedExerciseId(null)
        }}
        placeholder="Type to search or add an exercise"
      />
      <ul>
        {matches.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => selectExercise(m.name)}>
              {m.name}
            </button>
          </li>
        ))}
        {query.length > 0 && !matches.some((m) => m.name.toLowerCase() === query.toLowerCase()) && (
          <li>
            <button type="button" onClick={() => selectExercise(query)}>
              Add "{query}"
            </button>
          </li>
        )}
      </ul>

      {selectedExerciseId && (
        <div>
          <h2>{selectedExerciseName}</h2>

          {lastSets && lastSets.length > 0 && (
            <p>
              Last time: {lastSets.map((s) => `${s.weightLbs} x ${s.reps}`).join(', ')}
            </p>
          )}

          <div>
            <label htmlFor="weight-input">Weight (lbs)</label>
            <input
              id="weight-input"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="reps-input">Reps</label>
            <input
              id="reps-input"
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rpe-input">RPE (optional)</label>
            <input id="rpe-input" type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </div>
          <button type="button" onClick={handleAddSet} disabled={isSubmitting}>
            Add Set
          </button>

          {prMessage && <p role="status">{prMessage}</p>}

          <h3>Today's sets</h3>
          <ul>
            {(todaySets ?? []).map((s, i) => (
              <li key={i}>
                {s.weightLbs} x {s.reps}
                {s.rpe ? ` @RPE ${s.rpe}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/LogLift.test.tsx`
Expected: PASS (all prior tests plus the 2 new ones)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions. Pay attention to whether the pre-existing
LogLift PR test still passes now that it goes through `logWeightSet` instead
of inline logic — it should, since `logWeightSet`'s non-warmup path is
behaviorally identical to what was inlined before (same
history-fetch-then-detectPr-then-persist sequence), just now sourced from
`getWorkingSetHistory` instead of raw `getExerciseHistory` via
`flattenHistorySets` — check whether that existing test's fixture data
contains any `isWarmup: true` sets that would change its expected outcome
(it shouldn't, since Plan A never created any real warmup data, but verify).

- [ ] **Step 6: Commit**

```bash
git add src/screens/LogLift.tsx src/screens/LogLift.test.tsx
git commit -m "Make Log Lift program-aware while preserving free-form logging"
```

---

### Task 6: Program tab full implementation

**Files:**
- Modify: `src/screens/Program.tsx`, create `src/screens/Program.test.tsx`

**Interfaces:**
- Consumes: `getCurrentProgramWeek`, `listPrograms`, `listProgramDays` from
  `../db/programs`; `getDaySlots`, `groupSlotsByBlock` from
  `../db/programExercises`; `ExerciseInfo` from `../components/ExerciseInfo`;
  `todayIso` from `../lib/dates`.
- Produces: a read-only schedule view. Defaults to the program/week
  containing today (via `getCurrentProgramWeek`, which — unlike
  `getActiveProgramDay` — resolves even on a rest day or weekend). Shows
  every day of that program (`listProgramDays`) with that week's slots
  (`getDaySlots` + `groupSlotsByBlock`, same rendering pattern as Task 5's
  Log Lift section, but without any logging forms — this screen is reference
  only, per the design spec). A `<select>` lets the user browse past programs
  (`listPrograms`); picking one shows its first week by default.

- [ ] **Step 1: Write the failing test**

`src/screens/Program.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Program } from './Program'
import { addExercise } from '../db/exercises'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription } from '../db/programExercises'

vi.mock('../lib/dates', () => ({ todayIso: () => '2026-06-29' }))

describe('Program', () => {
  it('shows the current week\'s schedule by default, with exercise names and targets', async () => {
    const exerciseId = await addExercise('Test Front Squat')
    const programId = await createProgram('July Program', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    const dayId = await addProgramDay(programId, 1)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: '4/1/0',
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: 'M',
      warmupTargets: [5, 4],
      workingTargets: [3, 3, 3, 5],
      isTest: false,
    })

    render(<Program />)

    expect(await screen.findByText('Test Front Squat')).toBeInTheDocument()
    expect(screen.getByText(/Working: 3, 3, 3, 5/)).toBeInTheDocument()
  })

  it('lets the user browse a past program', async () => {
    const user = userEvent.setup()
    const exerciseId1 = await addExercise('Test Current Exercise')
    const currentProgramId = await createProgram('Current Program', '2026-06-29', '2026-07-24')
    await addProgramWeek(currentProgramId, 1, '2026-06-29', '2026-07-03')
    const currentDayId = await addProgramDay(currentProgramId, 1)
    await addProgramExercise({
      dayId: currentDayId,
      exerciseId: exerciseId1,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    const exerciseId2 = await addExercise('Test Old Program Exercise')
    const oldProgramId = await createProgram('Old Program', '2026-01-05', '2026-02-01')
    await addProgramWeek(oldProgramId, 1, '2026-01-05', '2026-01-09')
    const oldDayId = await addProgramDay(oldProgramId, 1)
    await addProgramExercise({
      dayId: oldDayId,
      exerciseId: exerciseId2,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    render(<Program />)

    expect(await screen.findByText('Test Current Exercise')).toBeInTheDocument()

    await user.selectOptions(await screen.findByLabelText(/program/i), 'Old Program')

    expect(await screen.findByText('Test Old Program Exercise')).toBeInTheDocument()
    expect(screen.queryByText('Test Current Exercise')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Program.test.tsx`
Expected: FAIL — placeholder `Program` has none of this UI.

- [ ] **Step 3: Implement the Program screen**

`src/screens/Program.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getCurrentProgramWeek, listPrograms, listProgramDays } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ExerciseInfo } from '../components/ExerciseInfo'
import { todayIso } from '../lib/dates'

export function Program() {
  const today = todayIso()
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)

  const programsQuery = useLiveQuery(() => listPrograms(), [])
  const programs = programsQuery ?? []

  const currentProgramWeek = useLiveQuery(() => getCurrentProgramWeek(today), [today])

  const activeProgramId = selectedProgramId ?? currentProgramWeek?.program.id ?? null
  const activeWeekNumber =
    selectedProgramId && selectedProgramId !== currentProgramWeek?.program.id
      ? 1
      : currentProgramWeek?.week.weekNumber ?? 1

  const days = useLiveQuery(
    () => (activeProgramId ? listProgramDays(activeProgramId) : Promise.resolve([])),
    [activeProgramId]
  ) ?? []

  const daySlots = useLiveQuery(async () => {
    if (!activeProgramId) return []
    const results = []
    for (const day of days) {
      const slots = await getDaySlots(day.id!, activeWeekNumber)
      results.push({ day, slots })
    }
    return results
  }, [days, activeWeekNumber, activeProgramId]) ?? []

  // All hooks above run unconditionally every render (Rules of Hooks). This
  // gate only affects which JSX is returned — it waits for the program list
  // specifically, since `userEvent.selectOptions` (used in tests) requires
  // the <option> to already exist and does not retry like `findByText` does.
  if (programsQuery === undefined) {
    return (
      <div>
        <h1>Program</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Program</h1>

      <label htmlFor="program-select">Program</label>
      <select
        id="program-select"
        value={activeProgramId ?? ''}
        onChange={(e) => setSelectedProgramId(Number(e.target.value) || null)}
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <h2>Week {activeWeekNumber}</h2>

      {daySlots.map(({ day, slots }) => (
        <section key={day.id}>
          <h3>Day {day.dayNumber}</h3>
          {day.note && <p>{day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel}>
              <h4>{blockLabel}</h4>
              {blockSlots.map((slot) => (
                <div key={slot.programExercise.id}>
                  <ExerciseInfo name={slot.exerciseName} />
                  {slot.programExercise.tempo && <span> Tempo: {slot.programExercise.tempo}</span>}
                  {slot.prescription?.rir && <span> RIR: {slot.prescription.rir}</span>}
                  <p>
                    {slot.prescription?.isTest
                      ? 'TEST'
                      : [
                          slot.prescription && slot.prescription.warmupTargets.length > 0
                            ? `Warmup: ${slot.prescription.warmupTargets.join(', ')}`
                            : '',
                          slot.prescription && slot.prescription.workingTargets.length > 0
                            ? `Working: ${slot.prescription.workingTargets.join(', ')}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
```

Note on `activeWeekNumber`'s logic: when the user hasn't picked a different
program from the selector, it uses `currentProgramWeek`'s real week number;
the moment they pick a *different* program from the dropdown, there's no
"current" week concept for that program (it's not the one containing today),
so it defaults to showing that program's Week 1 as a reasonable browsing
starting point. This matches the test's expectation and keeps the screen's
state model simple (no separate "browsing week" selector in this pass — a
natural follow-up if needed later, out of scope here).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Program.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Program.tsx src/screens/Program.test.tsx
git commit -m "Implement Program tab schedule view with past-program browsing"
```

---

### Task 7: Progress screen integration

**Files:**
- Modify: `src/screens/Progress.tsx`, `src/screens/Progress.test.tsx`

**Interfaces:**
- Consumes: `getWorkingSetHistory` (replaces `getExerciseHistory` for
  chart/PR purposes) from `../db/workouts`; `listExercisesWithHistory`
  (replaces `listExercises` for the picker) from `../db/exercises`.
- Produces: the same `Progress` export. Two behavioral changes: (1) the
  weight/est-1RM chart, volume chart, and PR list now compute from
  warmup-excluded history, closing the Global Constraints gap; (2) the
  "Select exercise" dropdown only lists exercises with at least one logged
  set, so it no longer shows ~50 empty-chart entries from the glossary seed.
  A small new "Sessions" list under the PR list shows each session's date
  and week number (when tagged) alongside its top set, giving lightweight
  program/week context per the design spec — deliberately simpler than
  embedding a label into the Recharts chart itself (a custom Recharts
  tooltip would be disproportionate effort for this feature's value; a plain
  list is easy to build correctly and test).

  **Note on scope**: only Progress's picker is filtered to history-having
  exercises, not Log Lift's free-form type-ahead search (Task 5). This is
  deliberate, not an inconsistency: Progress's picker exists to show trend
  charts, and a chart with zero data points is never useful — filtering it
  is a strict improvement. Log Lift's free-form search is a general exercise
  picker for logging something new; showing the full glossary there (e.g.
  finding "Face Pulls" the first time you want to try it, before you've ever
  logged it) is the intended benefit of having a glossary at all, not a bug
  to fix.

- [ ] **Step 1: Write the failing tests**

Add to `src/screens/Progress.test.tsx` (keep the existing test; add these):
```tsx
it('does not include exercises with no logged history in the picker', async () => {
  await addExercise('Test Never Logged')
  render(<Progress />)
  await screen.findByLabelText(/select exercise/i)
  expect(screen.queryByText('Test Never Logged')).not.toBeInTheDocument()
})

it('excludes warmup sets from the PR list and shows a week label on sessions', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Warmup Squat')
  const session1 = await getOrCreateSessionForDate('2026-06-29')
  const entry1 = await getOrCreateExerciseEntry(session1, exerciseId, undefined, 1)
  await addSet(entry1, 315, 5, undefined, true) // warmup — would look like a huge "PR" if counted

  render(<Progress />)
  await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Test Warmup Squat')

  expect(screen.queryByText(/315 x 5/)).not.toBeInTheDocument() // never shows in PR list
  expect(screen.queryByText(/Wk 1/)).not.toBeInTheDocument() // no working sets at all yet, no session row either
})
```
(Add `getOrCreateSessionForDate`, `getOrCreateExerciseEntry`, `addSet` to the
existing imports from `../db/workouts` in this test file, and `addExercise`
from `../db/exercises` if not already imported.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Progress.test.tsx`
Expected: FAIL — picker still lists history-less exercises; warmup sets
still counted.

- [ ] **Step 3: Implement the Progress changes**

In `src/screens/Progress.tsx`, the current top of the file has:
```tsx
import { listExercises } from '../db/exercises'
import { flattenHistorySets, getExerciseHistory } from '../db/workouts'
```
Replace those two lines with:
```tsx
import { listExercisesWithHistory } from '../db/exercises'
import { flattenHistorySets, getWorkingSetHistory } from '../db/workouts'
```
`listExercises` had exactly one call site in this file (the `exercisesQuery`
line below) and is fully replaced — no other reference to it remains.
`getExerciseHistory` is replaced by `getWorkingSetHistory` at its one call
site (the `history` line below); `flattenHistorySets` stays imported
unchanged, since it's still used by the PR-detection loop further down in
this file.

```tsx
const exercisesQuery = useLiveQuery(() => listExercisesWithHistory(), [])
const exercises = exercisesQuery ?? []

const history = useLiveQuery(
  () => (selectedExerciseId ? getWorkingSetHistory(selectedExerciseId) : Promise.resolve([])),
  [selectedExerciseId]
) ?? []
```

Add a Sessions list to the JSX, right after the PR list's closing `</ul>`
(still inside the `{selectedExerciseId && (...)}` block).

**Important — wording must differ from the PR list's.** The PR list already
renders `"{date}: {weight} x {reps}"` (e.g. `"2026-07-17: 235 x 5"`). The
existing pre-Plan-B tests in this file use loose regexes like
`findByText(/235 x 5/)` and `findByText(/2026-07-24: 205 x 5/)`, which are
`getBy`/`findBy` queries — they throw if MORE than one element matches. If
the Sessions list rendered the same `"{date}: {weight} x {reps}"` shape, an
entry that's both the top set of its session AND a PR would render that
exact text twice (once in each list), breaking those pre-existing tests with
a "found multiple elements" error. Use a visibly different phrasing —
`" — top set: {weight} lbs x {reps} reps"` (note the em dash, "lbs", and
"reps" suffix) — so the rendered string never collides with the PR list's
`"{date}: {weight} x {reps}"` substring:
```tsx
<h3>Sessions</h3>
<ul>
  {history.map((h) => {
    const topSet = h.sets.reduce(
      (best, s) => (s.weightLbs > (best?.weightLbs ?? 0) ? s : best),
      h.sets[0]
    )
    return (
      <li key={h.date}>
        {h.date}
        {h.weekNumber ? ` (Wk ${h.weekNumber})` : ''} — top set: {topSet?.weightLbs} lbs x{' '}
        {topSet?.reps} reps
      </li>
    )
  })}
</ul>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Progress.test.tsx`
Expected: PASS (all prior tests plus the 2 new ones)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Progress.tsx src/screens/Progress.test.tsx
git commit -m "Exclude warmups from Progress charts/PRs, filter picker, add session week labels"
```

---

### Task 8: History screen integration

**Files:**
- Modify: `src/screens/History.tsx`, `src/screens/History.test.tsx`

**Interfaces:**
- Consumes: `db` from `../db/schema` directly (existing pattern in this
  file — reads `programLogEntries`, `programExercises`, `exercises`
  directly, same style as the existing lift/catching/bodyweight rows).
- Produces: the same `History` export, with a 4th row type in the combined
  feed for non-weight program log entries (e.g. "Copenhagen Plank: 3 sets
  logged"), sorted into the same reverse-chronological list as the existing
  three row types.

- [ ] **Step 1: Write the failing test**

Add to `src/screens/History.test.tsx` (keep the existing test; add this):
```tsx
it('includes a row for a program log entry, alongside the other row types', async () => {
  const exerciseId = await addExercise('Test Copenhagen Plank')
  const programId = await createProgram('Test Program', '2026-06-29', '2026-07-24')
  const dayId = await addProgramDay(programId, 2)
  const slotId = await addProgramExercise({
    dayId,
    exerciseId,
    blockLabel: 'B',
    orderIndex: 0,
    measureType: 'time',
    eachSide: true,
    tempo: null,
  })
  await upsertProgramLogEntry({
    programExerciseId: slotId,
    date: '2026-07-15',
    weekNumber: 3,
    values: [20, 20, 20],
    isWarmup: [false, false, false],
  })

  render(<History />)

  expect(await screen.findByText(/Test Copenhagen Plank/)).toBeInTheDocument()
})
```
Replace this test file's import block:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { History } from './History'
import { getOrCreateSessionForDate } from '../db/workouts'
import { getOrCreateCatchingSessionForDate } from '../db/catching'
import { addBodyweightEntry } from '../db/bodyweight'
```
with:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { History } from './History'
import { getOrCreateSessionForDate } from '../db/workouts'
import { getOrCreateCatchingSessionForDate } from '../db/catching'
import { addBodyweightEntry } from '../db/bodyweight'
import { addExercise } from '../db/exercises'
import { addProgramDay, createProgram } from '../db/programs'
import { addProgramExercise } from '../db/programExercises'
import { upsertProgramLogEntry } from '../db/programLogEntries'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/History.test.tsx`
Expected: FAIL — no program log entry row type exists yet.

- [ ] **Step 3: Implement the History change**

In `src/screens/History.tsx`, extend the `useLiveQuery` callback to include
program log entries:

```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

interface HistoryRow {
  date: string
  label: string
  key: string
}

export function History() {
  const rows = useLiveQuery(async (): Promise<HistoryRow[]> => {
    const [lifts, catching, bodyweight, programLogEntries] = await Promise.all([
      db.workoutSessions.toArray(),
      db.catchingSessions.toArray(),
      db.bodyweightEntries.toArray(),
      db.programLogEntries.toArray(),
    ])

    const programLogRows: HistoryRow[] = []
    for (const entry of programLogEntries) {
      const slot = await db.programExercises.get(entry.programExerciseId)
      const exercise = slot ? await db.exercises.get(slot.exerciseId) : undefined
      const name = exercise?.name ?? 'Unknown Exercise'
      const label = entry.chosenExercise
        ? `${name} (${entry.chosenCategory}): ${entry.chosenExercise} — ${entry.values.join(', ')}`
        : `${name}: ${entry.values.length} set${entry.values.length === 1 ? '' : 's'} logged`
      programLogRows.push({ date: entry.date, label, key: `program-${entry.id}` })
    }

    const combined: HistoryRow[] = [
      ...lifts.map((s) => ({ date: s.date, label: 'Lift session', key: `lift-${s.id}` })),
      ...catching.map((s) => ({ date: s.date, label: 'Catching session', key: `catching-${s.id}` })),
      ...bodyweight.map((b) => ({
        date: b.date,
        label: `Bodyweight: ${b.weightLbs} lbs`,
        key: `bw-${b.id}`,
      })),
      ...programLogRows,
    ]

    combined.sort((a, b) => b.date.localeCompare(a.date))
    return combined
  }, []) ?? []

  return (
    <div>
      <h1>History</h1>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            {row.date} — {row.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/History.test.tsx`
Expected: PASS (all prior tests plus the 1 new one)

- [ ] **Step 5: Run the full suite and verify the build**

Run: `npm test` — expected: all pass.
Run: `npx tsc -b` — expected: clean.
Run: `npm run lint` — expected: clean.
Run: `npm run build` — expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/screens/History.tsx src/screens/History.test.tsx
git commit -m "Add program log entry row type to History feed"
```

---

## Post-plan note

This plan closes all four "Plan B design constraint" items Plan A's final
review flagged (warmup filtering at the query source, `programLogEntries`
upsert/date-scoped access with real Arm Farm multi-row semantics, the
history-less-exercise picker problem, and the `getOrCreateExerciseEntry`
program-tag backfill) as part of its normal task flow rather than as
afterthoughts — Task 1 and Task 7 are where those fixes live. The one
remaining item from that list — `getActiveProgramDay`'s Mon–Fri-equals-
dayNumber assumption — is unchanged by this plan and stays a documented
forward risk for whenever a second month's program is entered with different
day-of-week alignment; nothing in this plan makes it worse, and nothing here
depends on fixing it now.
