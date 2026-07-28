# Consolidated Day Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the gains-tracker logging UI so every prescribed set gets its own persisted weight/reps (or a completion checkbox for no-weight movements), day-to-day navigation happens via arrows instead of separate Program/Log Lift tabs, RPE tracking is gone, and Bodyweight logging lives in the bottom nav.

**Architecture:** Extend the existing Dexie data layer (`src/db/*`) with a few new query/mutation functions, rebuild `ProgramSlotCard`'s two data-entry forms around fixed per-set rows, add a `DayNavigator` component backed by a chronological list of every program day across every seeded program, and fold `Program.tsx` into `LogLift.tsx` as the app's single `/` screen.

**Tech Stack:** React 18 + TypeScript, Dexie (IndexedDB), Vitest + Testing Library, React Router.

## Global Constraints

- No visual/styling work in this plan — colors, spacing, typography, cards, dark mode are a separate follow-up spec per `docs/superpowers/specs/2026-07-27-consolidated-day-log-design.md`.
- RPE is removed completely: no `rpe` field, input, or display anywhere.
- Bodyweight-type set rows log the exact prescribed target value when checked (no numeric override) — confirmed design decision.
- Checkbox rows (bodyweight/time/distance) are sequential: only the next open row can be checked, only the most-recently-checked row can be unchecked.
- Weight rows have no such ordering constraint — any row, once logged, can be edited independently via its own `SetRecord.id`.
- Day-navigation arrows walk one continuous chronological list across every program — no program-picker dropdown.
- The free-form "search any exercise, log a set" section stays, below the day's program slots.

---

## File Structure

| File | Change |
|---|---|
| `src/db/schema.ts` | Remove `rpe` from `SetRecord` |
| `src/db/workouts.ts` | Drop `rpe` param from `addSet`; add `getSetsForExerciseOnDate`, `updateSet` |
| `src/db/workouts.test.ts` | Fix 2 call sites that passed `rpe`; new tests for the two additions |
| `src/lib/logWeightSet.ts` | Drop `rpe` from `LogWeightSetInput` and both `addSet` calls |
| `src/db/programLogEntries.ts` | Add `removeLastProgramLogValue` |
| `src/db/programLogEntries.test.ts` | New tests for the addition |
| `src/db/programs.ts` | Add `listAllProgramDaysChronological`, `findDefaultDayIndex` |
| `src/db/programs.test.ts` | New tests for both additions |
| `src/components/DayNavigator.tsx` | **New** — arrow navigation + day/week header |
| `src/components/DayNavigator.test.tsx` | **New** |
| `src/components/ProgramSlotCard.tsx` | Rewrite `WeightSlotForm` and `SimpleValueSlotForm` as fixed-row components; drop RPE |
| `src/components/ProgramSlotCard.test.tsx` | Full rewrite for row-based interactions |
| `src/screens/programIntegration.test.tsx` | Update the one scenario that drives `ProgramSlotCard` directly |
| `src/screens/LogLift.tsx` | Absorb `Program.tsx`'s day-schedule rendering behind `DayNavigator`; drop RPE; add bodyweight toggle to free-form section |
| `src/screens/LogLift.test.tsx` | Full rewrite, folding in `Program.test.tsx`'s scenarios |
| `src/screens/Program.tsx` | **Deleted** |
| `src/screens/Program.test.tsx` | **Deleted** |
| `src/components/NavBar.tsx` | `Log Lift`+`Program` → `Log`; add `Bodyweight` |
| `src/components/NavBar.test.tsx` | Rewrite for the new 5 tabs |
| `src/App.tsx` | Remove `/program` route and header Bodyweight icon link |

---

### Task 1: Remove RPE end-to-end

**Files:**
- Modify: `src/db/schema.ts:24-31`
- Modify: `src/db/workouts.ts:30-42`
- Modify: `src/db/workouts.test.ts:63-74` (two call sites)
- Modify: `src/lib/logWeightSet.ts` (whole file)
- Modify: `src/components/ProgramSlotCard.tsx:51-154` (`WeightSlotForm` only — mechanical RPE strip, row redesign comes in Task 6)
- Modify: `src/components/ProgramSlotCard.test.tsx:108-126` (delete the RPE test)
- Modify: `src/screens/LogLift.tsx:1-196` (free-form section only)

**Interfaces:**
- Produces: `addSet(exerciseEntryId: number, weightLbs: number, reps: number, isWarmup = false): Promise<number>` (was `(..., rpe?: number, isWarmup = false)`)
- Produces: `logWeightSet(input: LogWeightSetInput): Promise<PrResult>` where `LogWeightSetInput` no longer has `rpe?: number`

- [ ] **Step 1: Remove `rpe` from `SetRecord`**

In `src/db/schema.ts`, change:

```ts
export interface SetRecord {
  id?: number
  exerciseEntryId: number
  weightLbs: number
  reps: number
  rpe?: number
  isWarmup?: boolean
}
```

to:

```ts
export interface SetRecord {
  id?: number
  exerciseEntryId: number
  weightLbs: number
  reps: number
  isWarmup?: boolean
}
```

- [ ] **Step 2: Drop `rpe` from `addSet`**

In `src/db/workouts.ts`, change:

```ts
export async function addSet(
  exerciseEntryId: number,
  weightLbs: number,
  reps: number,
  rpe?: number,
  isWarmup = false
): Promise<number> {
  return db.sets.add({ exerciseEntryId, weightLbs, reps, rpe, isWarmup })
}
```

to:

```ts
export async function addSet(
  exerciseEntryId: number,
  weightLbs: number,
  reps: number,
  isWarmup = false
): Promise<number> {
  return db.sets.add({ exerciseEntryId, weightLbs, reps, isWarmup })
}
```

- [ ] **Step 3: Fix the two `workouts.test.ts` call sites that passed `rpe`**

In `src/db/workouts.test.ts`, change:

```ts
    const session2 = await getOrCreateSessionForDate('2026-07-22')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 195, 5, 8)

    const history = await getExerciseHistory(exerciseId)
    expect(history.map((h) => h.date)).toEqual(['2026-07-15', '2026-07-22'])
    expect(history[1].sets).toEqual([
      expect.objectContaining({ weightLbs: 195, reps: 5, rpe: 8 }),
    ])
```

to:

```ts
    const session2 = await getOrCreateSessionForDate('2026-07-22')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 195, 5)

    const history = await getExerciseHistory(exerciseId)
    expect(history.map((h) => h.date)).toEqual(['2026-07-15', '2026-07-22'])
    expect(history[1].sets).toEqual([
      expect.objectContaining({ weightLbs: 195, reps: 5 }),
    ])
```

Every other `addSet(..., undefined, true)` call in this file (e.g. `addSet(entry1, 45, 5, undefined, true)`) must drop the `undefined`, becoming `addSet(entry1, 45, 5, true)` — search the file for `undefined, true` and `undefined, false` and fix all occurrences (there are 6: lines 139, 181, 185, 186, 234, 288 in the pre-edit file).

- [ ] **Step 4: Run workouts tests to verify they fail on the old signature, then pass**

Run: `npx vitest run src/db/workouts.test.ts`
Expected before fixing call sites: FAIL (too many arguments / type errors surfaced at build)
Expected after Step 3: PASS (all tests green)

- [ ] **Step 5: Drop `rpe` from `logWeightSet`**

Replace `src/lib/logWeightSet.ts` in full:

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
    await addSet(entryId, input.weightLbs, input.reps, true)
    return { isWeightPr: false, isEstimated1RmPr: false }
  }

  const priorHistory = await getWorkingSetHistory(input.exerciseId)
  const priorSets = flattenHistorySets(priorHistory)
  const pr = detectPr({ weightLbs: input.weightLbs, reps: input.reps }, priorSets)
  await addSet(entryId, input.weightLbs, input.reps, false)
  return pr
}
```

- [ ] **Step 6: Run logWeightSet tests**

Run: `npx vitest run src/lib/logWeightSet.test.ts`
Expected: PASS (this file never referenced `rpe`, so it should be unaffected)

- [ ] **Step 7: Strip RPE from `ProgramSlotCard.tsx`'s `WeightSlotForm`**

In `src/components/ProgramSlotCard.tsx`, remove the `rpe` state, the `rpeNum` computation, the `rpe` field passed to `logWeightSet`, the `rpeId`, and the RPE label/input JSX. Concretely:

Remove this line from the state block:
```ts
  const [rpe, setRpe] = useState('')
```

Change:
```ts
    const rpeNum = rpe ? Number(rpe) : undefined
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return
```
to:
```ts
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return
```

Change:
```ts
      const pr = await logWeightSet({
        exerciseId: slot.programExercise.exerciseId,
        date,
        weightLbs,
        reps: repsNum,
        rpe: rpeNum,
        isWarmup,
        programExerciseId: slot.programExercise.id,
        weekNumber,
      })
      setWeight('')
      setReps('')
      setRpe('')
      setIsWarmup(false)
```
to:
```ts
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
```

Remove this line:
```ts
  const rpeId = `rpe-${slot.programExercise.id}`
```

Remove these two lines from the JSX:
```tsx
      <label htmlFor={rpeId}>RPE (optional)</label>
      <input id={rpeId} type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} />
```

- [ ] **Step 8: Delete the RPE test in `ProgramSlotCard.test.tsx`**

Delete this whole `it` block (lines 108-126):

```ts
  it('logs a weight set with an RPE value and persists it on the underlying set', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Overhead Press')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 6, programExerciseId: 6, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/weight/i), '135')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.type(screen.getByLabelText(/rpe/i), '8')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    await screen.findByText(/pr!/i)
    const sets = await db.sets.toArray()
    expect(sets.some((s) => s.weightLbs === 135 && s.reps === 5 && s.rpe === 8)).toBe(true)
  })

```

- [ ] **Step 9: Strip RPE from `LogLift.tsx`'s free-form section**

In `src/screens/LogLift.tsx`, remove the `rpe` state:
```ts
  const [rpe, setRpe] = useState('')
```

Change:
```ts
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    const rpeNum = rpe ? Number(rpe) : undefined

    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) {
      return
    }
```
to:
```ts
    const weightLbs = Number(weight)
    const repsNum = Number(reps)

    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) {
      return
    }
```

Change:
```ts
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
```
to:
```ts
      const pr = await logWeightSet({
        exerciseId: selectedExerciseId,
        date: today,
        weightLbs,
        reps: repsNum,
      })

      setWeight('')
      setReps('')
```

Remove this block from the JSX:
```tsx
          <div>
            <label htmlFor="rpe-input">RPE (optional)</label>
            <input id="rpe-input" type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </div>
```

Change:
```tsx
              <li key={i}>
                {s.weightLbs} x {s.reps}
                {s.rpe ? ` @RPE ${s.rpe}` : ''}
              </li>
```
to:
```tsx
              <li key={i}>
                {s.weightLbs} x {s.reps}
              </li>
```

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all tests pass, no type errors, and `grep -rn "rpe\|RPE" src` returns nothing.

- [ ] **Step 11: Commit**

```bash
git add src/db/schema.ts src/db/workouts.ts src/db/workouts.test.ts src/lib/logWeightSet.ts src/components/ProgramSlotCard.tsx src/components/ProgramSlotCard.test.tsx src/screens/LogLift.tsx
git commit -m "Remove RPE tracking end-to-end"
```

---

### Task 2: Add `getSetsForExerciseOnDate` and `updateSet` to workouts.ts

**Files:**
- Modify: `src/db/workouts.ts` (append new functions)
- Modify: `src/db/workouts.test.ts` (append new tests)

**Interfaces:**
- Consumes: `getExerciseHistory(exerciseId: number): Promise<ExerciseHistoryEntry[]>` (existing), `db.sets` (existing Dexie table)
- Produces: `getSetsForExerciseOnDate(exerciseId: number, date: string): Promise<{ warmup: SetRecord[]; working: SetRecord[] }>`
- Produces: `updateSet(setId: number, changes: { weightLbs: number; reps: number }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append to `src/db/workouts.test.ts`:

```ts
describe('getSetsForExerciseOnDate', () => {
  it('splits a date\'s sets into warmup and working, in insertion order', async () => {
    const exerciseId = await addExercise('Test Row Split')
    const session = await getOrCreateSessionForDate('2026-07-27')
    const entry = await getOrCreateExerciseEntry(session, exerciseId)
    await addSet(entry, 45, 5, true)
    await addSet(entry, 135, 5)
    await addSet(entry, 145, 3)

    const result = await getSetsForExerciseOnDate(exerciseId, '2026-07-27')
    expect(result.warmup).toHaveLength(1)
    expect(result.warmup[0].weightLbs).toBe(45)
    expect(result.working.map((s) => s.weightLbs)).toEqual([135, 145])
  })

  it('returns empty lists when nothing was logged that date', async () => {
    const exerciseId = await addExercise('Test No Sets That Date')
    const result = await getSetsForExerciseOnDate(exerciseId, '2026-07-27')
    expect(result).toEqual({ warmup: [], working: [] })
  })

  it('only returns sets from the requested date, not other dates', async () => {
    const exerciseId = await addExercise('Test Date Scoped Sets')
    const session1 = await getOrCreateSessionForDate('2026-07-20')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 100, 5)
    const session2 = await getOrCreateSessionForDate('2026-07-27')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 105, 5)

    const result = await getSetsForExerciseOnDate(exerciseId, '2026-07-27')
    expect(result.working.map((s) => s.weightLbs)).toEqual([105])
  })
})

describe('updateSet', () => {
  it('updates weightLbs and reps on an existing set in place', async () => {
    const exerciseId = await addExercise('Test Update Set')
    const session = await getOrCreateSessionForDate('2026-07-27')
    const entry = await getOrCreateExerciseEntry(session, exerciseId)
    const setId = await addSet(entry, 135, 5)

    await updateSet(setId, { weightLbs: 140, reps: 4 })

    const updated = await db.sets.get(setId)
    expect(updated?.weightLbs).toBe(140)
    expect(updated?.reps).toBe(4)
  })
})
```

Add `getSetsForExerciseOnDate` and `updateSet` to the existing import block at the top of the file:

```ts
import {
  addSet,
  flattenHistorySets,
  getExerciseHistory,
  getLastSessionSets,
  getLastWeekWeightResult,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
  getSetsForExerciseOnDate,
  getWorkingSetCountForSlotWeek,
  getWorkingSetHistory,
  updateSet,
  workingSetsOnly,
} from './workouts'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: FAIL with "getSetsForExerciseOnDate is not a function" / "updateSet is not a function"

- [ ] **Step 3: Implement `getSetsForExerciseOnDate` and `updateSet`**

Append to `src/db/workouts.ts`:

```ts
export interface SetsForDate {
  warmup: SetRecord[]
  working: SetRecord[]
}

/**
 * Sets logged for one exercise on one date, split by `isWarmup`, in
 * insertion order — row *i* of the fixed-row set-entry UI maps to element
 * *i* of the matching list. Relies on the same ascending-`id`-equals-
 * insertion-order assumption `flattenHistorySets` already depends on.
 */
export async function getSetsForExerciseOnDate(
  exerciseId: number,
  date: string
): Promise<SetsForDate> {
  const history = await getExerciseHistory(exerciseId)
  const sets = history.find((h) => h.date === date)?.sets ?? []
  return {
    warmup: sets.filter((s) => s.isWarmup === true),
    working: sets.filter((s) => s.isWarmup !== true),
  }
}

export async function updateSet(
  setId: number,
  changes: { weightLbs: number; reps: number }
): Promise<void> {
  await db.sets.update(setId, changes)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/workouts.ts src/db/workouts.test.ts
git commit -m "Add getSetsForExerciseOnDate and updateSet to the workouts data layer"
```

---

### Task 3: Add `removeLastProgramLogValue`

**Files:**
- Modify: `src/db/programLogEntries.ts` (append)
- Modify: `src/db/programLogEntries.test.ts` (append)

**Interfaces:**
- Consumes: `db.programLogEntries` (existing Dexie table), same lookup pattern as `upsertProgramLogEntry`
- Produces: `removeLastProgramLogValue(programExerciseId: number, date: string, weekNumber: number): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append to `src/db/programLogEntries.test.ts`:

```ts
describe('removeLastProgramLogValue', () => {
  it('pops the last value and isWarmup flag off the no-category entry', async () => {
    await appendProgramLogValue(60, '2026-07-27', 1, 3)
    await appendProgramLogValue(60, '2026-07-27', 1, 4)

    await removeLastProgramLogValue(60, '2026-07-27', 1)

    const entries = await getProgramLogEntriesForDate(60, '2026-07-27')
    expect(entries).toHaveLength(1)
    expect(entries[0].values).toEqual([3])
    expect(entries[0].isWarmup).toEqual([false])
  })

  it('deletes the entry entirely once its last value is removed', async () => {
    await appendProgramLogValue(61, '2026-07-27', 1, 3)

    await removeLastProgramLogValue(61, '2026-07-27', 1)

    const entries = await getProgramLogEntriesForDate(61, '2026-07-27')
    expect(entries).toHaveLength(0)
  })

  it('is a no-op when there is nothing logged for that slot+date', async () => {
    await expect(removeLastProgramLogValue(999, '2026-07-27', 1)).resolves.toBeUndefined()
    const entries = await getProgramLogEntriesForDate(999, '2026-07-27')
    expect(entries).toHaveLength(0)
  })

  it('does not touch a category_choice entry for the same slot+date', async () => {
    await logCategoryChoice({
      programExerciseId: 62,
      date: '2026-07-27',
      weekNumber: 1,
      value: 10,
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
      categoriesToPick: 3,
    })
    await appendProgramLogValue(62, '2026-07-27', 1, 5)

    await removeLastProgramLogValue(62, '2026-07-27', 1)

    const entries = await getProgramLogEntriesForDate(62, '2026-07-27')
    expect(entries).toHaveLength(1)
    expect(entries[0].chosenCategory).toBe('Triceps')
  })
})
```

Add `removeLastProgramLogValue` to the existing import block at the top of the file:

```ts
import {
  addProgramLogEntry,
  appendProgramLogValue,
  getLastWeekCategoryValue,
  getLastWeekSimpleValue,
  getProgramLogEntries,
  getProgramLogEntriesForDate,
  logCategoryChoice,
  removeLastProgramLogValue,
  upsertProgramLogEntry,
} from './programLogEntries'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: FAIL with "removeLastProgramLogValue is not a function"

- [ ] **Step 3: Implement `removeLastProgramLogValue`**

Append to `src/db/programLogEntries.ts`:

```ts
/**
 * The inverse of `appendProgramLogValue`: pops the last value (and its
 * `isWarmup` flag) off the date's no-category entry, deleting the entry
 * row entirely if that empties it. Used to "uncheck" the most recently
 * checked row in the fixed-row bodyweight/time/distance set UI — checking
 * only ever advances to the next open row, so unchecking only ever
 * retracts the most recent one.
 */
export async function removeLastProgramLogValue(
  programExerciseId: number,
  date: string,
  weekNumber: number
): Promise<void> {
  return db.transaction('rw', db.programLogEntries, async () => {
    const existing = await db.programLogEntries
      .where('programExerciseId')
      .equals(programExerciseId)
      .and((e) => e.date === date && (e.chosenCategory ?? null) === null)
      .first()
    if (!existing || existing.values.length === 0) return

    const nextValues = existing.values.slice(0, -1)
    const nextIsWarmup = existing.isWarmup.slice(0, -1)
    if (nextValues.length === 0) {
      await db.programLogEntries.delete(existing.id!)
      return
    }
    await db.programLogEntries.update(existing.id!, {
      weekNumber,
      values: nextValues,
      isWarmup: nextIsWarmup,
    })
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/programLogEntries.ts src/db/programLogEntries.test.ts
git commit -m "Add removeLastProgramLogValue for the bodyweight-row checkbox uncheck flow"
```

---

### Task 4: Add `listAllProgramDaysChronological` and `findDefaultDayIndex`

**Files:**
- Modify: `src/db/programs.ts` (append)
- Modify: `src/db/programs.test.ts` (append)

**Interfaces:**
- Consumes: `listPrograms()`, `listProgramWeeks(programId)`, `listProgramDays(programId)` (all existing in this file), `addDays(dateIso, days)` from `../lib/dates`
- Produces: `DatedProgramDay { program: Program; week: ProgramWeek; day: ProgramDay; date: string }`
- Produces: `listAllProgramDaysChronological(): Promise<DatedProgramDay[]>`
- Produces: `findDefaultDayIndex(days: DatedProgramDay[], today: string): number`

- [ ] **Step 1: Write the failing tests**

Append to `src/db/programs.test.ts`:

```ts
describe('listAllProgramDaysChronological', () => {
  it('lists every day across every program, sorted ascending by calendar date', async () => {
    const julyId = await createProgram('July', '2026-06-29', '2026-07-24')
    await addProgramWeek(julyId, 1, '2026-06-29', '2026-07-03')
    await addProgramDay(julyId, 1)
    await addProgramDay(julyId, 5)

    const augustId = await createProgram('August', '2026-07-27', '2026-08-21')
    await addProgramWeek(augustId, 1, '2026-07-27', '2026-07-31')
    await addProgramDay(augustId, 1)

    const days = await listAllProgramDaysChronological()
    expect(days.map((d) => d.date)).toEqual(['2026-06-29', '2026-07-03', '2026-07-27'])
    expect(days.map((d) => d.program.name)).toEqual(['July', 'July', 'August'])
    expect(days[2].day.dayNumber).toBe(1)
    expect(days[2].week.weekNumber).toBe(1)
  })

  it('returns an empty list when there are no programs', async () => {
    const days = await listAllProgramDaysChronological()
    expect(days).toEqual([])
  })
})

describe('findDefaultDayIndex', () => {
  const days = [
    { date: '2026-06-29' },
    { date: '2026-07-03' },
    { date: '2026-07-27' },
  ] as Awaited<ReturnType<typeof listAllProgramDaysChronological>>

  it('returns the index of the day matching today exactly', () => {
    expect(findDefaultDayIndex(days, '2026-07-03')).toBe(1)
  })

  it('falls back to the next day after today when today has no exact match', () => {
    expect(findDefaultDayIndex(days, '2026-07-01')).toBe(1)
  })

  it('falls back to the last day when today is after every listed day', () => {
    expect(findDefaultDayIndex(days, '2099-01-01')).toBe(2)
  })

  it('returns -1 when the list is empty', () => {
    expect(findDefaultDayIndex([], '2026-07-01')).toBe(-1)
  })
})
```

Add the two new names to the existing import block at the top of the file:

```ts
import {
  addProgramDay,
  addProgramWeek,
  createProgram,
  findDefaultDayIndex,
  getActiveProgramDay,
  getCurrentProgramWeek,
  listAllProgramDaysChronological,
  listProgramDays,
  listPrograms,
  listProgramWeeks,
} from './programs'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/programs.test.ts`
Expected: FAIL with "listAllProgramDaysChronological is not a function"

- [ ] **Step 3: Implement both functions**

Add `addDays` to the imports at the top of `src/db/programs.ts`:

```ts
import { db } from './schema'
import type { Program, ProgramWeek, ProgramDay } from './schema'
import { addDays } from '../lib/dates'
```

Append to `src/db/programs.ts`:

```ts
export interface DatedProgramDay {
  program: Program
  week: ProgramWeek
  day: ProgramDay
  date: string
}

/**
 * Every day across every seeded program, each resolved to its concrete
 * calendar date, sorted ascending. Backs the day-navigation arrows: with
 * only a handful of ~16-day programs this is a trivial in-memory list, no
 * pagination needed.
 */
export async function listAllProgramDaysChronological(): Promise<DatedProgramDay[]> {
  const programs = await listPrograms()
  const result: DatedProgramDay[] = []
  for (const program of programs) {
    const weeks = await listProgramWeeks(program.id!)
    const days = await listProgramDays(program.id!)
    for (const week of weeks) {
      for (const day of days) {
        result.push({
          program,
          week,
          day,
          date: addDays(week.startDate, day.dayNumber - 1),
        })
      }
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

/**
 * The day-navigator's starting index: the day matching today exactly, or
 * the closest upcoming day, or the last day if today is past everything.
 * Returns -1 for an empty list (nothing to navigate to).
 */
export function findDefaultDayIndex(days: DatedProgramDay[], today: string): number {
  if (days.length === 0) return -1
  const exact = days.findIndex((d) => d.date === today)
  if (exact !== -1) return exact
  const next = days.findIndex((d) => d.date > today)
  if (next !== -1) return next
  return days.length - 1
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/programs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/programs.ts src/db/programs.test.ts
git commit -m "Add listAllProgramDaysChronological and findDefaultDayIndex"
```

---

### Task 5: Build `DayNavigator`

**Files:**
- Create: `src/components/DayNavigator.tsx`
- Create: `src/components/DayNavigator.test.tsx`

**Interfaces:**
- Consumes: `DatedProgramDay` from `../db/programs`
- Produces: `DayNavigator({ days, currentIndex, onNavigate }: { days: DatedProgramDay[]; currentIndex: number; onNavigate: (index: number) => void })`

- [ ] **Step 1: Write the failing test**

Create `src/components/DayNavigator.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayNavigator } from './DayNavigator'
import type { DatedProgramDay } from '../db/programs'

function makeDay(overrides: Partial<DatedProgramDay> = {}): DatedProgramDay {
  return {
    program: { id: 1, name: 'July Program', startDate: '2026-06-29', endDate: '2026-07-24' },
    week: { id: 1, programId: 1, weekNumber: 1, startDate: '2026-06-29', endDate: '2026-07-03' },
    day: { id: 1, programId: 1, dayNumber: 1, note: 'Recovery' },
    date: '2026-06-29',
    ...overrides,
  }
}

describe('DayNavigator', () => {
  it('shows the current day, week, and program name', () => {
    const days = [makeDay()]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={() => {}} />)

    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
    expect(screen.getByText(/2026-06-29/)).toBeInTheDocument()
    expect(screen.getByText(/Week 1/)).toBeInTheDocument()
    expect(screen.getByText('July Program')).toBeInTheDocument()
  })

  it('calls onNavigate with index - 1 when the previous arrow is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const days = [makeDay({ date: '2026-06-29' }), makeDay({ date: '2026-06-30' })]
    render(<DayNavigator days={days} currentIndex={1} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: /previous day/i }))
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('calls onNavigate with index + 1 when the next arrow is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const days = [makeDay({ date: '2026-06-29' }), makeDay({ date: '2026-06-30' })]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: /next day/i }))
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('disables the previous arrow at the start of the list', () => {
    const days = [makeDay()]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: /previous day/i })).toBeDisabled()
  })

  it('disables the next arrow at the end of the list', () => {
    const days = [makeDay()]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: /next day/i })).toBeDisabled()
  })

  it('renders nothing when there is no current day (empty list)', () => {
    const { container } = render(<DayNavigator days={[]} currentIndex={-1} onNavigate={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/DayNavigator.test.tsx`
Expected: FAIL with "Cannot find module './DayNavigator'"

- [ ] **Step 3: Implement `DayNavigator`**

Create `src/components/DayNavigator.tsx`:

```tsx
import type { DatedProgramDay } from '../db/programs'

interface DayNavigatorProps {
  days: DatedProgramDay[]
  currentIndex: number
  onNavigate: (index: number) => void
}

export function DayNavigator({ days, currentIndex, onNavigate }: DayNavigatorProps) {
  const current = days[currentIndex]
  if (!current) return null

  return (
    <div>
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onNavigate(currentIndex - 1)}
        disabled={currentIndex <= 0}
      >
        ←
      </button>
      <div>
        <p>{current.program.name}</p>
        <h2>
          Day {current.day.dayNumber} — {current.date}
        </h2>
        <p>Week {current.week.weekNumber}</p>
      </div>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onNavigate(currentIndex + 1)}
        disabled={currentIndex >= days.length - 1}
      >
        →
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/DayNavigator.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DayNavigator.tsx src/components/DayNavigator.test.tsx
git commit -m "Add DayNavigator component"
```

---

### Task 6: Rewrite `WeightSlotForm` as fixed per-set rows

**Files:**
- Modify: `src/components/ProgramSlotCard.tsx` (replace `WeightSlotForm`, add `WeightRow`)
- Modify: `src/components/ProgramSlotCard.test.tsx` (rewrite weight-related tests)
- Modify: `src/screens/programIntegration.test.tsx` (update the one scenario that fills weight/reps)

**Interfaces:**
- Consumes: `getSetsForExerciseOnDate`, `updateSet` (Task 2), `getLastWeekWeightResult`, `getWorkingSetCountForSlotWeek` (existing), `logWeightSet` (existing), `compareWeightSets` (existing)
- Produces: row labels `Weight (lbs) — {rowLabel}` / `Reps — {rowLabel}` where `rowLabel` is `Warmup N` or `Set N`; button text `Log set` (new row) / `Update` (already-logged row)

- [ ] **Step 1: Rewrite the weight-related tests in `ProgramSlotCard.test.tsx`**

Replace the first two `it` blocks (the weight-set-with-PR test and the warmup-checkbox test, lines 30-64 of the pre-Task-1 file) with:

```ts
  it('logs the first prescribed set row and shows a PR badge on that row', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Front Squat')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight', tempo: '4/1/0' },
      { id: 1, programExerciseId: 1, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '225')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
  })

  it('renders a warmup row before the working rows when the week has warmup targets, and does not flag a warmup as a PR', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Bench Press')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 2, programExerciseId: 2, weekNumber: 1, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    expect(screen.getByLabelText(/weight \(lbs\) — warmup 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/weight \(lbs\) — warmup 2/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — warmup 1/i), '45')
    await user.clear(screen.getByLabelText(/reps — warmup 1/i))
    await user.type(screen.getByLabelText(/reps — warmup 1/i), '5')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[0])

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
  })

  it('lets an already-logged row be edited independently via Update', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Editable Row')
    const priorSession = await getOrCreateSessionForDate('2026-07-06')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 8, 1)
    const setId = await addSet(priorEntry, 100, 3)

    const slot = makeSlot(
      { id: 8, exerciseId, measureType: 'weight' },
      { id: 1, programExerciseId: 8, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const weightInput = await screen.findByLabelText(/weight \(lbs\) — set 1/i)
    expect(weightInput).toHaveValue(100)

    await user.clear(weightInput)
    await user.type(weightInput, '105')
    await user.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(async () => {
      const updated = await db.sets.get(setId)
      expect(updated?.weightLbs).toBe(105)
    })
  })

  it('adds an extra set row beyond the prescription via "+ Add extra set"', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Extra Set')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 9, programExerciseId: 9, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.click(screen.getByRole('button', { name: /add extra set/i }))
    expect(screen.getByLabelText(/weight \(lbs\) — set 2/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 2/i), '95')
    await user.clear(screen.getByLabelText(/reps — set 2/i))
    await user.type(screen.getByLabelText(/reps — set 2/i), '8')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[1])

    await waitFor(() => expect(screen.getByLabelText(/weight \(lbs\) — set 2/i)).toHaveValue(95))
    expect(screen.getByRole('button', { name: /add extra set/i })).toBeInTheDocument()
  })
```

Every remaining test in the file that fills weight/reps and clicks "Add Set" against a slot with `workingTargets: [3, 3, 3, 5]` or `[5]` etc. needs its selectors updated from the generic `screen.getByLabelText(/weight/i)` / `screen.getByLabelText(/reps/i)` / `screen.getByRole('button', { name: /add set/i })` to row-scoped equivalents targeting **Set 1** (the first not-yet-logged row), and the reps field must be cleared before typing since it's pre-filled with the row's target. Apply this transform to every remaining occurrence:

```ts
// before
await user.type(screen.getByLabelText(/weight/i), '<W>')
await user.type(screen.getByLabelText(/reps/i), '<R>')
await user.click(screen.getByRole('button', { name: /add set/i }))

// after
await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '<W>')
await user.clear(screen.getByLabelText(/reps — set 1/i))
await user.type(screen.getByLabelText(/reps — set 1/i), '<R>')
await user.click(screen.getByRole('button', { name: /log set/i }))
```

This applies to: `'shows last week\'s result and a "Beat last week!" badge...'`, `'shows "Matched last week"...'`, `'shows "Fell short of last week"...'`, and the loop in `'hides the progress badge until the full prescribed set count has been logged this week'` — in that loop, each iteration logs the *next* row, so the label target changes per iteration (`set 1`, `set 2`, `set 3`, `set 4`); rewrite it as:

```ts
    for (let i = 1; i <= 3; i++) {
      await user.type(screen.getByLabelText(new RegExp(`weight \\(lbs\\) — set ${i}$`, 'i')), '225')
      await user.clear(screen.getByLabelText(new RegExp(`reps — set ${i}$`, 'i')))
      await user.type(screen.getByLabelText(new RegExp(`reps — set ${i}$`, 'i')), '3')
      await user.click(screen.getAllByRole('button', { name: /log set/i })[i - 1])
      await waitFor(() => expect(screen.getByLabelText(new RegExp(`weight \\(lbs\\) — set ${i}$`, 'i'))).toHaveValue(225))
    }

    expect(screen.queryByText('Beat last week!')).not.toBeInTheDocument()
    expect(screen.queryByText('Fell short of last week')).not.toBeInTheDocument()
    expect(screen.queryByText('Matched last week')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 4/i), '225')
    await user.clear(screen.getByLabelText(/reps — set 4/i))
    await user.type(screen.getByLabelText(/reps — set 4/i), '5')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[3])

    expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
```

The `'lets an already-logged row be edited independently via Update'` test above needs `getOrCreateExerciseEntry` and `addSet` in scope — they're already imported at the top of the file (`import { getOrCreateSessionForDate, getOrCreateExerciseEntry, addSet } from '../db/workouts'`), so no new import is needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: FAIL — the current single-input `WeightSlotForm` doesn't have row-scoped labels yet.

- [ ] **Step 3: Replace `WeightSlotForm` with the fixed-row implementation**

In `src/components/ProgramSlotCard.tsx`, add to the imports at the top:

```ts
import { getLastWeekWeightResult, getSetsForExerciseOnDate, getWorkingSetCountForSlotWeek, updateSet } from '../db/workouts'
import type { SetRecord } from '../db/schema'
```

(this replaces the existing `import { getLastWeekWeightResult, getWorkingSetCountForSlotWeek } from '../db/workouts'` line — merge the two new names into it).

Replace the entire `WeightSlotForm` function with:

```tsx
interface SetRow {
  key: string
  isWarmup: boolean
  targetReps: number
  set: SetRecord | null
}

function WeightSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [showExtraRow, setShowExtraRow] = useState(false)
  const exerciseId = slot.programExercise.exerciseId
  const programExerciseId = slot.programExercise.id!
  const warmupTargets = slot.prescription?.warmupTargets ?? []
  const workingTargets = slot.prescription?.workingTargets ?? []
  const targetReps = workingTargets.length > 0 ? workingTargets[workingTargets.length - 1] : null
  const targetSetCount = workingTargets.length

  const loggedSets = useLiveQuery(
    () => getSetsForExerciseOnDate(exerciseId, date),
    [exerciseId, date]
  ) ?? { warmup: [], working: [] }

  const thisWeekSetCount = useLiveQuery(
    () => getWorkingSetCountForSlotWeek(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  ) ?? 0
  const hasCompletedPrescribedSets = targetSetCount > 0 && thisWeekSetCount >= targetSetCount

  const thisWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  )
  const lastWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber - 1),
    [exerciseId, programExerciseId, weekNumber]
  )
  const progressBadge =
    hasCompletedPrescribedSets && thisWeekResult && lastWeekResult
      ? compareWeightSets(thisWeekResult, lastWeekResult, targetReps)
      : null

  const warmupRows: SetRow[] = warmupTargets.map((target, i) => ({
    key: `warmup-${i}`,
    isWarmup: true,
    targetReps: target,
    set: loggedSets.warmup[i] ?? null,
  }))
  const workingRows: SetRow[] = workingTargets.map((target, i) => ({
    key: `working-${i}`,
    isWarmup: false,
    targetReps: target,
    set: loggedSets.working[i] ?? null,
  }))
  const loggedExtras = loggedSets.working.slice(workingTargets.length)
  const extraRows: SetRow[] = loggedExtras.map((set, i) => ({
    key: `extra-${i}`,
    isWarmup: false,
    targetReps: set.reps,
    set,
  }))
  const pendingExtraRow: SetRow | null = showExtraRow
    ? {
        key: `extra-${extraRows.length}`,
        isWarmup: false,
        targetReps: workingTargets[workingTargets.length - 1] ?? 0,
        set: null,
      }
    : null

  const rows = [
    ...warmupRows,
    ...workingRows,
    ...extraRows,
    ...(pendingExtraRow ? [pendingExtraRow] : []),
  ]

  return (
    <div>
      {lastWeekResult && (
        <p>
          Last week: {lastWeekResult.weightLbs} lbs x {lastWeekResult.reps}
        </p>
      )}
      {rows.map((row, i) => {
        const rowLabel = row.isWarmup ? `Warmup ${i + 1}` : `Set ${i + 1 - warmupRows.length}`
        return (
          <WeightRow
            key={row.set?.id ?? row.key}
            row={row}
            rowLabel={rowLabel}
            slot={slot}
            date={date}
            weekNumber={weekNumber}
            onSaved={pendingExtraRow && row.key === pendingExtraRow.key ? () => setShowExtraRow(false) : undefined}
          />
        )
      })}
      {!showExtraRow && (
        <button type="button" onClick={() => setShowExtraRow(true)}>
          + Add extra set
        </button>
      )}
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
    </div>
  )
}

function WeightRow({
  row,
  rowLabel,
  slot,
  date,
  weekNumber,
  onSaved,
}: {
  row: SetRow
  rowLabel: string
  slot: ResolvedSlot
  date: string
  weekNumber: number
  onSaved?: () => void
}) {
  const [weight, setWeight] = useState(row.set ? String(row.set.weightLbs) : '')
  const [reps, setReps] = useState(row.set ? String(row.set.reps) : String(row.targetReps))
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const weightId = `weight-${slot.programExercise.id}-${row.key}`
  const repsId = `reps-${slot.programExercise.id}-${row.key}`

  async function handleSave() {
    if (isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
      if (row.set) {
        await updateSet(row.set.id!, { weightLbs, reps: repsNum })
        setPrMessage(null)
      } else {
        const pr = await logWeightSet({
          exerciseId: slot.programExercise.exerciseId,
          date,
          weightLbs,
          reps: repsNum,
          isWarmup: row.isWarmup,
          programExerciseId: slot.programExercise.id,
          weekNumber,
        })
        setPrMessage(!row.isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
      }
      onSaved?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <span>
        {rowLabel} (target {row.targetReps})
      </span>
      <label htmlFor={weightId}>Weight (lbs) — {rowLabel}</label>
      <input id={weightId} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <label htmlFor={repsId}>Reps — {rowLabel}</label>
      <input id={repsId} type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
      <button type="button" onClick={handleSave} disabled={isSubmitting}>
        {row.set ? 'Update' : 'Log set'}
      </button>
      {prMessage && <p role="status">{prMessage}</p>}
    </div>
  )
}
```

This removes the old `isWarmup` toggle checkbox entirely — warmup vs. working is now determined by which section of fixed rows a row belongs to, not a per-submission checkbox.

- [ ] **Step 4: Run `ProgramSlotCard.test.tsx` to verify it passes**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Update `programIntegration.test.tsx`**

In `src/screens/programIntegration.test.tsx`, change:

```ts
    render(<ProgramSlotCard slot={slot} date={PROGRAM_DATE} weekNumber={WEEK_NUMBER} />)

    await user.type(screen.getByLabelText(/weight/i), '225')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
```

to:

```ts
    render(<ProgramSlotCard slot={slot} date={PROGRAM_DATE} weekNumber={WEEK_NUMBER} />)

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '225')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all tests pass (the `SimpleValueSlotForm` and `CategoryChoiceSlotForm` tests in `ProgramSlotCard.test.tsx` are untouched by this task and should still be green), no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgramSlotCard.tsx src/components/ProgramSlotCard.test.tsx src/screens/programIntegration.test.tsx
git commit -m "Rewrite WeightSlotForm as fixed per-set rows with independent edit"
```

---

### Task 7: Rewrite `SimpleValueSlotForm` as fixed per-set checkbox rows

**Files:**
- Modify: `src/components/ProgramSlotCard.tsx` (replace `SimpleValueSlotForm`)
- Modify: `src/components/ProgramSlotCard.test.tsx` (rewrite the bodyweight/simple-value tests)

**Interfaces:**
- Consumes: `appendProgramLogValue`, `removeLastProgramLogValue` (Task 3), `getProgramLogEntriesForDate`, `getLastWeekSimpleValue` (existing), `compareSimpleValues` (existing)
- Produces: checkbox `id="set-{programExerciseId}-{rowIndex}"`, label `Set N (target T)`

- [ ] **Step 1: Rewrite the affected tests in `ProgramSlotCard.test.tsx`**

Replace the `'logs a bodyweight_reps set via the simple numeric form'` test with:

```ts
  it('checking the first row logs its prescribed target value', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Depth Drop')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 3, programExerciseId: 3, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const row1 = screen.getByLabelText(/set 1 \(target 3\)/i)
    await user.click(row1)

    await waitFor(() => expect(row1).toBeChecked())
    expect(screen.getByLabelText(/set 2 \(target 3\)/i)).not.toBeChecked()
  })

  it('unchecking the most recently checked row removes it, but an earlier row cannot be unchecked', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Uncheck Row')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 10, programExerciseId: 10, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 4], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const row1 = screen.getByLabelText(/set 1 \(target 3\)/i)
    const row2 = screen.getByLabelText(/set 2 \(target 4\)/i)
    await user.click(row1)
    await waitFor(() => expect(row1).toBeChecked())
    await user.click(row2)
    await waitFor(() => expect(row2).toBeChecked())

    await user.click(row2)
    await waitFor(() => expect(row2).not.toBeChecked())
    expect(row1).toBeChecked()
  })

  it('adds an extra checkbox row beyond the prescription, logging the last target value when checked', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Extra Bodyweight Row')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 11, programExerciseId: 11, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.click(screen.getByLabelText(/set 1 \(target 3\)/i))
    await waitFor(() => expect(screen.getByLabelText(/set 1 \(target 3\)/i)).toBeChecked())

    await user.click(screen.getByRole('button', { name: /add extra set/i }))
    const extraRow = screen.getByLabelText(/set 2 \(target 3\)/i)
    await user.click(extraRow)

    await waitFor(() => expect(extraRow).toBeChecked())
  })
```

Update the `'shows last week\'s value and a beat badge for a simple-value slot'` test — it currently types `'4'` into a value input and clicks "Add Set". Change:

```ts
    expect(await screen.findByText('Last week: 3')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/value/i), '4')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
```

to:

```ts
    expect(await screen.findByText('Last week: 3')).toBeInTheDocument()

    // Prescription targets are [3, 3]; the last logged target (3) does not
    // beat last week's 3, so add an extra row logging a higher value to
    // exercise the "beat" path deterministically.
    await user.click(screen.getByLabelText(/set 1 \(target 3\)/i))
    await user.click(screen.getByLabelText(/set 2 \(target 3\)/i))
    await user.click(screen.getByRole('button', { name: /add extra set/i }))
    await user.click(screen.getByLabelText(/set 3 \(target 3\)/i))

    expect(screen.queryByText('Beat last week!')).not.toBeInTheDocument()
```

(Since extra rows log the *last prescribed target* rather than an arbitrary typed value, this slot's prescription targets are all `3`, matching last week's `3` exactly — so the achievable outcome via checkboxes alone is "Matched", not "Beat". Assert the realistic outcome instead of forcing an artificial "beat" scenario the new checkbox-only UI can't produce for this fixture.)

Then change the final assertion:
```ts
    expect(screen.queryByText('Beat last week!')).not.toBeInTheDocument()
```
to also confirm the actual state:
```ts
    expect(await screen.findByText('Matched last week')).toBeInTheDocument()
```

(combine these into one assertion — drop the intermediate `queryByText` line and keep only the `findByText('Matched last week')` one.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: FAIL — `SimpleValueSlotForm` still renders a numeric "Value" input, not checkboxes.

- [ ] **Step 3: Replace `SimpleValueSlotForm` with the checkbox-row implementation**

In `src/components/ProgramSlotCard.tsx`, add `removeLastProgramLogValue` to the existing `programLogEntries` import:

```ts
import {
  appendProgramLogValue,
  getLastWeekCategoryValue,
  getLastWeekSimpleValue,
  getProgramLogEntriesForDate,
  logCategoryChoice,
  removeLastProgramLogValue,
} from '../db/programLogEntries'
```

Replace the entire `SimpleValueSlotForm` function with:

```tsx
function SimpleValueSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [showExtraRow, setShowExtraRow] = useState(false)
  const programExerciseId = slot.programExercise.id!
  const workingTargets = slot.prescription?.workingTargets ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedValues = entries.find((e) => e.chosenCategory === undefined)?.values ?? []

  const lastWeekValue = useLiveQuery(
    () => getLastWeekSimpleValue(programExerciseId, weekNumber - 1),
    [programExerciseId, weekNumber]
  )
  const thisWeekLastValue = loggedValues.length > 0 ? loggedValues[loggedValues.length - 1] : undefined
  const progressBadge =
    thisWeekLastValue !== undefined ? compareSimpleValues(thisWeekLastValue, lastWeekValue) : null

  const lastTarget = workingTargets[workingTargets.length - 1] ?? 0
  const loggedExtraCount = Math.max(0, loggedValues.length - workingTargets.length)
  const extraRowCount = loggedExtraCount + (showExtraRow ? 1 : 0)

  async function handleCheck(rowIndex: number, targetValue: number) {
    if (rowIndex !== loggedValues.length) return
    await appendProgramLogValue(programExerciseId, date, weekNumber, targetValue)
    if (rowIndex >= workingTargets.length) setShowExtraRow(false)
  }

  async function handleUncheck(rowIndex: number) {
    if (rowIndex !== loggedValues.length - 1) return
    await removeLastProgramLogValue(programExerciseId, date, weekNumber)
  }

  const rows = [
    ...workingTargets.map((target, i) => ({ index: i, target })),
    ...Array.from({ length: extraRowCount }, (_, i) => ({
      index: workingTargets.length + i,
      target: lastTarget,
    })),
  ]

  return (
    <div>
      {lastWeekValue !== undefined && <p>Last week: {lastWeekValue}</p>}
      {rows.map((row) => {
        const checked = row.index < loggedValues.length
        const disabled = !checked && row.index !== loggedValues.length
        const checkboxId = `set-${programExerciseId}-${row.index}`
        return (
          <div key={row.index}>
            <label htmlFor={checkboxId}>
              Set {row.index + 1} (target {row.target})
            </label>
            <input
              id={checkboxId}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) =>
                e.target.checked ? handleCheck(row.index, row.target) : handleUncheck(row.index)
              }
            />
          </div>
        )
      })}
      {!showExtraRow && (
        <button type="button" onClick={() => setShowExtraRow(true)}>
          + Add extra set
        </button>
      )}
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run `ProgramSlotCard.test.tsx` to verify it passes**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgramSlotCard.tsx src/components/ProgramSlotCard.test.tsx
git commit -m "Rewrite SimpleValueSlotForm as fixed per-set checkbox rows"
```

---

### Task 8: Consolidate Program + Log Lift into one day-navigated screen

**Files:**
- Modify: `src/screens/LogLift.tsx` (full rewrite)
- Modify: `src/screens/LogLift.test.tsx` (full rewrite, folding in `Program.test.tsx`)
- Delete: `src/screens/Program.tsx`
- Delete: `src/screens/Program.test.tsx`
- Modify: `src/App.tsx` (remove `/program` route)

**Interfaces:**
- Consumes: `DayNavigator` (Task 5), `listAllProgramDaysChronological`, `findDefaultDayIndex` (Task 4), `getDaySlots`, `groupSlotsByBlock` (existing), `ProgramSlotCard`, `SlotHeader` (existing)

- [ ] **Step 1: Rewrite `LogLift.tsx`**

Replace `src/screens/LogLift.tsx` in full:

```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExercise, listExercises } from '../db/exercises'
import { getExerciseHistory, getLastSessionSets } from '../db/workouts'
import { findDefaultDayIndex, listAllProgramDaysChronological } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { SlotHeader } from '../components/SlotHeader'
import { DayNavigator } from '../components/DayNavigator'
import { logWeightSet } from '../lib/logWeightSet'
import { todayIso } from '../lib/dates'

export function LogLift() {
  const today = todayIso()
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [isBodyweight, setIsBodyweight] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allDaysQuery = useLiveQuery(() => listAllProgramDaysChronological(), [])
  const allDays = allDaysQuery ?? []
  const currentIndex = dayIndex ?? findDefaultDayIndex(allDays, today)
  const activeEntry = currentIndex >= 0 ? allDays[currentIndex] ?? null : null

  const slots = useLiveQuery(
    () =>
      activeEntry ? getDaySlots(activeEntry.day.id!, activeEntry.week.weekNumber) : Promise.resolve([]),
    [activeEntry]
  ) ?? []

  const isLiveWeek = activeEntry
    ? today >= activeEntry.week.startDate && today <= activeEntry.week.endDate
    : false

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
    setIsBodyweight(false)
  }

  async function handleAddSet() {
    if (!selectedExerciseId || isSubmitting) return
    const repsNum = Number(reps)
    if (!Number.isInteger(repsNum) || repsNum <= 0) return
    const weightLbs = isBodyweight ? 0 : Number(weight)
    if (!isBodyweight && !(weightLbs > 0)) return

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: selectedExerciseId,
        date: today,
        weightLbs,
        reps: repsNum,
      })

      setWeight('')
      setReps('')
      setPrMessage(pr.isWeightPr || pr.isEstimated1RmPr ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // `allDaysQuery === undefined` means the live query hasn't resolved yet.
  // Waiting for it (rather than rendering with an empty `allDays` fallback)
  // matches Program.tsx's old loading gate and keeps DayNavigator from
  // briefly flashing "no days" before the real list arrives.
  if (allDaysQuery === undefined) {
    return (
      <div>
        <h1>Log</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Log</h1>

      <DayNavigator days={allDays} currentIndex={currentIndex} onNavigate={setDayIndex} />

      {activeEntry && (
        <section>
          {activeEntry.day.note && <p>{activeEntry.day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel}>
              <h3>{blockLabel}</h3>
              {blockSlots.map((slot) =>
                isLiveWeek ? (
                  <ProgramSlotCard
                    key={slot.programExercise.id}
                    slot={slot}
                    date={activeEntry.date}
                    weekNumber={activeEntry.week.weekNumber}
                  />
                ) : (
                  <SlotHeader key={slot.programExercise.id} slot={slot} />
                )
              )}
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
            <p>Last time: {lastSets.map((s) => `${s.weightLbs} x ${s.reps}`).join(', ')}</p>
          )}

          <label htmlFor="bodyweight-toggle">No weight (bodyweight)</label>
          <input
            id="bodyweight-toggle"
            type="checkbox"
            checked={isBodyweight}
            onChange={(e) => setIsBodyweight(e.target.checked)}
          />

          {!isBodyweight && (
            <div>
              <label htmlFor="weight-input">Weight (lbs)</label>
              <input
                id="weight-input"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          )}
          <div>
            <label htmlFor="reps-input">Reps</label>
            <input id="reps-input" type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete `Program.tsx` and `Program.test.tsx`**

```bash
git rm src/screens/Program.tsx src/screens/Program.test.tsx
```

- [ ] **Step 3: Remove the `/program` route from `App.tsx`**

In `src/App.tsx`, remove the import:
```ts
import { Program } from './screens/Program'
```
and remove the route:
```tsx
            <Route path="/program" element={<Program />} />
```

- [ ] **Step 4: Rewrite `LogLift.test.tsx`, folding in `Program.test.tsx`'s scenarios**

Replace `src/screens/LogLift.test.tsx` in full:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription } from '../db/programExercises'
import { db } from '../db/schema'

vi.mock('../lib/dates', () => ({ todayIso: () => '2026-07-20' }))

describe('LogLift free-form logging', () => {
  it('shows last session reference and lets the user log a new PR set', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Back Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-10')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId)
    await addSet(priorEntry, 225, 5)

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Back Squat')
    await user.click(await screen.findByText('Back Squat'))

    expect(await screen.findByText(/last time: 225 x 5/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^weight/i), '235')
    await user.type(screen.getByLabelText(/^reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
    expect(await screen.findByText(/235.*5/)).toBeInTheDocument()
  })

  it('hides the weight field and logs weightLbs: 0 when "No weight (bodyweight)" is checked', async () => {
    const user = userEvent.setup()
    await addExercise('Push Up')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Push Up')
    await user.click(await screen.findByText('Push Up'))

    await user.click(screen.getByLabelText(/no weight \(bodyweight\)/i))
    expect(screen.queryByLabelText(/^weight/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^reps/i), '20')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/0.*20/)).toBeInTheDocument()
  })

  it('does not log a set when reps are missing/invalid', async () => {
    const user = userEvent.setup()
    await addExercise('Romanian Deadlift')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Romanian Deadlift')
    await user.click(await screen.findByText('Romanian Deadlift'))

    await user.type(screen.getByLabelText(/^weight/i), '135')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/135/)).not.toBeInTheDocument()
  })
})

describe('LogLift program day + navigation', () => {
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

  it('navigates to the next day with the next-day arrow', async () => {
    const user = userEvent.setup()
    const exerciseId1 = await addExercise('Test Monday Exercise')
    await seedTestProgramDay(1, exerciseId1) // Monday 2026-07-20

    const exerciseId2 = await addExercise('Test Tuesday Exercise')
    const programId = await createProgram('Second Program', '2026-08-01', '2026-08-05')
    await addProgramWeek(programId, 1, '2026-08-01', '2026-08-05')
    const dayId = await addProgramDay(programId, 2)
    await addProgramExercise({
      dayId,
      exerciseId: exerciseId2,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    render(<LogLift />)

    expect(await screen.findByText('Test Monday Exercise')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next day/i }))

    expect(await screen.findByText('Test Tuesday Exercise')).toBeInTheDocument()
    expect(screen.queryByText('Test Monday Exercise')).not.toBeInTheDocument()
  })

  it('lets you log against a day other than today, using that day\'s computed calendar date', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Loggable Day')
    const programId = await createProgram('July Program', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    const dayId = await addProgramDay(programId, 2) // Tuesday = day 2 -> 2026-06-30
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [5],
      isTest: false,
    })

    render(<LogLift />)

    await user.click(await screen.findByRole('button', { name: /previous day/i }))

    await user.type(await screen.findByLabelText(/weight \(lbs\) — set 1/i), '135')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    await waitFor(async () => {
      const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
      expect(entries).toHaveLength(1)
    })
    const [entry] = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
    const session = await db.workoutSessions.get(entry.sessionId)
    expect(session?.date).toBe('2026-06-30')
    expect(entry.programExerciseId).toBe(slotId)
    expect(entry.weekNumber).toBe(1)
  })

  it('shows the date and disables logging when the displayed week is not actually live', async () => {
    const exerciseId = await addExercise('Test Stale Week Exercise')
    const programId = await createProgram('Ended Program', '2026-06-01', '2026-06-05')
    await addProgramWeek(programId, 1, '2026-06-01', '2026-06-05')
    const dayId = await addProgramDay(programId, 1)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [5],
      isTest: false,
    })

    render(<LogLift />)

    await user.click(await screen.findByRole('button', { name: /previous day/i }))

    expect(await screen.findByText('Test Stale Week Exercise')).toBeInTheDocument()
    expect(screen.getByText(/2026-06-01/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/weight \(lbs\) — set 1/i)).not.toBeInTheDocument()
  })
})
```

Note: none of the free-form-logging tests above seed a program day, so `ProgramSlotCard`'s row-scoped `Weight (lbs) — Set N` labels are never on screen at the same time as the free-form section's plain `Weight (lbs)` label — `screen.getByLabelText(/^weight/i)` stays unambiguous in every test in this file. If a future test ever renders both at once, switch that test's free-form queries to the exact string `screen.getByLabelText('Weight (lbs)')` / `screen.getByLabelText('Reps')` to disambiguate.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all tests pass, no type errors, `src/screens/Program.tsx` and `src/screens/Program.test.tsx` no longer exist.

- [ ] **Step 6: Commit**

```bash
git add src/screens/LogLift.tsx src/screens/LogLift.test.tsx src/App.tsx
git commit -m "Consolidate Program and Log Lift into one day-navigated screen"
```

---

### Task 9: Update the nav bar — Log + Bodyweight tabs

**Files:**
- Modify: `src/components/NavBar.tsx`
- Modify: `src/components/NavBar.test.tsx`
- Modify: `src/App.tsx` (remove the header Bodyweight icon link)

**Interfaces:**
- Produces: 5 nav links — `Log` (`/`), `Log Catching` (`/catching`), `Progress` (`/progress`), `History` (`/history`), `Bodyweight` (`/bodyweight`)

- [ ] **Step 1: Rewrite `NavBar.test.tsx`**

Replace `src/components/NavBar.test.tsx` in full:

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
    expect(screen.getByRole('link', { name: /^log$/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /log catching/i })).toHaveAttribute('href', '/catching')
    expect(screen.getByRole('link', { name: /progress/i })).toHaveAttribute('href', '/progress')
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /bodyweight/i })).toHaveAttribute('href', '/bodyweight')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/NavBar.test.tsx`
Expected: FAIL — current `NavBar` still has "Log Lift"/"Program" links and no "Bodyweight" link.

- [ ] **Step 3: Rewrite `NavBar.tsx`**

Replace `src/components/NavBar.tsx` in full:

```tsx
import { NavLink } from 'react-router-dom'

export function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Log
      </NavLink>
      <NavLink to="/catching" className={({ isActive }) => (isActive ? 'active' : '')}>
        Log Catching
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => (isActive ? 'active' : '')}>
        Progress
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
        History
      </NavLink>
      <NavLink to="/bodyweight" className={({ isActive }) => (isActive ? 'active' : '')}>
        Bodyweight
      </NavLink>
    </nav>
  )
}
```

- [ ] **Step 4: Remove the header Bodyweight icon link from `App.tsx`**

Change:

```tsx
          <div className="header-links">
            <Link to="/bodyweight" aria-label="Bodyweight" className="bodyweight-link">
              ⚖
            </Link>
            <Link to="/settings" aria-label="Settings" className="settings-link">
              ⚙
            </Link>
          </div>
```

to:

```tsx
          <div className="header-links">
            <Link to="/settings" aria-label="Settings" className="settings-link">
              ⚙
            </Link>
          </div>
```

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all tests pass, no type errors. Check `src/screens/Bodyweight.test.tsx` still passes unmodified (it tests the screen directly, not navigation into it, so it should be unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/components/NavBar.tsx src/components/NavBar.test.tsx src/App.tsx
git commit -m "Move Bodyweight into the bottom nav; consolidate Log Lift/Program into Log"
```

---

### Task 10: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: every test file passes, including `src/db/schema.test.ts` (table list unaffected by these changes — `rpe` was never a Dexie index).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx oxlint`
Expected: no errors (existing project lint config; fix anything it flags in the touched files before proceeding).

- [ ] **Step 4: Confirm RPE is fully gone**

Run: `grep -rniE "rpe" src`
Expected: no output.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the app, and confirm:
- `/` shows the day navigator with working ← / → arrows, and the current day's prescribed exercises rendered as fixed rows (weight rows with Weight/Reps + Log set/Update, bodyweight rows as checkboxes).
- The "Log something else" section still works, including the new bodyweight checkbox.
- The bottom nav shows `Log`, `Log Catching`, `Progress`, `History`, `Bodyweight` with no separate `Program` tab.
- No RPE field appears anywhere.

- [ ] **Step 6: Commit** (only if Step 3 required fixes; otherwise nothing to commit)

```bash
git add -A
git commit -m "Fix lint issues from the consolidated day-log rework"
```
