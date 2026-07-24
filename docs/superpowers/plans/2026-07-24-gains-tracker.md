# Gains Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only, mobile-first web app for logging lifts (sets/reps/weight/RPE) and catching metrics (pop time, blocking, framing), plus bodyweight, with progress charts and PR detection.

**Architecture:** React + Vite SPA. All data lives in IndexedDB via Dexie.js; UI reads it reactively via `dexie-react-hooks`' `useLiveQuery` so screens update immediately after any write, with no manual refetch/state-sync code. Charts via Recharts. Bottom tab bar for the four primary screens (Log Lift / Log Catching / Progress / History); a persistent header icon opens Settings (Export/Import). Bodyweight logging is a small widget embedded at the top of the Progress screen's bodyweight chart section, since the spec keeps it out of the primary nav ("not a separate top-level tab") but it still needs an entry point somewhere.

**Tech Stack:** React 18, TypeScript, Vite, Dexie.js (IndexedDB), dexie-react-hooks, react-router-dom, Recharts, Vitest, @testing-library/react, fake-indexeddb, vite-plugin-pwa.

## Global Constraints

- Weight unit is lbs throughout (per spec) — no unit conversion or unit-picker anywhere.
- No network calls, no accounts/auth — everything is local to the browser (per spec).
- Estimated 1RM uses the Epley formula: `weight * (1 + reps / 30)` (per spec).
- Free-form exercise picker — exercises are created ad hoc, no fixed program/template system (explicitly out of scope per spec).
- Dates are ISO strings in `YYYY-MM-DD` format throughout the data layer — this is what all `date` fields store and what queries compare against.

---

### Task 1: Project scaffold & test tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`
- Create: `src/test/setup.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: a working Vite+React+TS app shell that renders `<App />` into `#root`, and a Vitest setup that later tasks' tests rely on (jsdom environment, fake IndexedDB, jest-dom matchers, automatic table-clear between tests via `db.tables`).

- [ ] **Step 1: Scaffold the Vite React-TS project**

Run:
```bash
cd ~/Projects/gains-tracker
npm create vite@latest . -- --template react-ts
```
When prompted about the non-empty directory (it contains `docs/` and `.git/`), choose to continue/ignore — do not let it delete `docs/`.

- [ ] **Step 2: Install runtime and dev dependencies**

Run:
```bash
npm install dexie dexie-react-hooks react-router-dom recharts
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom fake-indexeddb vite-plugin-pwa
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 4: Write the shared test setup**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { db } from '../db/schema'

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
```

Note: this imports `db` from `src/db/schema`, which Task 2 creates. This is expected — Task 1's scaffold isn't test-verified until Task 2 exists; Task 1's own verification is the build/dev-server check below.

- [ ] **Step 5: Add `package.json` test script**

Edit `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the scaffold builds and runs**

Run: `npm run build`
Expected: build succeeds (it will fail right now only if Task 2's `db.ts` doesn't exist yet — since `setup.ts` isn't part of the production build, `npm run build` should succeed independent of it).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Vite React TS project with Vitest tooling"
```

---

### Task 2: Dexie schema & DB instance

**Files:**
- Create: `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Produces: `db` (a `GainsTrackerDB` instance) and the types `Exercise`, `WorkoutSession`, `ExerciseEntry`, `SetRecord`, `CatchingSession`, `PopTimeRep`, `BlockingDrill`, `FramingDrill`, `BodyweightEntry`. All later data-layer tasks import `db` and these types from `./schema`.

- [ ] **Step 1: Write the failing test**

`src/db/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { db } from './schema'

describe('GainsTrackerDB', () => {
  it('opens and exposes all expected tables', async () => {
    await db.open()
    const tableNames = db.tables.map((t) => t.name).sort()
    expect(tableNames).toEqual(
      [
        'bodyweightEntries',
        'blockingDrills',
        'catchingSessions',
        'exerciseEntries',
        'exercises',
        'framingDrills',
        'popTimeReps',
        'sets',
        'workoutSessions',
      ].sort()
    )
  })

  it('can add and retrieve an exercise', async () => {
    const id = await db.exercises.add({ name: 'Back Squat' })
    const found = await db.exercises.get(id)
    expect(found?.name).toBe('Back Squat')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL — cannot find module `./schema`

- [ ] **Step 3: Write the schema**

`src/db/schema.ts`:
```ts
import Dexie, { type Table } from 'dexie'

export interface Exercise {
  id?: number
  name: string
  category?: string
}

export interface WorkoutSession {
  id?: number
  date: string
  notes?: string
}

export interface ExerciseEntry {
  id?: number
  sessionId: number
  exerciseId: number
}

export interface SetRecord {
  id?: number
  exerciseEntryId: number
  weightLbs: number
  reps: number
  rpe?: number
}

export interface CatchingSession {
  id?: number
  date: string
  notes?: string
}

export interface PopTimeRep {
  id?: number
  catchingSessionId: number
  seconds: number
}

export interface BlockingDrill {
  id?: number
  catchingSessionId: number
  repCount: number
  successCount: number
}

export interface FramingDrill {
  id?: number
  catchingSessionId: number
  repCount: number
  successCount: number
}

export interface BodyweightEntry {
  id?: number
  date: string
  weightLbs: number
}

export class GainsTrackerDB extends Dexie {
  exercises!: Table<Exercise, number>
  workoutSessions!: Table<WorkoutSession, number>
  exerciseEntries!: Table<ExerciseEntry, number>
  sets!: Table<SetRecord, number>
  catchingSessions!: Table<CatchingSession, number>
  popTimeReps!: Table<PopTimeRep, number>
  blockingDrills!: Table<BlockingDrill, number>
  framingDrills!: Table<FramingDrill, number>
  bodyweightEntries!: Table<BodyweightEntry, number>

  constructor() {
    super('gains-tracker')
    this.version(1).stores({
      exercises: '++id, name',
      workoutSessions: '++id, date',
      exerciseEntries: '++id, sessionId, exerciseId',
      sets: '++id, exerciseEntryId',
      catchingSessions: '++id, date',
      popTimeReps: '++id, catchingSessionId',
      blockingDrills: '++id, catchingSessionId',
      framingDrills: '++id, catchingSessionId',
      bodyweightEntries: '++id, date',
    })
  }
}

export const db = new GainsTrackerDB()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts
git commit -m "Add Dexie schema and DB instance"
```

---

### Task 3: Exercises data layer

**Files:**
- Create: `src/db/exercises.ts`
- Test: `src/db/exercises.test.ts`

**Interfaces:**
- Consumes: `db`, `Exercise` from `./schema`.
- Produces: `listExercises(): Promise<Exercise[]>`, `findExerciseByName(name: string): Promise<Exercise | undefined>`, `addExercise(name: string, category?: string): Promise<number>` (returns existing id if the name already exists, case-insensitive). Task 9 (Log Lift screen) uses all three.

- [ ] **Step 1: Write the failing tests**

`src/db/exercises.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addExercise, findExerciseByName, listExercises } from './exercises'

describe('exercises data layer', () => {
  it('adds a new exercise and finds it by name case-insensitively', async () => {
    await addExercise('Back Squat')
    const found = await findExerciseByName('back squat')
    expect(found?.name).toBe('Back Squat')
  })

  it('does not create a duplicate when adding the same name twice', async () => {
    const id1 = await addExercise('Bench Press')
    const id2 = await addExercise('bench press')
    expect(id1).toBe(id2)
    const all = await listExercises()
    expect(all.filter((e) => e.name === 'Bench Press')).toHaveLength(1)
  })

  it('lists exercises alphabetically by name', async () => {
    await addExercise('Deadlift')
    await addExercise('Clean')
    const all = await listExercises()
    const names = all.map((e) => e.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/exercises.test.ts`
Expected: FAIL — cannot find module `./exercises`

- [ ] **Step 3: Write the implementation**

`src/db/exercises.ts`:
```ts
import { db } from './schema'
import type { Exercise } from './schema'

export async function listExercises(): Promise<Exercise[]> {
  return db.exercises.orderBy('name').toArray()
}

export async function findExerciseByName(name: string): Promise<Exercise | undefined> {
  return db.exercises.where('name').equalsIgnoreCase(name).first()
}

export async function addExercise(name: string, category?: string): Promise<number> {
  const existing = await findExerciseByName(name)
  if (existing) return existing.id!
  return db.exercises.add({ name, category })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/exercises.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/exercises.ts src/db/exercises.test.ts
git commit -m "Add exercises data layer"
```

---

### Task 4: Workout sessions/entries/sets data layer

**Files:**
- Create: `src/db/workouts.ts`
- Test: `src/db/workouts.test.ts`

**Interfaces:**
- Consumes: `db`, `SetRecord` from `./schema`; `addExercise` from `./exercises` (used only in tests to get an exerciseId).
- Produces: `getOrCreateSessionForDate(date: string): Promise<number>`, `getOrCreateExerciseEntry(sessionId: number, exerciseId: number): Promise<number>`, `addSet(exerciseEntryId: number, weightLbs: number, reps: number, rpe?: number): Promise<number>`, `ExerciseHistoryEntry` (`{ date: string; sets: SetRecord[] }`), `getExerciseHistory(exerciseId: number): Promise<ExerciseHistoryEntry[]>` (ascending by date), `getLastSessionSets(exerciseId: number, beforeDate: string): Promise<SetRecord[]>`. Task 5's PR detection consumes `SetRecord[]` shape; Task 9 (Log Lift screen) and Task 11 (Progress screen) use all of the above.

- [ ] **Step 1: Write the failing tests**

`src/db/workouts.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addExercise } from './exercises'
import {
  addSet,
  getExerciseHistory,
  getLastSessionSets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
} from './workouts'

describe('workouts data layer', () => {
  it('reuses the same session for the same date', async () => {
    const id1 = await getOrCreateSessionForDate('2026-07-20')
    const id2 = await getOrCreateSessionForDate('2026-07-20')
    expect(id1).toBe(id2)
  })

  it('reuses the same exercise entry for the same session+exercise', async () => {
    const sessionId = await getOrCreateSessionForDate('2026-07-21')
    const exerciseId = await addExercise('Back Squat')
    const entryId1 = await getOrCreateExerciseEntry(sessionId, exerciseId)
    const entryId2 = await getOrCreateExerciseEntry(sessionId, exerciseId)
    expect(entryId1).toBe(entryId2)
  })

  it('records exercise history in ascending date order with its sets', async () => {
    const exerciseId = await addExercise('Bench Press')

    const session1 = await getOrCreateSessionForDate('2026-07-15')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 185, 5)

    const session2 = await getOrCreateSessionForDate('2026-07-22')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 195, 5, 8)

    const history = await getExerciseHistory(exerciseId)
    expect(history.map((h) => h.date)).toEqual(['2026-07-15', '2026-07-22'])
    expect(history[1].sets).toEqual([
      expect.objectContaining({ weightLbs: 195, reps: 5, rpe: 8 }),
    ])
  })

  it('returns the most recent prior session sets for "last time" reference', async () => {
    const exerciseId = await addExercise('Deadlift')

    const session1 = await getOrCreateSessionForDate('2026-07-10')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 315, 3)

    const session2 = await getOrCreateSessionForDate('2026-07-17')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 325, 3)

    const lastSets = await getLastSessionSets(exerciseId, '2026-07-24')
    expect(lastSets).toEqual([expect.objectContaining({ weightLbs: 325, reps: 3 })])
  })

  it('returns an empty array when there is no prior session', async () => {
    const exerciseId = await addExercise('Overhead Press')
    const lastSets = await getLastSessionSets(exerciseId, '2026-07-24')
    expect(lastSets).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: FAIL — cannot find module `./workouts`

- [ ] **Step 3: Write the implementation**

`src/db/workouts.ts`:
```ts
import { db } from './schema'
import type { SetRecord } from './schema'

export async function getOrCreateSessionForDate(date: string): Promise<number> {
  const existing = await db.workoutSessions.where('date').equals(date).first()
  if (existing) return existing.id!
  return db.workoutSessions.add({ date })
}

export async function getOrCreateExerciseEntry(
  sessionId: number,
  exerciseId: number
): Promise<number> {
  const existing = await db.exerciseEntries
    .where('sessionId')
    .equals(sessionId)
    .and((e) => e.exerciseId === exerciseId)
    .first()
  if (existing) return existing.id!
  return db.exerciseEntries.add({ sessionId, exerciseId })
}

export async function addSet(
  exerciseEntryId: number,
  weightLbs: number,
  reps: number,
  rpe?: number
): Promise<number> {
  return db.sets.add({ exerciseEntryId, weightLbs, reps, rpe })
}

export interface ExerciseHistoryEntry {
  date: string
  sets: SetRecord[]
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
    results.push({ date: session.date, sets })
  }
  results.sort((a, b) => a.date.localeCompare(b.date))
  return results
}

export async function getLastSessionSets(
  exerciseId: number,
  beforeDate: string
): Promise<SetRecord[]> {
  const history = await getExerciseHistory(exerciseId)
  const prior = history.filter((h) => h.date < beforeDate)
  if (prior.length === 0) return []
  return prior[prior.length - 1].sets
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/workouts.ts src/db/workouts.test.ts
git commit -m "Add workout sessions/entries/sets data layer"
```

---

### Task 5: Estimated 1RM + PR detection (pure logic)

**Files:**
- Create: `src/lib/oneRepMax.ts`, `src/lib/prDetection.ts`
- Test: `src/lib/oneRepMax.test.ts`, `src/lib/prDetection.test.ts`

**Interfaces:**
- Consumes: `SetRecord` from `../db/schema` (structural only — any object with `weightLbs`/`reps` works, `prDetection.ts` types its params as `Pick<SetRecord, 'weightLbs' | 'reps'>`).
- Produces: `estimateOneRepMax(weightLbs: number, reps: number): number`; `PrResult` (`{ isWeightPr: boolean; isEstimated1RmPr: boolean }`) and `detectPr(newSet: Pick<SetRecord, 'weightLbs' | 'reps'>, priorSets: Pick<SetRecord, 'weightLbs' | 'reps'>[]): PrResult`. Task 9 (Log Lift screen, to show the "PR!" badge) and Task 11 (Progress screen, to list PRs) both use `detectPr` and `estimateOneRepMax`.

- [ ] **Step 1: Write the failing test for estimateOneRepMax**

`src/lib/oneRepMax.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { estimateOneRepMax } from './oneRepMax'

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a 1-rep set', () => {
    expect(estimateOneRepMax(225, 1)).toBe(225)
  })

  it('applies the Epley formula for multi-rep sets', () => {
    // 225 * (1 + 5/30) = 262.5
    expect(estimateOneRepMax(225, 5)).toBeCloseTo(262.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/oneRepMax.test.ts`
Expected: FAIL — cannot find module `./oneRepMax`

- [ ] **Step 3: Implement estimateOneRepMax**

`src/lib/oneRepMax.ts`:
```ts
export function estimateOneRepMax(weightLbs: number, reps: number): number {
  if (reps <= 1) return weightLbs
  return weightLbs * (1 + reps / 30)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/oneRepMax.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for detectPr**

`src/lib/prDetection.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { detectPr } from './prDetection'

describe('detectPr', () => {
  it('flags a weight PR when the new set beats the best weight at the same rep count', () => {
    const result = detectPr(
      { weightLbs: 235, reps: 5 },
      [{ weightLbs: 225, reps: 5 }, { weightLbs: 300, reps: 1 }]
    )
    expect(result.isWeightPr).toBe(true)
  })

  it('does not flag a weight PR when a heavier set exists at the same rep count', () => {
    const result = detectPr(
      { weightLbs: 220, reps: 5 },
      [{ weightLbs: 225, reps: 5 }]
    )
    expect(result.isWeightPr).toBe(false)
  })

  it('flags an estimated 1RM PR based on the Epley formula across all prior sets', () => {
    // new: 225 * (1 + 5/30) = 262.5 vs prior best 300*(1+1/30)=310 -> not a PR
    const notPr = detectPr(
      { weightLbs: 225, reps: 5 },
      [{ weightLbs: 300, reps: 1 }]
    )
    expect(notPr.isEstimated1RmPr).toBe(false)

    // new: 250 * (1 + 5/30) = 291.67 vs prior best 280*(1+1/30)=289.33 -> PR
    const isPr = detectPr(
      { weightLbs: 250, reps: 5 },
      [{ weightLbs: 280, reps: 1 }]
    )
    expect(isPr.isEstimated1RmPr).toBe(true)
  })

  it('treats an empty prior-sets list as any new set being a PR', () => {
    const result = detectPr({ weightLbs: 135, reps: 8 }, [])
    expect(result.isWeightPr).toBe(true)
    expect(result.isEstimated1RmPr).toBe(true)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/lib/prDetection.test.ts`
Expected: FAIL — cannot find module `./prDetection`

- [ ] **Step 7: Implement detectPr**

`src/lib/prDetection.ts`:
```ts
import type { SetRecord } from '../db/schema'
import { estimateOneRepMax } from './oneRepMax'

type SetLike = Pick<SetRecord, 'weightLbs' | 'reps'>

export interface PrResult {
  isWeightPr: boolean
  isEstimated1RmPr: boolean
}

export function detectPr(newSet: SetLike, priorSets: SetLike[]): PrResult {
  const priorAtSameReps = priorSets.filter((s) => s.reps === newSet.reps)
  const bestWeightAtReps = priorAtSameReps.reduce((max, s) => Math.max(max, s.weightLbs), 0)
  const isWeightPr = newSet.weightLbs > bestWeightAtReps

  const newEstimate = estimateOneRepMax(newSet.weightLbs, newSet.reps)
  const bestPriorEstimate = priorSets.reduce(
    (max, s) => Math.max(max, estimateOneRepMax(s.weightLbs, s.reps)),
    0
  )
  const isEstimated1RmPr = newEstimate > bestPriorEstimate

  return { isWeightPr, isEstimated1RmPr }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/lib/prDetection.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add src/lib/oneRepMax.ts src/lib/oneRepMax.test.ts src/lib/prDetection.ts src/lib/prDetection.test.ts
git commit -m "Add estimated 1RM and PR detection logic"
```

---

### Task 6: Catching data layer

**Files:**
- Create: `src/db/catching.ts`
- Test: `src/db/catching.test.ts`

**Interfaces:**
- Consumes: `db` from `./schema`.
- Produces: `getOrCreateCatchingSessionForDate(date: string): Promise<number>`, `addPopTimeRep(catchingSessionId: number, seconds: number): Promise<number>`, `getPopTimeReps(catchingSessionId: number): Promise<PopTimeRep[]>`, `popTimeStats(reps: { seconds: number }[]): { best: number | null; average: number | null }`, `recordBlockingDrill(catchingSessionId: number, repCount: number, successCount: number): Promise<number>`, `recordFramingDrill(catchingSessionId: number, repCount: number, successCount: number): Promise<number>`, `successRate(repCount: number, successCount: number): number | null` (percentage 0-100). Task 10 (Log Catching screen) and Task 11 (Progress screen) use all of these.

- [ ] **Step 1: Write the failing tests**

`src/db/catching.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  addPopTimeRep,
  getOrCreateCatchingSessionForDate,
  getPopTimeReps,
  popTimeStats,
  recordBlockingDrill,
  recordFramingDrill,
  successRate,
} from './catching'

describe('catching data layer', () => {
  it('reuses the same catching session for the same date', async () => {
    const id1 = await getOrCreateCatchingSessionForDate('2026-07-20')
    const id2 = await getOrCreateCatchingSessionForDate('2026-07-20')
    expect(id1).toBe(id2)
  })

  it('records multiple pop time reps for a session and retrieves them', async () => {
    const sessionId = await getOrCreateCatchingSessionForDate('2026-07-21')
    await addPopTimeRep(sessionId, 1.95)
    await addPopTimeRep(sessionId, 1.89)
    const reps = await getPopTimeReps(sessionId)
    expect(reps.map((r) => r.seconds).sort()).toEqual([1.89, 1.95])
  })

  it('computes best and average pop time', () => {
    const stats = popTimeStats([{ seconds: 2.01 }, { seconds: 1.89 }, { seconds: 1.95 }])
    expect(stats.best).toBe(1.89)
    expect(stats.average).toBeCloseTo((2.01 + 1.89 + 1.95) / 3)
  })

  it('returns nulls for pop time stats with no reps', () => {
    expect(popTimeStats([])).toEqual({ best: null, average: null })
  })

  it('records blocking and framing drills', async () => {
    const sessionId = await getOrCreateCatchingSessionForDate('2026-07-22')
    await recordBlockingDrill(sessionId, 20, 16)
    await recordFramingDrill(sessionId, 15, 12)
  })

  it('computes success rate as a percentage', () => {
    expect(successRate(20, 16)).toBe(80)
    expect(successRate(0, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/catching.test.ts`
Expected: FAIL — cannot find module `./catching`

- [ ] **Step 3: Write the implementation**

`src/db/catching.ts`:
```ts
import { db } from './schema'
import type { PopTimeRep } from './schema'

export async function getOrCreateCatchingSessionForDate(date: string): Promise<number> {
  const existing = await db.catchingSessions.where('date').equals(date).first()
  if (existing) return existing.id!
  return db.catchingSessions.add({ date })
}

export async function addPopTimeRep(
  catchingSessionId: number,
  seconds: number
): Promise<number> {
  return db.popTimeReps.add({ catchingSessionId, seconds })
}

export async function getPopTimeReps(catchingSessionId: number): Promise<PopTimeRep[]> {
  return db.popTimeReps.where('catchingSessionId').equals(catchingSessionId).toArray()
}

export function popTimeStats(
  reps: { seconds: number }[]
): { best: number | null; average: number | null } {
  if (reps.length === 0) return { best: null, average: null }
  const best = Math.min(...reps.map((r) => r.seconds))
  const average = reps.reduce((sum, r) => sum + r.seconds, 0) / reps.length
  return { best, average }
}

export async function recordBlockingDrill(
  catchingSessionId: number,
  repCount: number,
  successCount: number
): Promise<number> {
  return db.blockingDrills.add({ catchingSessionId, repCount, successCount })
}

export async function recordFramingDrill(
  catchingSessionId: number,
  repCount: number,
  successCount: number
): Promise<number> {
  return db.framingDrills.add({ catchingSessionId, repCount, successCount })
}

export function successRate(repCount: number, successCount: number): number | null {
  if (repCount === 0) return null
  return (successCount / repCount) * 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/catching.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/catching.ts src/db/catching.test.ts
git commit -m "Add catching data layer (pop time, blocking, framing)"
```

---

### Task 7: Bodyweight data layer

**Files:**
- Create: `src/db/bodyweight.ts`
- Test: `src/db/bodyweight.test.ts`

**Interfaces:**
- Consumes: `db` from `./schema`.
- Produces: `addBodyweightEntry(date: string, weightLbs: number): Promise<number>` (upserts by date), `listBodyweightEntries(): Promise<BodyweightEntry[]>` (ascending by date). Task 11 (Progress screen) uses both.

- [ ] **Step 1: Write the failing tests**

`src/db/bodyweight.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addBodyweightEntry, listBodyweightEntries } from './bodyweight'

describe('bodyweight data layer', () => {
  it('adds entries and lists them ascending by date', async () => {
    await addBodyweightEntry('2026-07-22', 195)
    await addBodyweightEntry('2026-07-15', 197)
    const entries = await listBodyweightEntries()
    expect(entries.map((e) => e.date)).toEqual(['2026-07-15', '2026-07-22'])
  })

  it('upserts (overwrites) the entry for a date that already has one', async () => {
    await addBodyweightEntry('2026-07-20', 196)
    await addBodyweightEntry('2026-07-20', 194)
    const entries = await listBodyweightEntries()
    const forDate = entries.filter((e) => e.date === '2026-07-20')
    expect(forDate).toHaveLength(1)
    expect(forDate[0].weightLbs).toBe(194)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/bodyweight.test.ts`
Expected: FAIL — cannot find module `./bodyweight`

- [ ] **Step 3: Write the implementation**

`src/db/bodyweight.ts`:
```ts
import { db } from './schema'
import type { BodyweightEntry } from './schema'

export async function addBodyweightEntry(date: string, weightLbs: number): Promise<number> {
  const existing = await db.bodyweightEntries.where('date').equals(date).first()
  if (existing) {
    await db.bodyweightEntries.update(existing.id!, { weightLbs })
    return existing.id!
  }
  return db.bodyweightEntries.add({ date, weightLbs })
}

export async function listBodyweightEntries(): Promise<BodyweightEntry[]> {
  return db.bodyweightEntries.orderBy('date').toArray()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/bodyweight.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/bodyweight.ts src/db/bodyweight.test.ts
git commit -m "Add bodyweight data layer"
```

---

### Task 8: App shell — routing, bottom nav, header

**Files:**
- Modify: `src/App.tsx`, `src/App.css`
- Create: `src/components/NavBar.tsx`
- Create placeholder screens: `src/screens/LogLift.tsx`, `src/screens/LogCatching.tsx`, `src/screens/Progress.tsx`, `src/screens/History.tsx`, `src/screens/Settings.tsx` (each a minimal component with just a heading — filled in by later tasks)
- Test: `src/components/NavBar.test.tsx`

**Interfaces:**
- Produces: routes `/` (Log Lift), `/catching` (Log Catching), `/progress` (Progress), `/history` (History), `/settings` (Settings). `NavBar` renders 4 links (Lift/Catching/Progress/History) plus the App header renders a Settings link. Later tasks (9–13) replace each placeholder screen's contents in place — they do not change the routes.

- [ ] **Step 1: Write the failing NavBar test**

`src/components/NavBar.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavBar } from './NavBar'

describe('NavBar', () => {
  it('renders links to all four primary screens', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /log lift/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /log catching/i })).toHaveAttribute('href', '/catching')
    expect(screen.getByRole('link', { name: /progress/i })).toHaveAttribute('href', '/progress')
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/NavBar.test.tsx`
Expected: FAIL — cannot find module `./NavBar`

- [ ] **Step 3: Implement NavBar**

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
Expected: PASS (1 test)

- [ ] **Step 5: Create placeholder screens**

`src/screens/LogLift.tsx`:
```tsx
export function LogLift() {
  return <h1>Log Lift</h1>
}
```

`src/screens/LogCatching.tsx`:
```tsx
export function LogCatching() {
  return <h1>Log Catching</h1>
}
```

`src/screens/Progress.tsx`:
```tsx
export function Progress() {
  return <h1>Progress</h1>
}
```

`src/screens/History.tsx`:
```tsx
export function History() {
  return <h1>History</h1>
}
```

`src/screens/Settings.tsx`:
```tsx
export function Settings() {
  return <h1>Settings</h1>
}
```

- [ ] **Step 6: Wire up routing and layout in App.tsx**

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { LogLift } from './screens/LogLift'
import { LogCatching } from './screens/LogCatching'
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

- [ ] **Step 7: Add layout styles**

`src/App.css` (replace contents):
```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #ddd;
}

.app-title { font-weight: 600; }

.settings-link {
  font-size: 1.25rem;
  text-decoration: none;
  color: inherit;
}

.app-content {
  flex: 1;
  padding: 1rem;
  padding-bottom: 4.5rem;
}

.nav-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 0;
  background: white;
  border-top: 1px solid #ddd;
}

.nav-bar a {
  text-decoration: none;
  color: #666;
  font-size: 0.85rem;
}

.nav-bar a.active {
  color: #111;
  font-weight: 600;
}
```

- [ ] **Step 8: Run the full test suite and verify the app runs**

Run: `npm test`
Expected: all tests pass.

Run: `npm run dev` and open the printed local URL in a browser.
Expected: header with title + gear icon, "Log Lift" placeholder page, bottom nav with 4 tabs that navigate correctly.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/App.css src/components/NavBar.tsx src/components/NavBar.test.tsx src/screens
git commit -m "Add app shell with routing, bottom nav, and settings header"
```

---

### Task 9: Log Lift screen

**Files:**
- Modify: `src/screens/LogLift.tsx`
- Test: `src/screens/LogLift.test.tsx`

**Interfaces:**
- Consumes: `listExercises`, `addExercise` from `../db/exercises`; `getOrCreateSessionForDate`, `getOrCreateExerciseEntry`, `addSet`, `getExerciseHistory`, `getLastSessionSets` from `../db/workouts`; `detectPr` from `../lib/prDetection`; `useLiveQuery` from `dexie-react-hooks`; `db` from `../db/schema`.
- Produces: a screen where the user picks/creates today's exercise, adds sets, sees the last session's numbers, and sees a "PR!" badge on a new PR.

- [ ] **Step 1: Write the failing test**

`src/screens/LogLift.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'

describe('LogLift', () => {
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

    await user.type(screen.getByLabelText(/weight/i), '235')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
    expect(await screen.findByText(/235.*5/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/LogLift.test.tsx`
Expected: FAIL — placeholder `LogLift` has none of this UI

- [ ] **Step 3: Implement the screen**

`src/screens/LogLift.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { addExercise, listExercises } from '../db/exercises'
import {
  addSet,
  getExerciseHistory,
  getLastSessionSets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
} from '../db/workouts'
import { detectPr } from '../lib/prDetection'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LogLift() {
  const today = todayIso()
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)

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
    if (!selectedExerciseId) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    const rpeNum = rpe ? Number(rpe) : undefined

    const priorHistory = await getExerciseHistory(selectedExerciseId)
    const priorSets = priorHistory.filter((h) => h.date < today).flatMap((h) => h.sets)
    const pr = detectPr({ weightLbs, reps: repsNum }, priorSets)

    const sessionId = await getOrCreateSessionForDate(today)
    const entryId = await getOrCreateExerciseEntry(sessionId, selectedExerciseId)
    await addSet(entryId, weightLbs, repsNum, rpeNum)

    setWeight('')
    setReps('')
    setRpe('')
    setPrMessage(pr.isWeightPr || pr.isEstimated1RmPr ? 'PR!' : null)
  }

  return (
    <div>
      <h1>Log Lift</h1>

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
          <button type="button" onClick={handleAddSet}>
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
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/screens/LogLift.tsx src/screens/LogLift.test.tsx
git commit -m "Implement Log Lift screen"
```

---

### Task 10: Log Catching screen

**Files:**
- Modify: `src/screens/LogCatching.tsx`
- Test: `src/screens/LogCatching.test.tsx`

**Interfaces:**
- Consumes: `getOrCreateCatchingSessionForDate`, `addPopTimeRep`, `getPopTimeReps`, `popTimeStats`, `recordBlockingDrill`, `recordFramingDrill` from `../db/catching`; `useLiveQuery` from `dexie-react-hooks`.
- Produces: a screen with a pop-time quick-add (running list + live best/average) and separate rep/success-count forms for blocking and framing.

- [ ] **Step 1: Write the failing test**

`src/screens/LogCatching.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogCatching } from './LogCatching'

describe('LogCatching', () => {
  it('adds pop time reps and shows live best/average', async () => {
    const user = userEvent.setup()
    render(<LogCatching />)

    // findBy* polls until the element appears, which only happens once the
    // session lookup (an async IndexedDB call) has resolved and the "ready"
    // state has rendered — this avoids a race where Add Rep is clicked before
    // the session id is available.
    const popTimeInput = await screen.findByLabelText(/pop time/i)
    await user.type(popTimeInput, '1.95')
    await user.click(screen.getByRole('button', { name: /add rep/i }))
    await user.type(popTimeInput, '1.89')
    await user.click(screen.getByRole('button', { name: /add rep/i }))

    expect(await screen.findByText(/best: 1\.89/i)).toBeInTheDocument()
    expect(await screen.findByText(/average: 1\.92/i)).toBeInTheDocument()
  })

  it('records a blocking drill with reps and successes', async () => {
    const user = userEvent.setup()
    render(<LogCatching />)

    await user.type(await screen.findByLabelText(/blocking reps/i), '20')
    await user.type(screen.getByLabelText(/blocking successes/i), '16')
    await user.click(screen.getByRole('button', { name: /save blocking/i }))

    expect(await screen.findByText(/20 reps, 16 successful/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/LogCatching.test.tsx`
Expected: FAIL — placeholder `LogCatching` has none of this UI

- [ ] **Step 3: Implement the screen**

`src/screens/LogCatching.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addPopTimeRep,
  getOrCreateCatchingSessionForDate,
  getPopTimeReps,
  popTimeStats,
  recordBlockingDrill,
  recordFramingDrill,
} from '../db/catching'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LogCatching() {
  const today = todayIso()
  const [popTimeInput, setPopTimeInput] = useState('')
  const [blockingReps, setBlockingReps] = useState('')
  const [blockingSuccesses, setBlockingSuccesses] = useState('')
  const [framingReps, setFramingReps] = useState('')
  const [framingSuccesses, setFramingSuccesses] = useState('')
  const [savedBlocking, setSavedBlocking] = useState<{ reps: number; successes: number }[]>([])
  const [savedFraming, setSavedFraming] = useState<{ reps: number; successes: number }[]>([])

  const sessionId = useLiveQuery(() => getOrCreateCatchingSessionForDate(today), [today])
  const reps = useLiveQuery(
    () => (sessionId ? getPopTimeReps(sessionId) : Promise.resolve([])),
    [sessionId]
  ) ?? []
  const stats = popTimeStats(reps)

  if (sessionId === undefined) {
    return (
      <div>
        <h1>Log Catching</h1>
        <p>Loading...</p>
      </div>
    )
  }

  async function addRep() {
    if (!sessionId || !popTimeInput) return
    await addPopTimeRep(sessionId, Number(popTimeInput))
    setPopTimeInput('')
  }

  async function saveBlocking() {
    if (!sessionId) return
    const repCount = Number(blockingReps)
    const successCount = Number(blockingSuccesses)
    await recordBlockingDrill(sessionId, repCount, successCount)
    setSavedBlocking((prev) => [...prev, { reps: repCount, successes: successCount }])
    setBlockingReps('')
    setBlockingSuccesses('')
  }

  async function saveFraming() {
    if (!sessionId) return
    const repCount = Number(framingReps)
    const successCount = Number(framingSuccesses)
    await recordFramingDrill(sessionId, repCount, successCount)
    setSavedFraming((prev) => [...prev, { reps: repCount, successes: successCount }])
    setFramingReps('')
    setFramingSuccesses('')
  }

  return (
    <div>
      <h1>Log Catching</h1>

      <section>
        <h2>Pop Time</h2>
        <label htmlFor="pop-time-input">Pop time (seconds)</label>
        <input
          id="pop-time-input"
          type="number"
          step="0.01"
          value={popTimeInput}
          onChange={(e) => setPopTimeInput(e.target.value)}
        />
        <button type="button" onClick={addRep}>
          Add Rep
        </button>
        {stats.best !== null && (
          <p>
            Best: {stats.best.toFixed(2)} | Average: {stats.average!.toFixed(2)}
          </p>
        )}
        <ul>
          {reps.map((r) => (
            <li key={r.id}>{r.seconds.toFixed(2)}s</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Blocking</h2>
        <label htmlFor="blocking-reps">Blocking reps</label>
        <input id="blocking-reps" type="number" value={blockingReps} onChange={(e) => setBlockingReps(e.target.value)} />
        <label htmlFor="blocking-successes">Blocking successes</label>
        <input
          id="blocking-successes"
          type="number"
          value={blockingSuccesses}
          onChange={(e) => setBlockingSuccesses(e.target.value)}
        />
        <button type="button" onClick={saveBlocking}>
          Save Blocking
        </button>
        <ul>
          {savedBlocking.map((b, i) => (
            <li key={i}>
              {b.reps} reps, {b.successes} successful
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Framing</h2>
        <label htmlFor="framing-reps">Framing reps</label>
        <input id="framing-reps" type="number" value={framingReps} onChange={(e) => setFramingReps(e.target.value)} />
        <label htmlFor="framing-successes">Framing successes</label>
        <input
          id="framing-successes"
          type="number"
          value={framingSuccesses}
          onChange={(e) => setFramingSuccesses(e.target.value)}
        />
        <button type="button" onClick={saveFraming}>
          Save Framing
        </button>
        <ul>
          {savedFraming.map((f, i) => (
            <li key={i}>
              {f.reps} reps, {f.successes} successful
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/LogCatching.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/screens/LogCatching.tsx src/screens/LogCatching.test.tsx
git commit -m "Implement Log Catching screen"
```

---

### Task 11: Progress screen (lift charts, PRs, catching charts, bodyweight)

**Files:**
- Modify: `src/screens/Progress.tsx`
- Test: `src/screens/Progress.test.tsx`

**Interfaces:**
- Consumes: `listExercises` from `../db/exercises`; `getExerciseHistory` from `../db/workouts`; `estimateOneRepMax` from `../lib/oneRepMax`; `detectPr` from `../lib/prDetection`; `db` (for reading all catching sessions/pop time/blocking/framing directly), `addBodyweightEntry`, `listBodyweightEntries` from `../db/bodyweight`; `useLiveQuery` from `dexie-react-hooks`; `LineChart`, `Line`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` from `recharts`.
- Produces: exercise picker + weight/est-1RM toggle line chart + volume chart + PR list; pop time chart; blocking/framing success-rate chart; bodyweight chart with an inline add-entry form (this is the only entry point for bodyweight logging, per the architecture note above).

- [ ] **Step 1: Write the failing test**

`src/screens/Progress.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Progress } from './Progress'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'

describe('Progress', () => {
  it('shows PRs for a selected exercise and lets me log bodyweight', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Back Squat')
    const session1 = await getOrCreateSessionForDate('2026-07-10')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 225, 5)
    const session2 = await getOrCreateSessionForDate('2026-07-17')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 235, 5)

    render(<Progress />)

    await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Back Squat')

    expect(await screen.findByText(/235 x 5/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/bodyweight/i), '190')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    expect(await screen.findByText(/190/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Progress.test.tsx`
Expected: FAIL — placeholder `Progress` has none of this UI

- [ ] **Step 3: Implement the screen**

`src/screens/Progress.tsx`:
```tsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../db/schema'
import { listExercises } from '../db/exercises'
import { getExerciseHistory } from '../db/workouts'
import { estimateOneRepMax } from '../lib/oneRepMax'
import { detectPr } from '../lib/prDetection'
import { popTimeStats, successRate } from '../db/catching'
import { addBodyweightEntry, listBodyweightEntries } from '../db/bodyweight'

export function Progress() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [metric, setMetric] = useState<'weight' | 'estimated1rm'>('weight')
  const [bodyweightInput, setBodyweightInput] = useState('')

  const exercisesQuery = useLiveQuery(() => listExercises(), [])
  const exercises = exercisesQuery ?? []

  const history = useLiveQuery(
    () => (selectedExerciseId ? getExerciseHistory(selectedExerciseId) : Promise.resolve([])),
    [selectedExerciseId]
  ) ?? []

  const chartData = history.map((h) => {
    const topSet = h.sets.reduce(
      (best, s) => (s.weightLbs > (best?.weightLbs ?? 0) ? s : best),
      h.sets[0]
    )
    const volume = h.sets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0)
    return {
      date: h.date,
      weight: topSet?.weightLbs ?? 0,
      estimated1rm: topSet ? Math.round(estimateOneRepMax(topSet.weightLbs, topSet.reps)) : 0,
      volume,
    }
  })

  const prSets: { date: string; weightLbs: number; reps: number }[] = []
  history.forEach((h, i) => {
    const priorSets = history.slice(0, i).flatMap((p) => p.sets)
    h.sets.forEach((s) => {
      const pr = detectPr(s, priorSets)
      if (pr.isWeightPr || pr.isEstimated1RmPr) {
        prSets.push({ date: h.date, weightLbs: s.weightLbs, reps: s.reps })
      }
      priorSets.push(s)
    })
  })

  const catchingSessions = useLiveQuery(() => db.catchingSessions.orderBy('date').toArray(), []) ?? []
  const popTimeChartData = useLiveQuery(async () => {
    const rows = []
    for (const session of catchingSessions) {
      const reps = await db.popTimeReps.where('catchingSessionId').equals(session.id!).toArray()
      const stats = popTimeStats(reps)
      if (stats.best !== null) {
        rows.push({ date: session.date, best: stats.best, average: stats.average })
      }
    }
    return rows
  }, [catchingSessions]) ?? []

  const drillChartData = useLiveQuery(async () => {
    const rows = []
    for (const session of catchingSessions) {
      const blocking = await db.blockingDrills.where('catchingSessionId').equals(session.id!).toArray()
      const framing = await db.framingDrills.where('catchingSessionId').equals(session.id!).toArray()
      const blockingReps = blocking.reduce((s, d) => s + d.repCount, 0)
      const blockingSuccesses = blocking.reduce((s, d) => s + d.successCount, 0)
      const framingReps = framing.reduce((s, d) => s + d.repCount, 0)
      const framingSuccesses = framing.reduce((s, d) => s + d.successCount, 0)
      rows.push({
        date: session.date,
        blockingRate: successRate(blockingReps, blockingSuccesses) ?? 0,
        framingRate: successRate(framingReps, framingSuccesses) ?? 0,
      })
    }
    return rows
  }, [catchingSessions]) ?? []

  const bodyweightEntries = useLiveQuery(() => listBodyweightEntries(), []) ?? []

  // All hooks above run unconditionally every render (Rules of Hooks). This
  // gate only affects which JSX is returned — it waits for the exercise list
  // specifically, since `userEvent.selectOptions` (used in tests, and
  // functionally identical to a real user picking an option) requires the
  // <option> to already exist; unlike `findByText`, it does not retry.
  if (exercisesQuery === undefined) {
    return (
      <div>
        <h1>Progress</h1>
        <p>Loading...</p>
      </div>
    )
  }

  async function logBodyweight() {
    if (!bodyweightInput) return
    const today = new Date().toISOString().slice(0, 10)
    await addBodyweightEntry(today, Number(bodyweightInput))
    setBodyweightInput('')
  }

  return (
    <div>
      <h1>Progress</h1>

      <section>
        <h2>Lift Progress</h2>
        <label htmlFor="exercise-select">Select exercise</label>
        <select
          id="exercise-select"
          onChange={(e) => setSelectedExerciseId(Number(e.target.value) || null)}
          defaultValue=""
        >
          <option value="" disabled>
            Choose...
          </option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {selectedExerciseId && (
          <>
            <div>
              <button type="button" onClick={() => setMetric('weight')}>
                Top Weight
              </button>
              <button type="button" onClick={() => setMetric('estimated1rm')}>
                Est. 1RM
              </button>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey={metric} stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>

            <h3>Volume</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="volume" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>

            <h3>PRs</h3>
            <ul>
              {prSets.map((pr, i) => (
                <li key={i}>
                  {pr.date}: {pr.weightLbs} x {pr.reps}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Pop Time</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={popTimeChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="best" stroke="#dc2626" />
            <Line type="monotone" dataKey="average" stroke="#f97316" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2>Blocking / Framing Success Rate</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={drillChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="blockingRate" fill="#2563eb" />
            <Bar dataKey="framingRate" fill="#9333ea" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2>Bodyweight</h2>
        <label htmlFor="bodyweight-input">Bodyweight (lbs)</label>
        <input
          id="bodyweight-input"
          type="number"
          value={bodyweightInput}
          onChange={(e) => setBodyweightInput(e.target.value)}
        />
        <button type="button" onClick={logBodyweight}>
          Log Bodyweight
        </button>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={bodyweightEntries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip />
            <Line type="monotone" dataKey="weightLbs" stroke="#0891b2" />
          </LineChart>
        </ResponsiveContainer>
        <ul>
          {bodyweightEntries.map((b) => (
            <li key={b.id}>
              {b.date}: {b.weightLbs}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Progress.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/screens/Progress.tsx src/screens/Progress.test.tsx
git commit -m "Implement Progress screen with lift/catching/bodyweight charts and PRs"
```

---

### Task 12: History screen

**Files:**
- Modify: `src/screens/History.tsx`
- Test: `src/screens/History.test.tsx`

**Interfaces:**
- Consumes: `db` from `../db/schema` directly (reads `workoutSessions`, `catchingSessions`, `bodyweightEntries` and merges them into one reverse-chronological feed); `useLiveQuery` from `dexie-react-hooks`.
- Produces: a flat list of all sessions (lift/catching/bodyweight) sorted newest-first, each row labeled by type and date.

- [ ] **Step 1: Write the failing test**

`src/screens/History.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { History } from './History'
import { getOrCreateSessionForDate } from '../db/workouts'
import { getOrCreateCatchingSessionForDate } from '../db/catching'
import { addBodyweightEntry } from '../db/bodyweight'

describe('History', () => {
  it('lists all session types combined, newest first', async () => {
    await getOrCreateSessionForDate('2026-07-10')
    await getOrCreateCatchingSessionForDate('2026-07-15')
    await addBodyweightEntry('2026-07-20', 190)

    render(<History />)

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('2026-07-20')
    expect(items[1]).toHaveTextContent('2026-07-15')
    expect(items[2]).toHaveTextContent('2026-07-10')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/History.test.tsx`
Expected: FAIL — placeholder `History` has none of this UI

- [ ] **Step 3: Implement the screen**

`src/screens/History.tsx`:
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
    const [lifts, catching, bodyweight] = await Promise.all([
      db.workoutSessions.toArray(),
      db.catchingSessions.toArray(),
      db.bodyweightEntries.toArray(),
    ])

    const combined: HistoryRow[] = [
      ...lifts.map((s) => ({ date: s.date, label: 'Lift session', key: `lift-${s.id}` })),
      ...catching.map((s) => ({ date: s.date, label: 'Catching session', key: `catching-${s.id}` })),
      ...bodyweight.map((b) => ({
        date: b.date,
        label: `Bodyweight: ${b.weightLbs} lbs`,
        key: `bw-${b.id}`,
      })),
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
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/screens/History.tsx src/screens/History.test.tsx
git commit -m "Implement History screen"
```

---

### Task 13: Settings screen — Export/Import JSON

**Files:**
- Create: `src/lib/exportImport.ts`
- Modify: `src/screens/Settings.tsx`
- Test: `src/lib/exportImport.test.ts`, `src/screens/Settings.test.tsx`

**Interfaces:**
- Consumes: `db` from `../db/schema`.
- Produces: `exportAllData(): Promise<string>` (JSON string containing every table's rows keyed by table name), `importAllData(json: string): Promise<void>` (clears all tables, then repopulates from the parsed JSON — used for restoring a backup). Settings screen wires these to Export/Import buttons.

- [ ] **Step 1: Write the failing test for exportImport**

`src/lib/exportImport.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { db } from '../db/schema'
import { exportAllData, importAllData } from './exportImport'

describe('exportAllData / importAllData', () => {
  it('round-trips all table data through JSON', async () => {
    await db.exercises.add({ name: 'Back Squat' })
    await db.bodyweightEntries.add({ date: '2026-07-20', weightLbs: 190 })

    const json = await exportAllData()

    await db.exercises.clear()
    await db.bodyweightEntries.clear()

    await importAllData(json)

    const exercises = await db.exercises.toArray()
    const bodyweights = await db.bodyweightEntries.toArray()
    expect(exercises.map((e) => e.name)).toEqual(['Back Squat'])
    expect(bodyweights.map((b) => b.weightLbs)).toEqual([190])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/exportImport.test.ts`
Expected: FAIL — cannot find module `./exportImport`

- [ ] **Step 3: Implement exportImport**

`src/lib/exportImport.ts`:
```ts
import { db } from '../db/schema'

export async function exportAllData(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const table of db.tables) {
    data[table.name] = await table.toArray()
  }
  return JSON.stringify(data, null, 2)
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json) as Record<string, unknown[]>
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const rows = data[table.name]
      if (rows && rows.length > 0) {
        await table.bulkAdd(rows as never[])
      }
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/exportImport.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write the failing test for the Settings screen**

`src/screens/Settings.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from './Settings'
import { db } from '../db/schema'

describe('Settings', () => {
  it('exports current data as downloadable JSON when Export is clicked', async () => {
    const user = userEvent.setup()
    await db.exercises.add({ name: 'Back Squat' })

    const createObjectURL = vi.fn(() => 'blob:mock-url')
    // jsdom doesn't implement these, and leaving them unmocked makes the
    // component's later revokeObjectURL call throw "Not implemented"
    // inside the async click handler.
    // @ts-expect-error - jsdom doesn't implement this
    global.URL.createObjectURL = createObjectURL
    // @ts-expect-error - jsdom doesn't implement this
    global.URL.revokeObjectURL = vi.fn()

    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /export/i }))

    expect(createObjectURL).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/screens/Settings.test.tsx`
Expected: FAIL — placeholder `Settings` has no Export button

- [ ] **Step 7: Implement the Settings screen**

`src/screens/Settings.tsx`:
```tsx
import { useRef } from 'react'
import { exportAllData, importAllData } from '../lib/exportImport'

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    const json = await exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gains-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await importAllData(text)
  }

  return (
    <div>
      <h1>Settings</h1>
      <button type="button" onClick={handleExport}>
        Export
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/screens/Settings.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Commit**

```bash
git add src/lib/exportImport.ts src/lib/exportImport.test.ts src/screens/Settings.tsx src/screens/Settings.test.tsx
git commit -m "Add data export/import and wire up Settings screen"
```

---

### Task 14: PWA setup (installable, home-screen icon)

**Files:**
- Modify: `vite.config.ts`
- Create: `public/pwa-192.png`, `public/pwa-512.png` (placeholder icons — any square PNG at those dimensions; generate with a simple script since no design asset exists yet)

**Interfaces:**
- Produces: a manifest + service worker (via `vite-plugin-pwa`) so the built app can be added to a phone home screen and opens full-screen. No API is consumed by other tasks — this is a build-time/config-only addition.

- [ ] **Step 1: Generate placeholder icons**

Generating real PNG artwork headlessly would require an image library dependency, which is unnecessary for placeholder art. Instead, write a tiny script that embeds a pre-encoded 1x1 PNG (valid PNG bytes, just not visually meaningful) so the manifest has valid icon files to point at.

Create `scripts/make-placeholder-icons.mjs`:
```js
import { writeFileSync } from 'node:fs'

// Minimal valid 1x1 red PNG, byte-for-byte, reused at both sizes via manifest scaling.
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

writeFileSync('public/pwa-192.png', onePixelPng)
writeFileSync('public/pwa-512.png', onePixelPng)
console.log('Wrote placeholder PWA icons — replace with real artwork later.')
```

Run: `node scripts/make-placeholder-icons.mjs`
Expected: `public/pwa-192.png` and `public/pwa-512.png` created.

- [ ] **Step 2: Configure vite-plugin-pwa**

Edit `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Gains Tracker',
        short_name: 'Gains',
        description: 'Personal strength and catching progress tracker',
        theme_color: '#111111',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 3: Verify the production build includes the manifest and service worker**

Run: `npm run build`
Expected: build succeeds; `dist/manifest.webmanifest` and `dist/sw.js` exist.

Run: `ls dist/manifest.webmanifest dist/sw.js`
Expected: both files listed (no "No such file" errors).

- [ ] **Step 4: Run the full test suite one more time**

Run: `npm test`
Expected: all tests across all prior tasks still pass.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts scripts/make-placeholder-icons.mjs public/pwa-192.png public/pwa-512.png
git commit -m "Add PWA manifest and service worker for home-screen install"
```

---

## Post-plan note

Placeholder PWA icons (Task 14) are 1x1 pixel stand-ins purely so the manifest is valid — swap `public/pwa-192.png` and `public/pwa-512.png` for real artwork whenever convenient; this has no bearing on functionality.
