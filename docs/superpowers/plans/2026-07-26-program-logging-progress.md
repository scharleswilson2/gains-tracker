# Program Tab Logging & Last-Week Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Program tab a full logging surface (not just a read-only
schedule) for whichever day is being viewed, and show last week's actual
result next to this week's target with a beat/matched/fell-short signal —
in both the Program tab and Log Lift, since they share the same logging
component.

**Architecture:** Three narrow new read-only data-layer functions (one per
measure-type family) plus a date-math helper feed a small pure comparison
module. `ProgramSlotCard` (already the shared logging component used by Log
Lift) grows a "Last week: …" line and a progress badge per measure type.
`Program.tsx` swaps its read-only `SlotHeader`-only rendering for the full
`ProgramSlotCard`, computing each viewed day's real calendar date so logging
works for any day in the currently-displayed week, not just today.

**Tech Stack:** Same as the existing app — React, TypeScript, Dexie.js,
Vitest + React Testing Library + fake-indexeddb. No new dependencies.

## Global Constraints

- Weight unit is lbs throughout; dates are ISO strings `YYYY-MM-DD`
  throughout (existing constraints).
- Warmup-flagged sets (`SetRecord.isWarmup: true`) are excluded from the new
  last-week weight lookup (`getLastWeekWeightResult`), the same way they're
  already excluded from PR detection, estimated-1RM, and volume math
  elsewhere in the app — a warmup should never be mistaken for "what you
  actually did" when comparing weeks.
- "Last week" comparisons (the line and the badge) are omitted entirely when
  there's no prior week's data to compare against (e.g. Week 1) — never
  rendered as an empty/N/A placeholder.
- No visual/styling changes in this plan — spacing, layout, and typography
  are a separate, later spec. Don't touch CSS.
- The Program tab still shows exactly one week at a time (today's actual
  week, or Week 1 of a browsed past program) — this plan does not add a
  week-to-week browser within the current program. Only which *day* within
  the shown week is loggable is changing.
- A/B/C/Speed block labels remain display-only, never an enforced circuit
  (existing decision, unaffected by this plan).

---

### Task 1: Data-layer additions

**Files:**
- Modify: `src/lib/dates.ts`, `src/lib/dates.test.ts`
- Modify: `src/db/workouts.ts`, `src/db/workouts.test.ts`
- Modify: `src/db/programLogEntries.ts`, `src/db/programLogEntries.test.ts`

**Interfaces:**
- Consumes: existing `db` (`../db/schema`), `SetRecord`, `ProgramLogEntry`
  types, `workingSetsOnly` (`src/db/workouts.ts`).
- Produces:
  - `dates.ts`: `addDays(dateIso: string, days: number): string` — adds
    `days` calendar days to an ISO date string using local `Date`
    components (same local-time rationale as the existing `todayIso`).
  - `workouts.ts`: `getLastWeekWeightResult(exerciseId: number,
    programExerciseId: number, weekNumber: number): Promise<SetRecord |
    null>` — the last logged non-warmup set for that exact slot at that
    week number (despite the name, called with either the current week
    number or `weekNumber - 1` by later tasks — "last week" describes its
    primary use, not a hardcoded offset).
  - `programLogEntries.ts`: `getLastWeekSimpleValue(programExerciseId:
    number, weekNumber: number): Promise<number | undefined>` — the last
    value in the plain (no `chosenCategory`) `ProgramLogEntry.values` array
    for that slot at that week; `getLastWeekCategoryValue(programExerciseId:
    number, weekNumber: number, category: string): Promise<number |
    undefined>` — same, scoped to a specific `chosenCategory`.

- [ ] **Step 1: Write the failing tests for `addDays`**

Add to `src/lib/dates.test.ts` (keep the existing `todayIso` tests; add
this, and add `addDays` to the existing `from './dates'` import):
```ts
import { describe, it, expect } from 'vitest'
import { addDays, todayIso } from './dates'
```
```ts
describe('addDays', () => {
  it('adds days within the same month', () => {
    expect(addDays('2026-07-20', 4)).toBe('2026-07-24')
  })

  it('rolls over into the next month', () => {
    expect(addDays('2026-07-30', 4)).toBe('2026-08-03')
  })

  it('supports zero days', () => {
    expect(addDays('2026-07-20', 0)).toBe('2026-07-20')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `addDays` not exported.

- [ ] **Step 3: Implement `addDays`**

Add to `src/lib/dates.ts`:
```ts
export function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS (all prior tests plus the 3 new ones)

- [ ] **Step 5: Write the failing tests for `getLastWeekWeightResult`**

Add to `src/db/workouts.test.ts` (keep all existing tests; add
`getLastWeekWeightResult` to the existing `from './workouts'` import list):
```ts
describe('getLastWeekWeightResult', () => {
  it('returns the last logged set for the given slot and week', async () => {
    const exerciseId = await addExercise('Test Front Squat Progress')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 10, 3)
    await addSet(entry, 205, 5)
    await addSet(entry, 215, 3)

    const result = await getLastWeekWeightResult(exerciseId, 10, 3)
    expect(result?.weightLbs).toBe(215)
    expect(result?.reps).toBe(3)
  })

  it('excludes warmup sets even if logged last', async () => {
    const exerciseId = await addExercise('Test Warmup Excluded Progress')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 11, 3)
    await addSet(entry, 205, 5)
    await addSet(entry, 45, 8, undefined, true) // warmup, logged last

    const result = await getLastWeekWeightResult(exerciseId, 11, 3)
    expect(result?.weightLbs).toBe(205)
  })

  it('returns null when nothing was logged for that slot/week', async () => {
    const exerciseId = await addExercise('Test Nothing Logged Progress')
    const result = await getLastWeekWeightResult(exerciseId, 999, 1)
    expect(result).toBeNull()
  })

  it('does not match a different programExerciseId for the same exercise', async () => {
    const exerciseId = await addExercise('Test Shared Exercise Progress')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 12, 3)
    await addSet(entry, 300, 2)

    const result = await getLastWeekWeightResult(exerciseId, 13, 3)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: FAIL — `getLastWeekWeightResult` not exported.

- [ ] **Step 7: Implement `getLastWeekWeightResult`**

Add to `src/db/workouts.ts`:
```ts
export async function getLastWeekWeightResult(
  exerciseId: number,
  programExerciseId: number,
  weekNumber: number
): Promise<SetRecord | null> {
  const entries = await db.exerciseEntries
    .where('exerciseId')
    .equals(exerciseId)
    .and((e) => e.programExerciseId === programExerciseId && e.weekNumber === weekNumber)
    .toArray()
  if (entries.length === 0) return null

  const sets: SetRecord[] = []
  for (const entry of entries) {
    const entrySets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
    sets.push(...workingSetsOnly(entrySets))
  }
  if (sets.length === 0) return null
  return sets[sets.length - 1]
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: PASS (all prior tests plus the 4 new ones)

- [ ] **Step 9: Write the failing tests for `getLastWeekSimpleValue` and `getLastWeekCategoryValue`**

Add to `src/db/programLogEntries.test.ts` (keep all existing tests; add
`getLastWeekSimpleValue` and `getLastWeekCategoryValue` to the existing
`from './programLogEntries'` import list — `upsertProgramLogEntry` and
`logCategoryChoice` should already be imported there):
```ts
describe('getLastWeekSimpleValue', () => {
  it('returns the last value logged for the slot at that week', async () => {
    await upsertProgramLogEntry({
      programExerciseId: 40,
      date: '2026-07-13',
      weekNumber: 2,
      values: [10, 12, 15],
      isWarmup: [false, false, false],
    })
    const result = await getLastWeekSimpleValue(40, 2)
    expect(result).toBe(15)
  })

  it('returns undefined when nothing was logged for that slot/week', async () => {
    const result = await getLastWeekSimpleValue(999, 1)
    expect(result).toBeUndefined()
  })
})

describe('getLastWeekCategoryValue', () => {
  it('returns the last value for the matching category at that week', async () => {
    await logCategoryChoice({
      programExerciseId: 41,
      date: '2026-07-13',
      weekNumber: 2,
      value: 12,
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
      categoriesToPick: 3,
    })
    const result = await getLastWeekCategoryValue(41, 2, 'Triceps')
    expect(result).toBe(12)
  })

  it('returns undefined when that category was not logged that week', async () => {
    const result = await getLastWeekCategoryValue(999, 1, 'Biceps')
    expect(result).toBeUndefined()
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: FAIL — `getLastWeekSimpleValue`/`getLastWeekCategoryValue` not exported.

- [ ] **Step 11: Implement `getLastWeekSimpleValue` and `getLastWeekCategoryValue`**

Add to `src/db/programLogEntries.ts`:
```ts
export async function getLastWeekSimpleValue(
  programExerciseId: number,
  weekNumber: number
): Promise<number | undefined> {
  const entry = await db.programLogEntries
    .where('programExerciseId')
    .equals(programExerciseId)
    .and((e) => e.weekNumber === weekNumber && e.chosenCategory === undefined)
    .first()
  if (!entry || entry.values.length === 0) return undefined
  return entry.values[entry.values.length - 1]
}

export async function getLastWeekCategoryValue(
  programExerciseId: number,
  weekNumber: number,
  category: string
): Promise<number | undefined> {
  const entry = await db.programLogEntries
    .where('programExerciseId')
    .equals(programExerciseId)
    .and((e) => e.weekNumber === weekNumber && e.chosenCategory === category)
    .first()
  if (!entry || entry.values.length === 0) return undefined
  return entry.values[entry.values.length - 1]
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: PASS (all prior tests plus the 4 new ones)

- [ ] **Step 13: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions.

- [ ] **Step 14: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts \
  src/db/workouts.ts src/db/workouts.test.ts \
  src/db/programLogEntries.ts src/db/programLogEntries.test.ts
git commit -m "Add last-week lookup functions and a date-math helper"
```

---

### Task 2: Comparison logic

**Files:**
- Create: `src/lib/compareProgress.ts`
- Test: `src/lib/compareProgress.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB access).
- Produces:
  - `ProgressBadge = 'beat' | 'matched' | 'fell-short'`
  - `compareWeightSets(thisWeek: { weightLbs: number; reps: number },
    lastWeek: { weightLbs: number; reps: number } | null, targetReps: number
    | null): ProgressBadge | null`
  - `compareSimpleValues(thisWeek: number, lastWeek: number | null |
    undefined): ProgressBadge | null`
  - Task 3 imports both directly from this module.

- [ ] **Step 1: Write the failing tests**

`src/lib/compareProgress.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { compareSimpleValues, compareWeightSets } from './compareProgress'

describe('compareWeightSets', () => {
  it('returns null when there is no prior week to compare against', () => {
    expect(compareWeightSets({ weightLbs: 205, reps: 5 }, null, 5)).toBeNull()
  })

  it('returns matched when weight and reps are identical to last week', () => {
    const result = compareWeightSets({ weightLbs: 205, reps: 5 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('matched')
  })

  it('returns beat when heavier and the target reps are hit', () => {
    const result = compareWeightSets({ weightLbs: 215, reps: 5 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('beat')
  })

  it('returns beat when the same weight is lifted for more reps than last week', () => {
    const result = compareWeightSets({ weightLbs: 205, reps: 6 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('beat')
  })

  it('returns fell-short when heavier but the target reps are missed', () => {
    const result = compareWeightSets({ weightLbs: 215, reps: 3 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('fell-short')
  })

  it('returns fell-short when lighter than last week', () => {
    const result = compareWeightSets({ weightLbs: 195, reps: 5 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('fell-short')
  })

  it('returns fell-short when the same weight is lifted for fewer reps', () => {
    const result = compareWeightSets({ weightLbs: 205, reps: 3 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('fell-short')
  })
})

describe('compareSimpleValues', () => {
  it('returns null when there is no prior week to compare against', () => {
    expect(compareSimpleValues(12, null)).toBeNull()
    expect(compareSimpleValues(12, undefined)).toBeNull()
  })

  it('returns matched when equal', () => {
    expect(compareSimpleValues(12, 12)).toBe('matched')
  })

  it('returns beat when greater', () => {
    expect(compareSimpleValues(15, 12)).toBe('beat')
  })

  it('returns fell-short when less', () => {
    expect(compareSimpleValues(10, 12)).toBe('fell-short')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/compareProgress.test.ts`
Expected: FAIL — cannot find module `./compareProgress`

- [ ] **Step 3: Implement `compareProgress.ts`**

`src/lib/compareProgress.ts`:
```ts
export type ProgressBadge = 'beat' | 'matched' | 'fell-short'

export interface WeightResult {
  weightLbs: number
  reps: number
}

export function compareWeightSets(
  thisWeek: WeightResult,
  lastWeek: WeightResult | null,
  targetReps: number | null
): ProgressBadge | null {
  if (!lastWeek) return null

  if (thisWeek.weightLbs === lastWeek.weightLbs && thisWeek.reps === lastWeek.reps) {
    return 'matched'
  }

  const heavierAndHitTarget =
    thisWeek.weightLbs > lastWeek.weightLbs &&
    targetReps !== null &&
    thisWeek.reps >= targetReps
  const sameWeightMoreReps =
    thisWeek.weightLbs === lastWeek.weightLbs && thisWeek.reps > lastWeek.reps

  if (heavierAndHitTarget || sameWeightMoreReps) return 'beat'
  return 'fell-short'
}

export function compareSimpleValues(
  thisWeek: number,
  lastWeek: number | null | undefined
): ProgressBadge | null {
  if (lastWeek === null || lastWeek === undefined) return null
  if (thisWeek === lastWeek) return 'matched'
  return thisWeek > lastWeek ? 'beat' : 'fell-short'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/compareProgress.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/compareProgress.ts src/lib/compareProgress.test.ts
git commit -m "Add beat/matched/fell-short comparison logic"
```

---

### Task 3: ProgramSlotCard shows last week's result and a progress badge

**Files:**
- Modify: `src/components/ProgramSlotCard.tsx`, `src/components/ProgramSlotCard.test.tsx`

**Interfaces:**
- Consumes: `getLastWeekWeightResult` (`../db/workouts`);
  `getLastWeekSimpleValue`, `getLastWeekCategoryValue` (`../db/programLogEntries`,
  alongside the already-imported `appendProgramLogValue`,
  `getProgramLogEntriesForDate`, `logCategoryChoice`); `compareWeightSets`,
  `compareSimpleValues`, `ProgressBadge` (`../lib/compareProgress`, Task 2).
- Produces: the same `ProgramSlotCard` export. Each measure-type sub-form now
  renders a "Last week: …" line (omitted when there's no prior week's data)
  and a badge — `"Beat last week!"`, `"Matched last week"`, or `"Fell short
  of last week"` — recomputed live via `useLiveQuery` as new sets are
  logged. The existing all-time "PR!" badge is unrelated and can appear
  alongside this new one.

- [ ] **Step 1: Write the failing tests**

Replace the top of `src/components/ProgramSlotCard.test.tsx` (keep
`makeSlot` and all 7 existing tests; add these imports):
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgramSlotCard } from './ProgramSlotCard'
import { addExercise } from '../db/exercises'
import { getOrCreateSessionForDate, getOrCreateExerciseEntry, addSet } from '../db/workouts'
import { logCategoryChoice, upsertProgramLogEntry } from '../db/programLogEntries'
import { db } from '../db/schema'
import type { ResolvedSlot } from '../db/programExercises'
```
(`render`, `screen`, `waitFor`, `db`, and `upsertProgramLogEntry` are
already imported by the existing file and used by its current tests — this
shows the full resulting import block for reference. The only real
additions are `getOrCreateSessionForDate`, `getOrCreateExerciseEntry`,
`addSet` from `../db/workouts`, and `logCategoryChoice` alongside the
already-imported `upsertProgramLogEntry` from `../db/programLogEntries`.
None of the new tests below use `waitFor` themselves, but it stays imported
since an existing test still needs it.)

Add these tests (after the existing 7, still inside `describe('ProgramSlotCard', ...)`):
```tsx
it('shows last week\'s result and a "Beat last week!" badge when this week beats it', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Beat Squat')
  const priorSession = await getOrCreateSessionForDate('2026-07-13')
  const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 50, 3)
  await addSet(priorEntry, 205, 5)

  const slot = makeSlot(
    { id: 50, exerciseId, measureType: 'weight' },
    { id: 1, programExerciseId: 50, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
  )

  render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

  expect(await screen.findByText(/Last week: 205 lbs x 5/)).toBeInTheDocument()

  await user.type(screen.getByLabelText(/weight/i), '215')
  await user.type(screen.getByLabelText(/reps/i), '5')
  await user.click(screen.getByRole('button', { name: /add set/i }))

  expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
})

it('shows "Matched last week" when this week\'s set equals last week\'s', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Matched Squat')
  const priorSession = await getOrCreateSessionForDate('2026-07-13')
  const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 51, 3)
  await addSet(priorEntry, 205, 5)

  const slot = makeSlot(
    { id: 51, exerciseId, measureType: 'weight' },
    { id: 2, programExerciseId: 51, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
  )

  render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

  await user.type(screen.getByLabelText(/weight/i), '205')
  await user.type(screen.getByLabelText(/reps/i), '5')
  await user.click(screen.getByRole('button', { name: /add set/i }))

  expect(await screen.findByText('Matched last week')).toBeInTheDocument()
})

it('shows "Fell short of last week" when this week is lighter', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Fell Short Squat')
  const priorSession = await getOrCreateSessionForDate('2026-07-13')
  const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 52, 3)
  await addSet(priorEntry, 205, 5)

  const slot = makeSlot(
    { id: 52, exerciseId, measureType: 'weight' },
    { id: 3, programExerciseId: 52, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
  )

  render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

  await user.type(screen.getByLabelText(/weight/i), '195')
  await user.type(screen.getByLabelText(/reps/i), '5')
  await user.click(screen.getByRole('button', { name: /add set/i }))

  expect(await screen.findByText('Fell short of last week')).toBeInTheDocument()
})

it('omits the last-week line and badge when nothing was logged last week', async () => {
  const exerciseId = await addExercise('Test No Prior Week')
  const slot = makeSlot(
    { id: 53, exerciseId, measureType: 'weight' },
    { id: 4, programExerciseId: 53, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
  )

  render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={1} />)

  expect(screen.queryByText(/Last week/)).not.toBeInTheDocument()
})

it('shows last week\'s value and a beat badge for a simple-value slot', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Depth Drop Progress')
  await upsertProgramLogEntry({
    programExerciseId: 54,
    date: '2026-07-13',
    weekNumber: 3,
    values: [3],
    isWarmup: [false],
  })
  const slot = makeSlot(
    { id: 54, exerciseId, measureType: 'bodyweight_reps' },
    { id: 5, programExerciseId: 54, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
  )

  render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

  expect(await screen.findByText('Last week: 3')).toBeInTheDocument()

  await user.type(screen.getByLabelText(/value/i), '4')
  await user.click(screen.getByRole('button', { name: /add set/i }))

  expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
})

it('shows last week\'s value for a matching Arm Farm category, omitted for a non-matching one', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Arm Farm Progress')
  await logCategoryChoice({
    programExerciseId: 55,
    date: '2026-07-13',
    weekNumber: 3,
    value: 10,
    chosenCategory: 'Triceps',
    chosenExercise: 'Cable Push Downs',
    categoriesToPick: 3,
  })
  const slot = makeSlot(
    {
      id: 55,
      exerciseId,
      measureType: 'category_choice',
      categoryOptions: [
        { categoryLabel: 'Triceps', exercises: ['Cable Push Downs'] },
        { categoryLabel: 'Biceps', exercises: ['Hammer Curl'] },
      ],
      categoriesToPick: 3,
    },
    { id: 6, programExerciseId: 55, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [], isTest: false }
  )

  render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

  await user.click(screen.getByRole('button', { name: 'Biceps' }))
  expect(screen.queryByText(/Last week/)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Triceps' }))
  expect(await screen.findByText('Last week (Triceps): 10')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: FAIL — no "Last week" text or badge rendered yet.

- [ ] **Step 3: Implement the ProgramSlotCard changes**

Replace `src/components/ProgramSlotCard.tsx` in full:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { SlotHeader } from './SlotHeader'
import { logWeightSet } from '../lib/logWeightSet'
import { getLastWeekWeightResult } from '../db/workouts'
import {
  appendProgramLogValue,
  getLastWeekCategoryValue,
  getLastWeekSimpleValue,
  getProgramLogEntriesForDate,
  logCategoryChoice,
} from '../db/programLogEntries'
import { compareSimpleValues, compareWeightSets } from '../lib/compareProgress'
import type { ProgressBadge } from '../lib/compareProgress'

interface ProgramSlotCardProps {
  slot: ResolvedSlot
  date: string
  weekNumber: number
}

const BADGE_LABEL: Record<ProgressBadge, string> = {
  beat: 'Beat last week!',
  matched: 'Matched last week',
  'fell-short': 'Fell short of last week',
}

export function ProgramSlotCard({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const { programExercise } = slot

  return (
    <div>
      <SlotHeader slot={slot} />

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
  const [rpe, setRpe] = useState('')
  const [isWarmup, setIsWarmup] = useState(false)
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasWarmupTargets = (slot.prescription?.warmupTargets.length ?? 0) > 0

  const exerciseId = slot.programExercise.exerciseId
  const programExerciseId = slot.programExercise.id!
  const targetReps =
    slot.prescription && slot.prescription.workingTargets.length > 0
      ? slot.prescription.workingTargets[slot.prescription.workingTargets.length - 1]
      : null

  // Called with the current weekNumber here, and weekNumber - 1 below —
  // "last week" describes the function's primary use, not a hardcoded
  // offset, so it doubles as "this week's" result too.
  const thisWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  )
  const lastWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber - 1),
    [exerciseId, programExerciseId, weekNumber]
  )
  const progressBadge =
    thisWeekResult && lastWeekResult
      ? compareWeightSets(thisWeekResult, lastWeekResult, targetReps)
      : null

  async function handleAddSet() {
    if (isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    const rpeNum = rpe ? Number(rpe) : undefined
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
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
      setPrMessage(!isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const weightId = `weight-${slot.programExercise.id}`
  const repsId = `reps-${slot.programExercise.id}`
  const rpeId = `rpe-${slot.programExercise.id}`
  const warmupId = `warmup-${slot.programExercise.id}`

  return (
    <div>
      {lastWeekResult && (
        <p>
          Last week: {lastWeekResult.weightLbs} lbs x {lastWeekResult.reps}
        </p>
      )}
      <label htmlFor={weightId}>Weight (lbs)</label>
      <input id={weightId} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <label htmlFor={repsId}>Reps</label>
      <input id={repsId} type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
      <label htmlFor={rpeId}>RPE (optional)</label>
      <input id={rpeId} type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} />
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
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
    </div>
  )
}

function SimpleValueSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [value, setValue] = useState('')
  const programExerciseId = slot.programExercise.id!

  // Read only — the write path never derives its next state from this
  // snapshot, so a stale live-query result cannot cause a lost value.
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

  async function handleAdd() {
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) return
    setValue('')
    await appendProgramLogValue(programExerciseId, date, weekNumber, numValue)
  }

  const valueId = `value-${programExerciseId}`

  return (
    <div>
      {lastWeekValue !== undefined && <p>Last week: {lastWeekValue}</p>}
      <label htmlFor={valueId}>Value</label>
      <input id={valueId} type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" onClick={handleAdd}>
        Add Set
      </button>
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectedByCap, setRejectedByCap] = useState(false)
  const programExerciseId = slot.programExercise.id!
  const categoryOptions = slot.programExercise.categoryOptions ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedCategories = entries.map((e) => e.chosenCategory).filter(Boolean)
  const categoriesToPick = slot.programExercise.categoriesToPick ?? categoryOptions.length
  // Display-only hint. The cap itself is enforced atomically inside
  // `logCategoryChoice`, so a stale snapshot here can never let an extra
  // category through; `rejectedByCap` surfaces a write the DB turned away.
  const capReached = loggedCategories.length >= categoriesToPick

  const lastWeekCategoryValue = useLiveQuery(
    () =>
      selectedCategory
        ? getLastWeekCategoryValue(programExerciseId, weekNumber - 1, selectedCategory)
        : Promise.resolve(undefined),
    [programExerciseId, weekNumber, selectedCategory]
  )
  const thisWeekEntry = selectedCategory
    ? entries.find((e) => e.chosenCategory === selectedCategory)
    : undefined
  const thisWeekValue =
    thisWeekEntry && thisWeekEntry.values.length > 0
      ? thisWeekEntry.values[thisWeekEntry.values.length - 1]
      : undefined
  const progressBadge =
    thisWeekValue !== undefined ? compareSimpleValues(thisWeekValue, lastWeekCategoryValue) : null

  async function handleSave() {
    if (isSubmitting) return
    const numValue = Number(value)
    if (!selectedCategory || !selectedExercise || !Number.isFinite(numValue) || numValue <= 0) return
    setIsSubmitting(true)
    try {
      const result = await logCategoryChoice({
        programExerciseId,
        date,
        weekNumber,
        value: numValue,
        chosenCategory: selectedCategory,
        chosenExercise: selectedExercise,
        categoriesToPick,
      })
      setRejectedByCap(!result.ok)
      if (result.ok) setValue('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <p>Logged today: {loggedCategories.length > 0 ? loggedCategories.join(', ') : 'none'}</p>
      {(capReached || rejectedByCap) && (
        <p>
          You've logged {categoriesToPick} categories today — the max for this exercise
        </p>
      )}
      <div>
        {categoryOptions.map((category) => {
          const alreadyLogged = loggedCategories.includes(category.categoryLabel)
          const disabled = capReached && !alreadyLogged
          return (
            <button
              key={category.categoryLabel}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelectedCategory(category.categoryLabel)
                setSelectedExercise('')
              }}
            >
              {category.categoryLabel}
            </button>
          )
        })}
      </div>
      {selectedCategory && (
        <div>
          {lastWeekCategoryValue !== undefined && (
            <p>
              Last week ({selectedCategory}): {lastWeekCategoryValue}
            </p>
          )}
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
          <button type="button" onClick={handleSave} disabled={isSubmitting}>
            Save
          </button>
          {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ProgramSlotCard.test.tsx`
Expected: PASS (all prior tests plus the 6 new ones)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgramSlotCard.tsx src/components/ProgramSlotCard.test.tsx
git commit -m "Show last week's result and a progress badge in ProgramSlotCard"
```

---

### Task 4: Program tab becomes loggable for any day in the shown week

**Files:**
- Modify: `src/screens/Program.tsx`, `src/screens/Program.test.tsx`

**Interfaces:**
- Consumes: `listProgramWeeks` (`../db/programs`, already exported from the
  original Weekly Program plan — returns `ProgramWeek[]` ascending by
  `weekNumber`, each with `startDate`); `addDays` (`../lib/dates`, Task 1);
  `ProgramSlotCard` (`../components/ProgramSlotCard`, Task 3).
- Produces: the same `Program` export. Every slot on every day of the
  currently-shown week now renders the full `ProgramSlotCard` (header +
  logging form + last-week/badge) instead of the read-only `SlotHeader`
  alone — logging works for any day in that week, not just today. Each
  day's date is computed as `addDays(activeWeek.startDate, day.dayNumber -
  1)`.

- [ ] **Step 1: Write the failing test**

In `src/screens/Program.test.tsx`, replace the existing `vi.mock` call —
it currently replaces the whole `../lib/dates` module, which would silently
break `addDays` once `Program.tsx` starts using it:
```tsx
vi.mock('../lib/dates', () => ({ todayIso: () => '2026-06-29' }))
```
with:
```tsx
vi.mock('../lib/dates', async () => {
  const actual = await vi.importActual<typeof import('../lib/dates')>('../lib/dates')
  return { ...actual, todayIso: () => '2026-06-29' }
})
```
Also add `waitFor` to the existing `@testing-library/react` import:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
```
And add a new import for `db` — `addProgramExercise` and
`addProgramPrescription` (used by the new test below) are already imported
from `../db/programExercises` by the existing file, nothing to change there:
```tsx
import { db } from '../db/schema'
```

Then add this test (after the existing 2, still inside `describe('Program', ...)`):
```tsx
it('lets you log against a day other than today, using that day\'s computed calendar date', async () => {
  const user = userEvent.setup()
  const exerciseId = await addExercise('Test Loggable Day')
  const programId = await createProgram('July Program', '2026-06-29', '2026-07-24')
  await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03') // Monday-start week
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

  render(<Program />)

  await user.type(await screen.findByLabelText(/weight/i), '135')
  await user.type(screen.getByLabelText(/reps/i), '5')
  await user.click(screen.getByRole('button', { name: /add set/i }))

  await waitFor(async () => {
    const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
    expect(entries).toHaveLength(1)
  })
  const [entry] = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
  const session = await db.workoutSessions.get(entry.sessionId)
  expect(session?.date).toBe('2026-06-30')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Program.test.tsx`
Expected: FAIL — no weight input exists yet (Program still renders read-only `SlotHeader`).

- [ ] **Step 3: Implement the Program.tsx changes**

Replace `src/screens/Program.tsx` in full:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getCurrentProgramWeek, listPrograms, listProgramDays, listProgramWeeks } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { addDays, todayIso } from '../lib/dates'

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

  const activeWeeks = useLiveQuery(
    () => (activeProgramId ? listProgramWeeks(activeProgramId) : Promise.resolve([])),
    [activeProgramId]
  ) ?? []
  const activeWeek = activeWeeks.find((w) => w.weekNumber === activeWeekNumber)

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

      {daySlots.map(({ day, slots }) => {
        // Falls back to today only in the brief window before `activeWeek`
        // resolves from its own useLiveQuery — settles on the same
        // reactive tick as everything else here, well before a user could
        // plausibly log a set against it.
        const dayDate = activeWeek ? addDays(activeWeek.startDate, day.dayNumber - 1) : today
        return (
          <section key={day.id}>
            <h3>Day {day.dayNumber}</h3>
            {day.note && <p>{day.note}</p>}
            {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
              <div key={blockLabel}>
                <h4>{blockLabel}</h4>
                {blockSlots.map((slot) => (
                  <ProgramSlotCard
                    key={slot.programExercise.id}
                    slot={slot}
                    date={dayDate}
                    weekNumber={activeWeekNumber}
                  />
                ))}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Program.test.tsx`
Expected: PASS (all 3 tests — the 2 existing ones keep passing unmodified
since `ProgramSlotCard` still renders `SlotHeader` internally with the same
target-summary text they assert on)

- [ ] **Step 5: Run the full suite and verify the build**

Run: `npm test` — expected: all pass.
Run: `npx tsc -b` — expected: clean.
Run: `npm run lint` — expected: clean.
Run: `npm run build` — expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Program.tsx src/screens/Program.test.tsx
git commit -m "Make the Program tab loggable for any day in the shown week"
```
