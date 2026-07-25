# Weekly Program — Data Layer & Seed Data Implementation Plan (Plan A of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for coach-given monthly training programs (schema,
queries, program-day resolution), then seed the real June 29 – July 24, 2026
program plus an exercise glossary with ~50 descriptions, wired to run once
when the app starts. No UI in this plan — Plan B (a separate plan) builds Log
Lift integration, the new Program tab, glossary UI, and History/Progress
labels on top of this.

**Architecture:** Extends the existing Dexie schema (version bump to 2) with
six new tables (`programs`, `programWeeks`, `programDays`, `programExercises`,
`programPrescriptions`, `programLogEntries`) plus new optional fields on
existing tables (`exercises.description`, `exerciseEntries.programExerciseId`/
`weekNumber`, `sets.isWarmup`). Weight-based program slots reuse the existing
`WorkoutSession`/`ExerciseEntry`/`SetRecord` chain (tagged with the program
slot they fulfill); non-weight slots (bodyweight reps, time, distance,
category-choice) log into the new `programLogEntries` table, deliberately
decoupled from PR/1RM math. A pure `workingSetsOnly()` helper excludes
warmup-flagged sets from any future PR/volume/1RM calculation. The July
program's day-of-week alignment (Day 1=Mon, Day 2=Tue, Day 3=Wed/rest,
Day 4=Thu, Day 5=Fri, matching the coach's literal Mon–Fri week date ranges)
means program-day resolution is a simple date lookup — no separate
"day position" bookkeeping needed.

**Tech Stack:** Same as the existing app — Dexie.js (IndexedDB), TypeScript,
Vitest + fake-indexeddb. No new dependencies.

## Global Constraints

- Weight unit is lbs throughout (existing constraint, applies to any `weight`-
  measureType program slot).
- Dates are ISO strings `YYYY-MM-DD` throughout (existing constraint, applies
  to `Program`/`ProgramWeek` date fields — use the same string-comparison
  approach as the existing data layer, not `Date` objects).
- No network calls, no accounts/auth (existing constraint).
- The July 2026 program's exact prescribed values (sets, reps, tempo, RIR,
  targets) MUST match the transcription in Task 7 exactly — this is real
  coach-given data the user will train from, not test fixtures. Every number
  in Task 7 has already been confirmed against the source text and the
  user's clarifying answers; do not "simplify" or "round" anything.
- Confirmed interpretations of ambiguous source notation (do not re-litigate
  these — they were explicitly confirmed with the user):
  - Copenhagen Plank stays per-side (`eachSide: true`) all 4 weeks, including
    Week 3 where the source text drops the "ea" suffix.
  - Unitless "Nx" speed/agility drills (Day 2's "5-10-5, 4x"; Day 4's "10yd
    build-up with 20yd sprints, 4x") are `bodyweight_reps` slots with a
    single working target of `[4]`.
  - DB Pull Throughs ("5ea, 5ea") is per-side (`eachSide: true`), 2 working
    sets of 5 reps each side.
  - "Recovery" (end of every day) is a plain note, not a loggable slot.
  - Arm Farm/Arm Care logs as a simplified `category_choice` entry (a number
    value + which exercise was picked), not fully-typed per-exercise
    measurement.
  - Reverse Lunge's trailing rep number each week (e.g. Week 1's `5ea,3ea,
    3ea,5`) is still per-side — the missing "ea" on the last set is just
    shorthand, all 4 working sets are per-leg.

---

### Task 1: Extend Dexie schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/schema.test.ts`

**Interfaces:**
- Produces: new types `Program`, `ProgramWeek`, `ProgramDay`, `ProgramExercise`,
  `ProgramPrescription`, `ProgramLogEntry`, `CategoryOption` (`{ categoryLabel:
  string; exercises: string[] }`), `MeasureType` (`'weight' | 'bodyweight_reps'
  | 'time' | 'distance' | 'category_choice'`), `Rir` (`'L' | 'M' | 'H'`). New
  `db` tables: `programs`, `programWeeks`, `programDays`, `programExercises`,
  `programPrescriptions`, `programLogEntries`. `Exercise` gains optional
  `description?: string`. `ExerciseEntry` gains optional `programExerciseId?:
  number` and `weekNumber?: number`. `SetRecord` gains optional `isWarmup?:
  boolean`. All later tasks in this plan (and all of Plan B) import these
  types/tables from `./schema`.

- [ ] **Step 1: Write the failing test**

Add to `src/db/schema.test.ts` (new `describe` block, keep the existing one):

```ts
describe('Program schema (v2)', () => {
  it('opens and exposes all program tables alongside the original tables', async () => {
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
        'programDays',
        'programExercises',
        'programLogEntries',
        'programPrescriptions',
        'programWeeks',
        'programs',
        'sets',
        'workoutSessions',
      ].sort()
    )
  })

  it('stores a program with weeks and days, and reads them back', async () => {
    const programId = await db.programs.add({
      name: 'Test Program',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const weekId = await db.programWeeks.add({
      programId,
      weekNumber: 1,
      startDate: '2026-06-29',
      endDate: '2026-07-03',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    const week = await db.programWeeks.get(weekId)
    const day = await db.programDays.get(dayId)
    expect(week?.programId).toBe(programId)
    expect(day?.dayNumber).toBe(1)
  })

  it('stores a program exercise slot with category options and a prescription', async () => {
    const exerciseId = await db.exercises.add({ name: 'Test Exercise' })
    const programId = await db.programs.add({
      name: 'Test Program',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 5 })

    const slotId = await db.programExercises.add({
      dayId,
      exerciseId,
      blockLabel: 'C',
      orderIndex: 2,
      measureType: 'category_choice',
      eachSide: false,
      tempo: null,
      categoryOptions: [
        { categoryLabel: 'Triceps', exercises: ['Cable Push Downs', 'OH Tricep Ext'] },
      ],
      categoriesToPick: 3,
    })

    await db.programPrescriptions.add({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [],
      isTest: false,
    })

    const slot = await db.programExercises.get(slotId)
    expect(slot?.categoryOptions?.[0].categoryLabel).toBe('Triceps')
    expect(slot?.categoriesToPick).toBe(3)
  })

  it('exercises can carry an optional description', async () => {
    const id = await db.exercises.add({
      name: 'Front Squat',
      description: 'A barbell squat with the bar racked across the front of the shoulders.',
    })
    const found = await db.exercises.get(id)
    expect(found?.description).toContain('front of the shoulders')
  })

  it('exerciseEntries can carry an optional program tag, sets can carry isWarmup', async () => {
    const sessionId = await db.workoutSessions.add({ date: '2026-06-29' })
    const exerciseId = await db.exercises.add({ name: 'Front Squat' })
    const entryId = await db.exerciseEntries.add({
      sessionId,
      exerciseId,
      programExerciseId: 999,
      weekNumber: 1,
    })
    const setId = await db.sets.add({
      exerciseEntryId: entryId,
      weightLbs: 45,
      reps: 5,
      isWarmup: true,
    })
    const entry = await db.exerciseEntries.get(entryId)
    const set = await db.sets.get(setId)
    expect(entry?.weekNumber).toBe(1)
    expect(set?.isWarmup).toBe(true)
  })

  it('existing sets without isWarmup remain valid (backward compatibility)', async () => {
    const sessionId = await db.workoutSessions.add({ date: '2026-06-29' })
    const exerciseId = await db.exercises.add({ name: 'Bench Press' })
    const entryId = await db.exerciseEntries.add({ sessionId, exerciseId })
    const setId = await db.sets.add({ exerciseEntryId: entryId, weightLbs: 135, reps: 5 })
    const set = await db.sets.get(setId)
    expect(set?.isWarmup).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL — `db.programs` etc. are undefined / not a function.

- [ ] **Step 3: Extend the schema**

In `src/db/schema.ts`, add these new interfaces (near the existing ones):

```ts
export type MeasureType = 'weight' | 'bodyweight_reps' | 'time' | 'distance' | 'category_choice'
export type Rir = 'L' | 'M' | 'H'

export interface CategoryOption {
  categoryLabel: string
  exercises: string[]
}

export interface Program {
  id?: number
  name: string
  startDate: string
  endDate: string
}

export interface ProgramWeek {
  id?: number
  programId: number
  weekNumber: number
  startDate: string
  endDate: string
}

export interface ProgramDay {
  id?: number
  programId: number
  dayNumber: number
  note?: string
}

export interface ProgramExercise {
  id?: number
  dayId: number
  exerciseId: number
  blockLabel: string | null
  orderIndex: number
  measureType: MeasureType
  eachSide: boolean
  tempo: string | null
  categoryOptions?: CategoryOption[]
  categoriesToPick?: number
}

export interface ProgramPrescription {
  id?: number
  programExerciseId: number
  weekNumber: number
  rir: Rir | null
  warmupTargets: number[]
  workingTargets: number[]
  isTest: boolean
}

export interface ProgramLogEntry {
  id?: number
  programExerciseId: number
  date: string
  weekNumber: number
  values: number[]
  isWarmup: boolean[]
  chosenCategory?: string
  chosenExercise?: string
}
```

Modify the existing `Exercise`, `ExerciseEntry`, and `SetRecord` interfaces:

```ts
export interface Exercise {
  id?: number
  name: string
  category?: string
  description?: string
}
```

```ts
export interface ExerciseEntry {
  id?: number
  sessionId: number
  exerciseId: number
  programExerciseId?: number
  weekNumber?: number
}
```

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

Add the new `Table` fields to `GainsTrackerDB` and bump to `version(2)`,
keeping `version(1)` intact so Dexie's upgrade chain works correctly for any
existing installed data:

```ts
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
  programs!: Table<Program, number>
  programWeeks!: Table<ProgramWeek, number>
  programDays!: Table<ProgramDay, number>
  programExercises!: Table<ProgramExercise, number>
  programPrescriptions!: Table<ProgramPrescription, number>
  programLogEntries!: Table<ProgramLogEntry, number>

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
    this.version(2).stores({
      programs: '++id, name',
      programWeeks: '++id, programId, weekNumber',
      programDays: '++id, programId, dayNumber',
      programExercises: '++id, dayId',
      programPrescriptions: '++id, programExerciseId, weekNumber',
      programLogEntries: '++id, programExerciseId, date',
    })
  }
}

export const db = new GainsTrackerDB()
```

Note: `version(2).stores(...)` only needs to declare the NEW tables — Dexie
carries forward table definitions from earlier versions automatically. The
new optional fields on `Exercise`/`ExerciseEntry`/`SetRecord` don't need
index changes (they're not queried by), so no `.stores()` change is needed
for those, just the TypeScript interface updates above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS (7 tests — 2 original + 5 new)

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts
git commit -m "Extend Dexie schema with program tables (v2)"
```

---

### Task 2: Program/Week/Day data layer

**Files:**
- Create: `src/db/programs.ts`
- Test: `src/db/programs.test.ts`

**Interfaces:**
- Consumes: `db`, `Program`, `ProgramWeek`, `ProgramDay` from `./schema`.
- Produces: `createProgram(name: string, startDate: string, endDate: string):
  Promise<number>`, `addProgramWeek(programId: number, weekNumber: number,
  startDate: string, endDate: string): Promise<number>`, `addProgramDay(
  programId: number, dayNumber: number, note?: string): Promise<number>`,
  `ActiveProgramDay` (`{ program: Program; week: ProgramWeek; day: ProgramDay
  }`), `getActiveProgramDay(date: string): Promise<ActiveProgramDay | null>`.
  Task 3 and Task 7 (seed data) use the `create`/`add` functions; Plan B's Log
  Lift integration uses `getActiveProgramDay`.

- [ ] **Step 1: Write the failing tests**

`src/db/programs.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addProgramDay, addProgramWeek, createProgram, getActiveProgramDay } from './programs'

async function seedTestProgram() {
  const programId = await createProgram('Test Program', '2026-06-29', '2026-07-24')
  await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
  await addProgramWeek(programId, 2, '2026-07-06', '2026-07-10')
  await addProgramDay(programId, 1)
  await addProgramDay(programId, 2)
  await addProgramDay(programId, 4)
  await addProgramDay(programId, 5)
  return programId
}

describe('programs data layer', () => {
  it('resolves the active program/week/day for a Monday in week 1', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-06-29') // Monday
    expect(active?.week.weekNumber).toBe(1)
    expect(active?.day.dayNumber).toBe(1)
  })

  it('resolves Tuesday to day 2', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-06-30') // Tuesday
    expect(active?.day.dayNumber).toBe(2)
  })

  it('resolves Thursday to day 4 and Friday to day 5', async () => {
    await seedTestProgram()
    const thursday = await getActiveProgramDay('2026-07-02')
    const friday = await getActiveProgramDay('2026-07-03')
    expect(thursday?.day.dayNumber).toBe(4)
    expect(friday?.day.dayNumber).toBe(5)
  })

  it('returns null for Wednesday (rest day, no ProgramDay seeded)', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-07-01') // Wednesday
    expect(active).toBeNull()
  })

  it('returns null for a weekend date (outside any week range)', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-07-04') // Saturday
    expect(active).toBeNull()
  })

  it('returns null for a date outside any program', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2025-01-01')
    expect(active).toBeNull()
  })

  it('resolves the correct week when a date falls in week 2', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-07-08') // Wednesday of week 2 -> still rest day
    expect(active).toBeNull()
    const activeThu = await getActiveProgramDay('2026-07-09') // Thursday of week 2
    expect(activeThu?.week.weekNumber).toBe(2)
    expect(activeThu?.day.dayNumber).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/programs.test.ts`
Expected: FAIL — cannot find module `./programs`

- [ ] **Step 3: Write the implementation**

`src/db/programs.ts`:
```ts
import { db } from './schema'
import type { Program, ProgramWeek, ProgramDay } from './schema'

export async function createProgram(
  name: string,
  startDate: string,
  endDate: string
): Promise<number> {
  return db.programs.add({ name, startDate, endDate })
}

export async function addProgramWeek(
  programId: number,
  weekNumber: number,
  startDate: string,
  endDate: string
): Promise<number> {
  return db.programWeeks.add({ programId, weekNumber, startDate, endDate })
}

export async function addProgramDay(
  programId: number,
  dayNumber: number,
  note?: string
): Promise<number> {
  return db.programDays.add({ programId, dayNumber, note })
}

export interface ActiveProgramDay {
  program: Program
  week: ProgramWeek
  day: ProgramDay
}

function localDayOfWeek(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay() // 0=Sun ... 6=Sat
}

export async function getActiveProgramDay(date: string): Promise<ActiveProgramDay | null> {
  const weeks = await db.programWeeks
    .filter((w) => w.startDate <= date && date <= w.endDate)
    .toArray()
  if (weeks.length === 0) return null
  const week = weeks[0]

  const dayOfWeek = localDayOfWeek(date) // Mon=1 ... Fri=5 map directly to dayNumber
  if (dayOfWeek < 1 || dayOfWeek > 5) return null // weekend

  const day = await db.programDays
    .where('programId')
    .equals(week.programId)
    .and((d) => d.dayNumber === dayOfWeek)
    .first()
  if (!day) return null // e.g. Wednesday/dayNumber 3, never seeded (rest day)

  const program = await db.programs.get(week.programId)
  if (!program) return null

  return { program, week, day }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/programs.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/programs.ts src/db/programs.test.ts
git commit -m "Add program/week/day data layer with date resolution"
```

---

### Task 3: ProgramExercise/ProgramPrescription data layer

**Files:**
- Create: `src/db/programExercises.ts`
- Test: `src/db/programExercises.test.ts`

**Interfaces:**
- Consumes: `db`, `ProgramExercise`, `ProgramPrescription`, `MeasureType`,
  `Rir`, `CategoryOption` from `./schema`.
- Produces: `AddProgramExerciseInput` (`{ dayId: number; exerciseId: number;
  blockLabel: string | null; orderIndex: number; measureType: MeasureType;
  eachSide: boolean; tempo: string | null; categoryOptions?: CategoryOption[];
  categoriesToPick?: number }`), `addProgramExercise(input:
  AddProgramExerciseInput): Promise<number>`, `AddPrescriptionInput` (`{
  programExerciseId: number; weekNumber: number; rir: Rir | null;
  warmupTargets: number[]; workingTargets: number[]; isTest: boolean }`),
  `addProgramPrescription(input: AddPrescriptionInput): Promise<number>`,
  `ResolvedSlot` (`{ programExercise: ProgramExercise; exerciseName: string;
  prescription: ProgramPrescription | null }`), `getDaySlots(dayId: number,
  weekNumber: number): Promise<ResolvedSlot[]>` (sorted by `blockLabel` then
  `orderIndex`; `blockLabel` sort order is alphabetical with `null` last).
  Task 7 (seed data) uses `addProgramExercise`/`addProgramPrescription`; Plan
  B's Log Lift and Program tab use `getDaySlots`.

- [ ] **Step 1: Write the failing tests**

`src/db/programExercises.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addProgramExercise, addProgramPrescription, getDaySlots } from './programExercises'

describe('programExercises data layer', () => {
  it('adds a slot and its prescription, then resolves via getDaySlots', async () => {
    const exerciseId = await db.exercises.add({ name: 'Front Squat' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

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

    const slots = await getDaySlots(dayId, 1)
    expect(slots).toHaveLength(1)
    expect(slots[0].exerciseName).toBe('Front Squat')
    expect(slots[0].prescription?.workingTargets).toEqual([3, 3, 3, 5])
  })

  it('sorts slots by blockLabel then orderIndex', async () => {
    const exerciseId1 = await db.exercises.add({ name: 'Ex A1' })
    const exerciseId2 = await db.exercises.add({ name: 'Ex A2' })
    const exerciseId3 = await db.exercises.add({ name: 'Ex B1' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    await addProgramExercise({
      dayId,
      exerciseId: exerciseId3,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseId2,
      blockLabel: 'A',
      orderIndex: 1,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseId1,
      blockLabel: 'A',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots.map((s) => s.exerciseName)).toEqual(['Ex A1', 'Ex A2', 'Ex B1'])
  })

  it('returns prescription: null when no prescription exists for the requested week', async () => {
    const exerciseId = await db.exercises.add({ name: 'Some Exercise' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })
    await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: null,
      orderIndex: 0,
      measureType: 'distance',
      eachSide: false,
      tempo: null,
    })

    const slots = await getDaySlots(dayId, 3)
    expect(slots[0].prescription).toBeNull()
  })

  it('round-trips category_choice fields', async () => {
    const exerciseId = await db.exercises.add({ name: 'Arm Farm' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 5 })

    await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'C',
      orderIndex: 2,
      measureType: 'category_choice',
      eachSide: false,
      tempo: null,
      categoryOptions: [
        { categoryLabel: 'Triceps', exercises: ['Cable Push Downs', 'OH Tricep Ext'] },
        { categoryLabel: 'Biceps', exercises: ['Hammer Curl', 'Zottman Curl'] },
      ],
      categoriesToPick: 3,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots[0].programExercise.categoriesToPick).toBe(3)
    expect(slots[0].programExercise.categoryOptions).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/programExercises.test.ts`
Expected: FAIL — cannot find module `./programExercises`

- [ ] **Step 3: Write the implementation**

`src/db/programExercises.ts`:
```ts
import { db } from './schema'
import type {
  CategoryOption,
  MeasureType,
  ProgramExercise,
  ProgramPrescription,
  Rir,
} from './schema'

export interface AddProgramExerciseInput {
  dayId: number
  exerciseId: number
  blockLabel: string | null
  orderIndex: number
  measureType: MeasureType
  eachSide: boolean
  tempo: string | null
  categoryOptions?: CategoryOption[]
  categoriesToPick?: number
}

export async function addProgramExercise(input: AddProgramExerciseInput): Promise<number> {
  return db.programExercises.add(input)
}

export interface AddPrescriptionInput {
  programExerciseId: number
  weekNumber: number
  rir: Rir | null
  warmupTargets: number[]
  workingTargets: number[]
  isTest: boolean
}

export async function addProgramPrescription(input: AddPrescriptionInput): Promise<number> {
  return db.programPrescriptions.add(input)
}

export interface ResolvedSlot {
  programExercise: ProgramExercise
  exerciseName: string
  prescription: ProgramPrescription | null
}

export async function getDaySlots(dayId: number, weekNumber: number): Promise<ResolvedSlot[]> {
  const slots = await db.programExercises.where('dayId').equals(dayId).toArray()

  const resolved: ResolvedSlot[] = []
  for (const slot of slots) {
    const exercise = await db.exercises.get(slot.exerciseId)
    const prescription = await db.programPrescriptions
      .where('programExerciseId')
      .equals(slot.id!)
      .and((p) => p.weekNumber === weekNumber)
      .first()
    resolved.push({
      programExercise: slot,
      exerciseName: exercise?.name ?? 'Unknown Exercise',
      prescription: prescription ?? null,
    })
  }

  // '￿' sorts after any real block label, so slots with no block
  // (blockLabel: null) always land at the end rather than interleaving
  // alphabetically with real labels like "A"/"B"/"C"/"Speed".
  resolved.sort((a, b) => {
    const blockA = a.programExercise.blockLabel ?? '￿'
    const blockB = b.programExercise.blockLabel ?? '￿'
    if (blockA !== blockB) return blockA.localeCompare(blockB)
    return a.programExercise.orderIndex - b.programExercise.orderIndex
  })

  return resolved
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/programExercises.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/programExercises.ts src/db/programExercises.test.ts
git commit -m "Add program exercise slot and prescription data layer"
```

---

### Task 4: ProgramLogEntry data layer

**Files:**
- Create: `src/db/programLogEntries.ts`
- Test: `src/db/programLogEntries.test.ts`

**Interfaces:**
- Consumes: `db`, `ProgramLogEntry` from `./schema`.
- Produces: `AddProgramLogEntryInput` (`{ programExerciseId: number; date:
  string; weekNumber: number; values: number[]; isWarmup: boolean[];
  chosenCategory?: string; chosenExercise?: string }`), `addProgramLogEntry(
  input: AddProgramLogEntryInput): Promise<number>`, `getProgramLogEntries(
  programExerciseId: number): Promise<ProgramLogEntry[]>` (ascending by
  `date`). Plan B's Log Lift and History screens use both.

- [ ] **Step 1: Write the failing tests**

`src/db/programLogEntries.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { addProgramLogEntry, getProgramLogEntries } from './programLogEntries'

describe('programLogEntries data layer', () => {
  it('adds and retrieves log entries ascending by date', async () => {
    await addProgramLogEntry({
      programExerciseId: 1,
      date: '2026-07-06',
      weekNumber: 2,
      values: [25, 25, 25],
      isWarmup: [false, false, false],
    })
    await addProgramLogEntry({
      programExerciseId: 1,
      date: '2026-06-29',
      weekNumber: 1,
      values: [20, 20, 20],
      isWarmup: [false, false, false],
    })

    const entries = await getProgramLogEntries(1)
    expect(entries.map((e) => e.date)).toEqual(['2026-06-29', '2026-07-06'])
    expect(entries[0].values).toEqual([20, 20, 20])
  })

  it('round-trips category_choice fields', async () => {
    await addProgramLogEntry({
      programExerciseId: 2,
      date: '2026-07-03',
      weekNumber: 1,
      values: [12],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })

    const entries = await getProgramLogEntries(2)
    expect(entries[0].chosenCategory).toBe('Triceps')
    expect(entries[0].chosenExercise).toBe('Cable Push Downs')
  })

  it('only returns entries for the requested programExerciseId', async () => {
    await addProgramLogEntry({
      programExerciseId: 3,
      date: '2026-07-01',
      weekNumber: 1,
      values: [10],
      isWarmup: [false],
    })
    await addProgramLogEntry({
      programExerciseId: 4,
      date: '2026-07-01',
      weekNumber: 1,
      values: [99],
      isWarmup: [false],
    })

    const entries = await getProgramLogEntries(3)
    expect(entries).toHaveLength(1)
    expect(entries[0].values).toEqual([10])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: FAIL — cannot find module `./programLogEntries`

- [ ] **Step 3: Write the implementation**

`src/db/programLogEntries.ts`:
```ts
import { db } from './schema'
import type { ProgramLogEntry } from './schema'

export interface AddProgramLogEntryInput {
  programExerciseId: number
  date: string
  weekNumber: number
  values: number[]
  isWarmup: boolean[]
  chosenCategory?: string
  chosenExercise?: string
}

export async function addProgramLogEntry(input: AddProgramLogEntryInput): Promise<number> {
  return db.programLogEntries.add(input)
}

export async function getProgramLogEntries(programExerciseId: number): Promise<ProgramLogEntry[]> {
  const entries = await db.programLogEntries
    .where('programExerciseId')
    .equals(programExerciseId)
    .toArray()
  entries.sort((a, b) => a.date.localeCompare(b.date))
  return entries
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/programLogEntries.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/programLogEntries.ts src/db/programLogEntries.test.ts
git commit -m "Add program log entry data layer for non-weight slots"
```

---

### Task 5: Extend workouts.ts and exercises.ts

**Files:**
- Modify: `src/db/workouts.ts`, `src/db/workouts.test.ts`
- Modify: `src/db/exercises.ts`, `src/db/exercises.test.ts`

**Interfaces:**
- Modifies existing: `addSet(exerciseEntryId: number, weightLbs: number, reps:
  number, rpe?: number, isWarmup?: boolean): Promise<number>` (new optional
  5th param, defaults to `false`); `getOrCreateExerciseEntry(sessionId:
  number, exerciseId: number, programExerciseId?: number, weekNumber?:
  number): Promise<number>` (new optional 3rd/4th params — only applied when
  a NEW entry is created; an already-existing entry is returned as-is,
  untouched, since an entry is looked up by `sessionId`+`exerciseId` alone).
  `addExercise(name: string, category?: string, description?: string):
  Promise<number>` (new optional 3rd param — only applied when a NEW
  exercise is created, same idempotency rule as before).
- Produces: `workingSetsOnly(sets: SetRecord[]): SetRecord[]` (filters out
  `isWarmup: true` sets — pure function). Plan B's PR detection and 1RM/volume
  chart code calls this before computing anything PR/volume/1RM-related, so
  warmup sets never pollute those calculations.

- [ ] **Step 1: Write the failing tests**

In `src/db/workouts.test.ts`, replace the existing import block:
```ts
import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addExercise } from './exercises'
import {
  addSet,
  flattenHistorySets,
  getExerciseHistory,
  getLastSessionSets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
} from './workouts'
```
with:
```ts
import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addExercise } from './exercises'
import {
  addSet,
  flattenHistorySets,
  getExerciseHistory,
  getLastSessionSets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
  workingSetsOnly,
} from './workouts'
```

Then add these new test cases inside the existing `describe('workouts data
layer', ...)` block (alongside the existing tests, before its closing
`})`), plus a new sibling `describe` block for `workingSetsOnly`:

```ts
it('addSet defaults isWarmup to false when not provided', async () => {
  const exerciseId = await addExercise('Test Isolation Exercise')
  const sessionId = await getOrCreateSessionForDate('2026-07-01')
  const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId)
  const setId = await addSet(entryId, 100, 5)
  const set = await db.sets.get(setId)
  expect(set?.isWarmup).toBe(false)
})

it('addSet stores isWarmup: true when passed', async () => {
  const exerciseId = await addExercise('Test Isolation Exercise 2')
  const sessionId = await getOrCreateSessionForDate('2026-07-01')
  const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId)
  const setId = await addSet(entryId, 45, 5, undefined, true)
  const set = await db.sets.get(setId)
  expect(set?.isWarmup).toBe(true)
})

it('getOrCreateExerciseEntry stores programExerciseId/weekNumber on a new entry', async () => {
  const exerciseId = await addExercise('Test Program Exercise')
  const sessionId = await getOrCreateSessionForDate('2026-07-06')
  const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2)
  const entry = await db.exerciseEntries.get(entryId)
  expect(entry?.programExerciseId).toBe(42)
  expect(entry?.weekNumber).toBe(2)
})

it('getOrCreateExerciseEntry does not overwrite an existing entry\'s program tag', async () => {
  const exerciseId = await addExercise('Test Program Exercise 2')
  const sessionId = await getOrCreateSessionForDate('2026-07-06')
  const entryId1 = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2)
  const entryId2 = await getOrCreateExerciseEntry(sessionId, exerciseId, 99, 3)
  expect(entryId1).toBe(entryId2)
  const entry = await db.exerciseEntries.get(entryId1)
  expect(entry?.programExerciseId).toBe(42) // unchanged from first call
})

describe('workingSetsOnly', () => {
  it('filters out warmup sets', () => {
    const sets = [
      { id: 1, exerciseEntryId: 1, weightLbs: 45, reps: 5, isWarmup: true },
      { id: 2, exerciseEntryId: 1, weightLbs: 135, reps: 5, isWarmup: false },
      { id: 3, exerciseEntryId: 1, weightLbs: 145, reps: 3 }, // undefined isWarmup
    ]
    const result = workingSetsOnly(sets)
    expect(result.map((s) => s.id)).toEqual([2, 3])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/workouts.test.ts`
Expected: FAIL — `addSet`/`getOrCreateExerciseEntry` don't accept the new
params as expected (TypeScript may also fail to compile); `workingSetsOnly`
is not exported.

- [ ] **Step 3: Update workouts.ts**

In `src/db/workouts.ts`, replace `getOrCreateExerciseEntry` and `addSet`, and
add `workingSetsOnly`:

```ts
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
    if (existing) return existing.id!
    return db.exerciseEntries.add({ sessionId, exerciseId, programExerciseId, weekNumber })
  })
}

export async function addSet(
  exerciseEntryId: number,
  weightLbs: number,
  reps: number,
  rpe?: number,
  isWarmup = false
): Promise<number> {
  return db.sets.add({ exerciseEntryId, weightLbs, reps, rpe, isWarmup })
}

export function workingSetsOnly(sets: SetRecord[]): SetRecord[] {
  return sets.filter((s) => !s.isWarmup)
}
```

Note: `getOrCreateExerciseEntry` was already wrapped in a `'rw'` transaction
by an earlier fix — keep that, just add the two new optional parameters to
its signature and the `add(...)` call as shown.

- [ ] **Step 4: Update exercises.ts**

In `src/db/exercises.ts`, update `addExercise`:

```ts
export async function addExercise(
  name: string,
  category?: string,
  description?: string
): Promise<number> {
  const existing = await findExerciseByName(name)
  if (existing) return existing.id!
  return db.exercises.add({ name, category, description })
}
```

Add to `src/db/exercises.test.ts`:
```ts
it('stores a description when provided on creation', async () => {
  const id = await addExercise('Test Front Squat', undefined, 'A barbell squat held in the front rack.')
  const found = await db.exercises.get(id)
  expect(found?.description).toBe('A barbell squat held in the front rack.')
})
```
(Add the `db` import from `./schema` to this test file if not already present.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/db/workouts.test.ts src/db/exercises.test.ts`
Expected: PASS (workouts: 9 tests total; exercises: 4 tests total)

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass, no regressions in Plan B's future consumers (there
are none yet — this just confirms nothing else broke).

- [ ] **Step 7: Commit**

```bash
git add src/db/workouts.ts src/db/workouts.test.ts src/db/exercises.ts src/db/exercises.test.ts
git commit -m "Add warmup flag, program tagging, and exercise descriptions to existing data layer"
```

---

### Task 6: Exercise glossary seed data

**Files:**
- Create: `src/db/exerciseGlossary.ts`
- Test: `src/db/exerciseGlossary.test.ts`

**Interfaces:**
- Consumes: `addExercise` from `./exercises`.
- Produces: `EXERCISE_DESCRIPTIONS: Record<string, string>` (exported for
  Task 7 to reuse the exact same name strings), `seedExerciseGlossary():
  Promise<void>` (idempotent — calls `addExercise(name, undefined,
  description)` for every entry; `addExercise`'s existing case-insensitive
  dedup means re-running this is always safe). Task 7 calls
  `seedExerciseGlossary()` before seeding the program schedule (exercises
  must exist before `ProgramExercise` rows can reference them by id).

- [ ] **Step 1: Write the failing test**

`src/db/exerciseGlossary.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { listExercises } from './exercises'
import { EXERCISE_DESCRIPTIONS, seedExerciseGlossary } from './exerciseGlossary'

describe('exerciseGlossary', () => {
  it('seeds every exercise with its description', async () => {
    await seedExerciseGlossary()
    const all = await listExercises()
    expect(all.length).toBe(Object.keys(EXERCISE_DESCRIPTIONS).length)
    const frontSquat = all.find((e) => e.name === 'Front Squat')
    expect(frontSquat?.description).toContain('front rack')
  })

  it('is idempotent - running twice does not duplicate exercises', async () => {
    await seedExerciseGlossary()
    await seedExerciseGlossary()
    const all = await listExercises()
    expect(all.length).toBe(Object.keys(EXERCISE_DESCRIPTIONS).length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/exerciseGlossary.test.ts`
Expected: FAIL — cannot find module `./exerciseGlossary`

- [ ] **Step 3: Write the implementation**

`src/db/exerciseGlossary.ts`:
```ts
import { addExercise } from './exercises'

export const EXERCISE_DESCRIPTIONS: Record<string, string> = {
  'Depth Drop': 'Step off a box and land on both feet, absorbing the impact and holding the landing position ("sticking it") without any extra movement. Trains reactive strength and landing mechanics.',
  '1 Step Approach Vertical Jump': 'Take one step into a vertical jump, driving the arms up and jumping for maximum height. Trains explosive lower-body power.',
  'Front Squat': 'A barbell squat with the bar racked across the front of the shoulders (front rack position), emphasizing the quads and core while keeping a more upright torso than a back squat.',
  'Hip 90/90': 'A hip mobility drill: sit with both legs bent at 90 degrees (one in front, one to the side), then rotate the hips to switch which leg is in front, keeping the torso upright throughout.',
  'SL RDL': 'Single-Leg Romanian Deadlift. Balance on one leg while hinging at the hip, lowering a weight toward the floor with a flat back, then returning to standing. Trains hamstring/glute strength and single-leg stability.',
  'KB Lateral Deadlift': 'Holding a kettlebell to one side of the body, hinge at the hips to lower and lift the weight in a side-to-side (lateral) pattern, training frontal-plane hip strength.',
  'Hanging Knee Raise': 'Hang from a pull-up bar and raise the knees toward the chest, controlling the descent back down. Trains the lower abs and grip.',
  'HK Sprint': 'High-knee sprint: a short sprint emphasizing high knee drive and fast ground contact, used as a speed/power development drill.',
  'Sled push': 'Push a weighted sled forward over a set distance, driving through the legs. Trains lower-body power and conditioning.',
  'MB OH Soccer Throw': 'Medicine ball overhead soccer throw: bring a medicine ball overhead and throw it forward explosively, similar to a soccer throw-in, training full-body power transfer.',
  'Shuffle Rotational MB Throw': 'A lateral shuffle step into a rotational medicine ball throw, training rotational power generated from the lower body through the core.',
  'Bench Press Variation': 'A pressing movement (barbell, dumbbell, or another bench press variant) performed lying on a bench, training the chest, shoulders, and triceps.',
  'Copenhagen Plank': 'A side plank variation with the top leg supported on a bench and the bottom leg held off the ground, targeting the adductors and core.',
  'NG Chin Up': 'Neutral-grip chin up: performed with palms facing each other on parallel/neutral-grip handles, training the lats and biceps.',
  'Banded Deadbugs': 'Lying on your back with a band held overhead (or looped around the feet), alternately extend the opposite arm and leg while keeping the low back pressed to the floor. Trains anti-extension core control.',
  'Waiter Carry': 'Carry a weight overhead in one hand with the arm fully extended (like a waiter holding a tray), walking for distance while keeping the torso upright. Trains shoulder stability and core.',
  '5-10-5': 'A change-of-direction agility drill: sprint 5 yards to one side, 10 yards back the other way, then 5 yards back to the start, touching the ground/line at each turn.',
  'Triple Broad Jump': 'Three consecutive broad (long) jumps performed back-to-back, absorbing and redirecting momentum between each jump. Trains horizontal power and reactive strength.',
  'Lateral Bounds w/bounce': 'Jump side to side from one leg to the other, adding a small bounce on landing before the next bound. Trains frontal-plane power and stability.',
  'Reverse Lunge': 'Step backward into a lunge position, lowering the back knee toward the floor, then drive back up to standing. Trains single-leg strength.',
  'Hip Airplanes': 'Balance on one leg while hinging forward and rotating the hips open and closed, like an airplane tipping its wings. Trains hip stability and control.',
  'Barbell Hip Thrust': 'With the upper back supported on a bench and a barbell across the hips, drive the hips up into extension. Trains glute strength and hip-extension power.',
  'DB Pull Throughs': 'Using a cable or band between the legs (or a dumbbell), hinge forward and pull the weight through from behind to standing. Trains the hip hinge pattern and glutes.',
  'Back Ext Holds': 'Hold an isometric position at the top of a back extension (hyperextension) bench, training the lower back and glutes statically.',
  'MB Throw for Max Height': 'Throw a medicine ball straight up as high as possible using a full-body jump-and-throw motion. Trains vertical power.',
  'MB Rot. Slam': 'Medicine ball rotational slam: rotate the torso and slam a medicine ball down to one side, training rotational power.',
  '10yd build-up with 20yd sprints': 'A gradual acceleration over 10 yards leading into a maximal 20-yard sprint, training the transition from build-up speed to top speed.',
  'HK Landmine Press': 'Half-kneeling landmine press: press a landmine barbell attachment overhead/forward from a half-kneeling position, training shoulder strength with a stable base.',
  'DB Pullover': 'Lying on a bench, lower a dumbbell behind the head with slightly bent arms, then pull it back over the chest. Trains the lats and chest.',
  'DB Chest Supported Row': 'Lying face-down on an incline bench, row dumbbells up to the sides. Trains the upper back without stressing the lower back.',
  'Bear Crawl Shoulder Taps': 'In a bear-crawl (hovering) position, alternately tap each shoulder with the opposite hand while keeping the hips stable. Trains core anti-rotation.',
  'Arm Farm': 'An accessory-work slot: pick one exercise from each of several categories (shoulders, forearms/grip, triceps, biceps) to round out arm and shoulder health.',
  'Prone YTWs': 'Lying face-down on an incline bench, raise the arms in a Y, then T, then W shape. Trains the rear delts and scapular stabilizers.',
  'DB Reverse Fly': 'Bent over (or lying face-down), raise dumbbells out to the sides with a slight elbow bend. Trains the rear delts and upper back.',
  'DB Ext Rot': 'Dumbbell external rotation: lying on your side with the elbow tucked to the ribs, rotate a light dumbbell upward and outward. Trains the rotator cuff.',
  'Cuban Press': 'A combination movement: upright row into external rotation into overhead press, training shoulder stability through a full range of motion.',
  'Face Pulls': 'Using a cable or band at face height, pull the handle toward your face while flaring the elbows out. Trains the rear delts and upper back.',
  'Wrist Curls': 'Resting the forearm on a bench with the wrist hanging off the edge, curl a weight up using only the wrist. Trains the forearm flexors.',
  'Reverse Wrist Curls': 'Same setup as wrist curls but with palms facing down. Trains the forearm extensors.',
  'Pronations/Supinations': 'Holding a weight (or a hammer-style tool) at one end, rotate the forearm from palm-up to palm-down. Trains forearm rotational strength.',
  'Plate Holds': 'Pinch a weight plate between the fingers and thumb and hold it for time. Trains grip/pinch strength.',
  'Dead Hangs': 'Hang from a pull-up bar with a full grip for time. Trains grip endurance and shoulder mobility.',
  'Farmer Holds': 'Hold a heavy weight in each hand at your sides and stand or walk for time. Trains grip strength and overall trunk stability.',
  'Cable Push Downs': 'Using a cable machine with a bar or rope attachment, extend the elbows to push the attachment down. Trains the triceps.',
  'OH Tricep Ext': 'Overhead tricep extension: holding a weight overhead with both hands, bend the elbows to lower it behind the head, then extend back up. Trains the triceps.',
  'Close Grip Push Up': 'A push-up with the hands placed closer than shoulder-width, emphasizing the triceps.',
  'Zottman Curl': 'Curl a dumbbell up with palms facing up, then rotate the palms down and lower it slowly. Trains both the biceps and forearms.',
  'Hammer Curl': 'Curl a dumbbell with a neutral (palms-facing-each-other) grip, emphasizing the brachialis and forearm.',
  'Reverse Curl': 'Curl a barbell or dumbbells with an overhand (palms-down) grip, emphasizing the forearms and brachialis.',
  'Iso Bicep Hold': 'Hold a dumbbell or barbell at a fixed elbow angle (e.g. 90 degrees) for time. Trains isometric bicep strength.',
}

export async function seedExerciseGlossary(): Promise<void> {
  for (const [name, description] of Object.entries(EXERCISE_DESCRIPTIONS)) {
    await addExercise(name, undefined, description)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/exerciseGlossary.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/db/exerciseGlossary.ts src/db/exerciseGlossary.test.ts
git commit -m "Add exercise glossary with descriptions for the July program"
```

---

### Task 7: July 2026 program schedule seed data + wire to app startup

**Files:**
- Create: `src/db/seedJulyProgram.ts`
- Test: `src/db/seedJulyProgram.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `createProgram`, `addProgramWeek`, `addProgramDay` from
  `./programs`; `addProgramExercise`, `addProgramPrescription` from
  `./programExercises`; `seedExerciseGlossary` from `./exerciseGlossary`;
  `findExerciseByName` from `./exercises`; `db` from `./schema`.
- Produces: `ensureJulyProgramSeeded(): Promise<void>` (idempotent — checks
  whether a `Program` named `'June 29 – July 24, 2026'` already exists;
  no-ops if so). `main.tsx` calls this once before rendering, so it runs
  against the real IndexedDB the first time the app loads in the browser —
  this is how the data actually gets into the user's live app, not just into
  test fixtures.

- [ ] **Step 1: Write the failing test**

`src/db/seedJulyProgram.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { getActiveProgramDay } from './programs'
import { getDaySlots } from './programExercises'
import { ensureJulyProgramSeeded } from './seedJulyProgram'

describe('ensureJulyProgramSeeded', () => {
  it('creates exactly one program, 4 weeks, 4 days, 32 exercise slots, 128 prescriptions', async () => {
    await ensureJulyProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programWeeks.count()).toBe(4)
    expect(await db.programDays.count()).toBe(4)
    expect(await db.programExercises.count()).toBe(32)
    expect(await db.programPrescriptions.count()).toBe(128)
  })

  it('is idempotent - running twice does not duplicate anything', async () => {
    await ensureJulyProgramSeeded()
    await ensureJulyProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(32)
  })

  it('resolves Monday of week 1 (6/29) to Day 1 with Front Squat prescribed correctly', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-06-29')
    expect(active).not.toBeNull()
    expect(active!.week.weekNumber).toBe(1)
    expect(active!.day.dayNumber).toBe(1)

    const slots = await getDaySlots(active!.day.id!, 1)
    const frontSquat = slots.find((s) => s.exerciseName === 'Front Squat')
    expect(frontSquat?.prescription?.rir).toBe('M')
    expect(frontSquat?.prescription?.warmupTargets).toEqual([5, 4])
    expect(frontSquat?.prescription?.workingTargets).toEqual([3, 3, 3, 5])
  })

  it('carries Front Squat into week 3 with the increased working targets', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-13') // Monday, week 3
    const slots = await getDaySlots(active!.day.id!, 3)
    const frontSquat = slots.find((s) => s.exerciseName === 'Front Squat')
    expect(frontSquat?.prescription?.workingTargets).toEqual([4, 4, 4, 5])
  })

  it('marks 1 Step Approach Vertical Jump as a test in week 4', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-20') // Monday, week 4
    const slots = await getDaySlots(active!.day.id!, 4)
    const jump = slots.find((s) => s.exerciseName === '1 Step Approach Vertical Jump')
    expect(jump?.prescription?.isTest).toBe(true)
  })

  it('progresses KB Lateral Deadlift RIR and targets correctly across all 4 weeks', async () => {
    await ensureJulyProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-06-29'))!.day
    const expected: Array<{ week: number; date: string; rir: string; targets: number[] }> = [
      { week: 1, date: '2026-06-29', rir: 'L', targets: [4, 4, 4] },
      { week: 2, date: '2026-07-06', rir: 'L', targets: [5, 5, 5] },
      { week: 3, date: '2026-07-13', rir: 'M', targets: [5, 5, 5] },
      { week: 4, date: '2026-07-20', rir: 'M', targets: [6, 6, 6] },
    ]
    for (const e of expected) {
      const slots = await getDaySlots(day1.id!, e.week)
      const kbLateral = slots.find((s) => s.exerciseName === 'KB Lateral Deadlift')
      expect(kbLateral?.prescription?.rir).toBe(e.rir)
      expect(kbLateral?.prescription?.workingTargets).toEqual(e.targets)
    }
  })

  it('keeps Reverse Lunge fully per-side across all 4 working sets, week 1', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-02') // Thursday, week 1, Day 4
    const slots = await getDaySlots(active!.day.id!, 1)
    const lunge = slots.find((s) => s.exerciseName === 'Reverse Lunge')
    expect(lunge?.programExercise.eachSide).toBe(true)
    expect(lunge?.prescription?.warmupTargets).toEqual([5])
    expect(lunge?.prescription?.workingTargets).toEqual([5, 3, 3, 5])
  })

  it('keeps Copenhagen Plank per-side in week 3 despite the source text dropping "ea"', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-14') // Tuesday, week 3, Day 2
    const slots = await getDaySlots(active!.day.id!, 3)
    const plank = slots.find((s) => s.exerciseName === 'Copenhagen Plank')
    expect(plank?.programExercise.eachSide).toBe(true)
    expect(plank?.prescription?.workingTargets).toEqual([30, 30, 30])
  })

  it('models the Arm Farm slot with 4 categories and categoriesToPick of 3', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-03') // Friday, week 1, Day 5
    const slots = await getDaySlots(active!.day.id!, 1)
    const armFarm = slots.find((s) => s.exerciseName === 'Arm Farm')
    expect(armFarm?.programExercise.categoriesToPick).toBe(3)
    expect(armFarm?.programExercise.categoryOptions).toHaveLength(4)
    const forearms = armFarm?.programExercise.categoryOptions?.find(
      (c) => c.categoryLabel === 'Forearms & Grip'
    )
    expect(forearms?.exercises).toEqual([
      'Wrist Curls',
      'Reverse Wrist Curls',
      'Pronations/Supinations',
      'Plate Holds',
      'Dead Hangs',
      'Farmer Holds',
    ])
  })

  it('sets a Recovery note on every program day', async () => {
    await ensureJulyProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-06-29'))!.day
    expect(day1.note).toBe('Recovery')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/seedJulyProgram.test.ts`
Expected: FAIL — cannot find module `./seedJulyProgram`

- [ ] **Step 3: Write the implementation**

`src/db/seedJulyProgram.ts`:
```ts
import { db } from './schema'
import type { MeasureType, Rir } from './schema'
import { addProgramDay, addProgramWeek, createProgram } from './programs'
import { addProgramExercise, addProgramPrescription } from './programExercises'
import { seedExerciseGlossary } from './exerciseGlossary'
import { findExerciseByName } from './exercises'

const PROGRAM_NAME = 'June 29 – July 24, 2026'

interface WeekTarget {
  week: number
  rir: Rir | null
  warmupTargets?: number[]
  workingTargets: number[]
  isTest?: boolean
}

interface SlotSpec {
  exerciseName: string
  blockLabel: string | null
  measureType: MeasureType
  eachSide: boolean
  tempo: string | null
  weeks: WeekTarget[]
  categoryOptions?: { categoryLabel: string; exercises: string[] }[]
  categoriesToPick?: number
}

const ALL_WEEKS = [1, 2, 3, 4]

function sameEveryWeek(
  rir: Rir | null,
  workingTargets: number[],
  warmupTargets?: number[]
): WeekTarget[] {
  return ALL_WEEKS.map((week) => ({ week, rir, workingTargets, warmupTargets }))
}

const DAY_1_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'Depth Drop',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: [
      { week: 1, rir: null, workingTargets: [3, 3] },
      { week: 2, rir: null, workingTargets: [4, 4] },
      { week: 3, rir: null, workingTargets: [4, 4] },
      { week: 4, rir: null, workingTargets: [3, 3] },
    ],
  },
  {
    exerciseName: '1 Step Approach Vertical Jump',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: [
      { week: 1, rir: null, workingTargets: [2, 2] },
      { week: 2, rir: null, workingTargets: [2, 2, 2] },
      { week: 3, rir: null, workingTargets: [2, 2, 2] },
      { week: 4, rir: null, workingTargets: [], isTest: true },
    ],
  },
  {
    exerciseName: 'Front Squat',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: '4/1/0',
    weeks: [
      { week: 1, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5] },
      { week: 2, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5] },
      { week: 3, rir: 'M', warmupTargets: [5, 4], workingTargets: [4, 4, 4, 5] },
      { week: 4, rir: 'M', warmupTargets: [5, 4], workingTargets: [4, 4, 4, 5] },
    ],
  },
  {
    exerciseName: 'Hip 90/90',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [5, 5, 5]),
  },
  {
    exerciseName: 'SL RDL',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: '3/0/0',
    weeks: sameEveryWeek('M', [4, 4, 4]),
  },
  {
    exerciseName: 'KB Lateral Deadlift',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: '3/0/0',
    weeks: [
      { week: 1, rir: 'L', workingTargets: [4, 4, 4] },
      { week: 2, rir: 'L', workingTargets: [5, 5, 5] },
      { week: 3, rir: 'M', workingTargets: [5, 5, 5] },
      { week: 4, rir: 'M', workingTargets: [6, 6, 6] },
    ],
  },
  {
    exerciseName: 'Hanging Knee Raise',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: '0/0/3',
    weeks: sameEveryWeek(null, [5, 5]),
  },
  {
    exerciseName: 'HK Sprint',
    blockLabel: 'Speed',
    measureType: 'distance',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [10, 10, 10]),
  },
  {
    exerciseName: 'Sled push',
    blockLabel: 'Speed',
    measureType: 'distance',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [10, 10, 10]),
  },
]

const DAY_2_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'MB OH Soccer Throw',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [3, 3]),
  },
  {
    exerciseName: 'Shuffle Rotational MB Throw',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [3, 3, 3]),
  },
  {
    exerciseName: 'Bench Press Variation',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: '4/1/0',
    weeks: [
      { week: 1, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5] },
      { week: 2, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5] },
      { week: 3, rir: 'M', warmupTargets: [5, 4], workingTargets: [4, 4, 4, 5] },
      { week: 4, rir: 'M', warmupTargets: [5, 4], workingTargets: [4, 4, 4, 5] },
    ],
  },
  {
    exerciseName: 'Copenhagen Plank',
    blockLabel: 'B',
    measureType: 'time',
    eachSide: true,
    tempo: null,
    weeks: [
      { week: 1, rir: null, workingTargets: [20, 20, 20] },
      { week: 2, rir: null, workingTargets: [25, 25, 25] },
      { week: 3, rir: null, workingTargets: [30, 30, 30] },
      { week: 4, rir: null, workingTargets: [35, 35, 35] },
    ],
  },
  {
    exerciseName: 'NG Chin Up',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: '0/1/4',
    weeks: sameEveryWeek(null, [4, 4, 4]),
  },
  {
    exerciseName: 'Banded Deadbugs',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: '3/1/0',
    weeks: sameEveryWeek(null, [5, 5, 5]),
  },
  {
    exerciseName: 'Waiter Carry',
    blockLabel: 'C',
    measureType: 'distance',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [20, 20]),
  },
  {
    exerciseName: '5-10-5',
    blockLabel: 'Speed',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [4]),
  },
]

const DAY_4_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'Triple Broad Jump',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: [
      { week: 1, rir: null, workingTargets: [3, 3] },
      { week: 2, rir: null, workingTargets: [3, 3] },
      { week: 3, rir: null, workingTargets: [3, 3, 3] },
      { week: 4, rir: null, workingTargets: [3, 3, 3] },
    ],
  },
  {
    exerciseName: 'Lateral Bounds w/bounce',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [4, 4]),
  },
  {
    exerciseName: 'Reverse Lunge',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: '3/1/0',
    weeks: [
      { week: 1, rir: 'L', warmupTargets: [5], workingTargets: [5, 3, 3, 5] },
      { week: 2, rir: 'L', warmupTargets: [5], workingTargets: [5, 5, 5, 5] },
      { week: 3, rir: 'M', warmupTargets: [5], workingTargets: [5, 3, 3, 5] },
      { week: 4, rir: 'M', warmupTargets: [5], workingTargets: [5, 5, 5, 5] },
    ],
  },
  {
    exerciseName: 'Hip Airplanes',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: [
      { week: 1, rir: null, workingTargets: [5, 5] },
      { week: 2, rir: null, workingTargets: [5, 5, 5] },
      { week: 3, rir: null, workingTargets: [5, 5, 5] },
      { week: 4, rir: null, workingTargets: [5, 5, 5] },
    ],
  },
  {
    exerciseName: 'Barbell Hip Thrust',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: false,
    tempo: '3 sec down',
    weeks: sameEveryWeek('M', [5, 5, 5]),
  },
  {
    exerciseName: 'DB Pull Throughs',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek('M', [5, 5]),
  },
  {
    exerciseName: 'Back Ext Holds',
    blockLabel: 'C',
    measureType: 'time',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [30, 30]),
  },
  {
    exerciseName: '10yd build-up with 20yd sprints',
    blockLabel: 'Speed',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [4]),
  },
]

const ARM_FARM_CATEGORIES = [
  {
    categoryLabel: 'Scap and Shoulders',
    exercises: ['Prone YTWs', 'DB Reverse Fly', 'DB Ext Rot', 'Cuban Press', 'Face Pulls'],
  },
  {
    categoryLabel: 'Forearms & Grip',
    exercises: [
      'Wrist Curls',
      'Reverse Wrist Curls',
      'Pronations/Supinations',
      'Plate Holds',
      'Dead Hangs',
      'Farmer Holds',
    ],
  },
  {
    categoryLabel: 'Triceps',
    exercises: ['Cable Push Downs', 'OH Tricep Ext', 'Close Grip Push Up'],
  },
  {
    categoryLabel: 'Biceps',
    exercises: ['Zottman Curl', 'Hammer Curl', 'Reverse Curl', 'Iso Bicep Hold'],
  },
]

const DAY_5_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'MB Throw for Max Height',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [3, 3]),
  },
  {
    exerciseName: 'MB Rot. Slam',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [4, 4]),
  },
  {
    exerciseName: 'HK Landmine Press',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: '3/0/0',
    weeks: sameEveryWeek('M', [4, 4, 4, 5], [5, 5]),
  },
  {
    exerciseName: 'DB Pullover',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: null,
    weeks: [
      { week: 1, rir: null, workingTargets: [10, 10] },
      { week: 2, rir: null, workingTargets: [8, 8, 8] },
      { week: 3, rir: null, workingTargets: [8, 8, 8] },
      { week: 4, rir: null, workingTargets: [10, 10, 10] },
    ],
  },
  {
    exerciseName: 'DB Chest Supported Row',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: false,
    tempo: '3/0/0',
    weeks: [
      { week: 1, rir: 'M', workingTargets: [5, 5, 5] },
      { week: 2, rir: 'M', workingTargets: [5, 5, 5] },
      { week: 3, rir: 'M', workingTargets: [6, 6, 6] },
      { week: 4, rir: 'M', workingTargets: [6, 6, 6] },
    ],
  },
  {
    exerciseName: 'Bear Crawl Shoulder Taps',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [10, 10]),
  },
  {
    exerciseName: 'Arm Farm',
    blockLabel: 'C',
    measureType: 'category_choice',
    eachSide: false,
    tempo: null,
    categoryOptions: ARM_FARM_CATEGORIES,
    categoriesToPick: 3,
    weeks: sameEveryWeek(null, []),
  },
]

const DAYS: { dayNumber: number; note: string; slots: SlotSpec[] }[] = [
  { dayNumber: 1, note: 'Recovery', slots: DAY_1_SLOTS },
  { dayNumber: 2, note: 'Recovery', slots: DAY_2_SLOTS },
  { dayNumber: 4, note: 'Recovery', slots: DAY_4_SLOTS },
  { dayNumber: 5, note: 'Recovery', slots: DAY_5_SLOTS },
]

const WEEK_DATE_RANGES: Record<number, { startDate: string; endDate: string }> = {
  1: { startDate: '2026-06-29', endDate: '2026-07-03' },
  2: { startDate: '2026-07-06', endDate: '2026-07-10' },
  3: { startDate: '2026-07-13', endDate: '2026-07-17' },
  4: { startDate: '2026-07-20', endDate: '2026-07-24' },
}

export async function ensureJulyProgramSeeded(): Promise<void> {
  const existing = await db.programs.where('name').equals(PROGRAM_NAME).first()
  if (existing) return

  await seedExerciseGlossary()

  const programId = await createProgram(PROGRAM_NAME, '2026-06-29', '2026-07-24')
  for (const weekNumber of ALL_WEEKS) {
    const range = WEEK_DATE_RANGES[weekNumber]
    await addProgramWeek(programId, weekNumber, range.startDate, range.endDate)
  }

  for (const day of DAYS) {
    const dayId = await addProgramDay(programId, day.dayNumber, day.note)
    const blockCounters: Record<string, number> = {}

    for (const slot of day.slots) {
      const blockKey = slot.blockLabel ?? '__none__'
      const currentIndex = blockCounters[blockKey] ?? 0
      blockCounters[blockKey] = currentIndex + 1

      const exercise = await findExerciseByName(slot.exerciseName)
      if (!exercise) {
        throw new Error(
          `Exercise "${slot.exerciseName}" not found — seedExerciseGlossary must run first`
        )
      }

      const programExerciseId = await addProgramExercise({
        dayId,
        exerciseId: exercise.id!,
        blockLabel: slot.blockLabel,
        orderIndex: currentIndex,
        measureType: slot.measureType,
        eachSide: slot.eachSide,
        tempo: slot.tempo,
        categoryOptions: slot.categoryOptions,
        categoriesToPick: slot.categoriesToPick,
      })

      for (const weekTarget of slot.weeks) {
        await addProgramPrescription({
          programExerciseId,
          weekNumber: weekTarget.week,
          rir: weekTarget.rir,
          warmupTargets: weekTarget.warmupTargets ?? [],
          workingTargets: weekTarget.workingTargets,
          isTest: weekTarget.isTest ?? false,
        })
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/seedJulyProgram.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests across all 7 tasks pass with no regressions.

- [ ] **Step 6: Wire seeding into app startup**

`src/main.tsx` currently reads exactly:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Replace it with (calling `ensureJulyProgramSeeded()` before rendering, so
the real app, opened in a real browser, seeds this data into the user's
actual IndexedDB the first time it loads):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureJulyProgramSeeded } from './db/seedJulyProgram'

ensureJulyProgramSeeded().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
```

- [ ] **Step 7: Verify the app builds and the seed runs**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run dev`, open the app in a browser, and open the browser's
DevTools → Application → IndexedDB → `gains-tracker` → `programs` table.
Expected: one row named "June 29 – July 24, 2026". Also spot-check the
`exercises` table has ~50 rows with `description` populated.

- [ ] **Step 8: Commit**

```bash
git add src/db/seedJulyProgram.ts src/db/seedJulyProgram.test.ts src/main.tsx
git commit -m "Seed the real June 29 - July 24, 2026 program and wire to app startup"
```

---

## Post-plan note

This plan deliberately ships no UI — `getActiveProgramDay`, `getDaySlots`,
`getProgramLogEntries`, `workingSetsOnly`, and the seeded real program data
are all in place and unit-tested, ready for Plan B (Log Lift integration, the
Program tab, exercise glossary UI, and History/Progress labels) to build on
top of. After this plan lands, it's worth manually spot-checking a few more
weeks/days of the seeded data against the original coach text before Plan B
begins, since this is real training data the user will follow.
