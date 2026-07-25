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
