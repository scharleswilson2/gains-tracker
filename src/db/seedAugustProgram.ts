import { db } from './schema'
import type { MeasureType, Rir } from './schema'
import { addProgramDay, addProgramWeek, createProgram } from './programs'
import { addProgramExercise, addProgramPrescription } from './programExercises'
import { findExerciseByName } from './exercises'

const PROGRAM_NAME = 'July 27 – August 21, 2026'

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
    exerciseName: 'Depth Drop w/ Rebound Jump',
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
    exerciseName: 'Hands on Hips Vertical Jump',
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
    tempo: '3 second hold at bottom',
    weeks: [
      { week: 1, rir: 'M', workingTargets: [3, 3, 3, 3, 5] },
      { week: 2, rir: 'M', workingTargets: [3, 3, 3, 3, 5] },
      { week: 3, rir: 'M', workingTargets: [3, 3, 3, 3, 3, 5] },
      { week: 4, rir: 'M', workingTargets: [3, 3, 3, 3, 3, 5] },
    ],
  },
  {
    exerciseName: 'Hip CARS',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [5, 5, 5]),
  },
  {
    exerciseName: 'SL RDL',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: '3 count at the bottom',
    weeks: [
      { week: 1, rir: 'L', workingTargets: [3, 3, 3] },
      { week: 2, rir: 'L', workingTargets: [3, 3, 3] },
      { week: 3, rir: 'M', workingTargets: [4, 4, 4] },
      { week: 4, rir: 'M', workingTargets: [4, 4, 4] },
    ],
  },
  {
    exerciseName: 'KB Lateral Deadlift',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: '3 count at the bottom',
    weeks: [
      { week: 1, rir: 'L', workingTargets: [3, 3, 3] },
      { week: 2, rir: 'L', workingTargets: [3, 3, 3] },
      { week: 3, rir: 'M', workingTargets: [4, 4, 4] },
      { week: 4, rir: 'M', workingTargets: [4, 4, 4] },
    ],
  },
  {
    exerciseName: 'Hanging Knee Raise',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: '3 count at the top',
    weeks: sameEveryWeek(null, [5, 5, 5]),
  },
  {
    exerciseName: 'Lateral HK Sprints',
    blockLabel: 'Speed',
    measureType: 'distance',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [10, 10, 10]),
  },
  {
    exerciseName: 'Sled push march',
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
    exerciseName: 'Step Back Rotational MB Throw',
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
    tempo: '3 count at the bottom',
    weeks: [
      { week: 1, rir: 'M', workingTargets: [4, 4, 3, 3, 5] },
      { week: 2, rir: 'M', workingTargets: [4, 4, 3, 3, 5] },
      { week: 3, rir: 'M', workingTargets: [5, 5, 3, 3, 3, 5] },
      { week: 4, rir: 'M', workingTargets: [5, 5, 3, 3, 3, 5] },
    ],
  },
  {
    exerciseName: 'Side Plank w/ Abduction',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [8, 8, 8]),
  },
  {
    exerciseName: 'NG Chin Up',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: '3 count at the top',
    weeks: sameEveryWeek(null, [4, 4, 4]),
  },
  {
    exerciseName: 'Banded Deadbugs',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: '5 count at the bottom',
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
    tempo: '3 count at the bottom',
    weeks: [
      { week: 1, rir: 'M', workingTargets: [3, 3, 3, 3, 5] },
      { week: 2, rir: 'M', workingTargets: [3, 3, 3, 3, 5] },
      { week: 3, rir: 'M', workingTargets: [3, 3, 3, 3, 3, 5] },
      { week: 4, rir: 'M', workingTargets: [3, 3, 3, 3, 3, 5] },
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
    tempo: '3 count at the top',
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
    weeks: sameEveryWeek(null, [10, 10]),
  },
  {
    exerciseName: '20 yard flys',
    blockLabel: 'Speed',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [5]),
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
    exerciseName: 'MB Chest Pass',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [5, 5]),
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
    tempo: null,
    weeks: [
      { week: 1, rir: 'M', workingTargets: [4, 4, 3, 3, 5] },
      { week: 2, rir: 'M', workingTargets: [4, 4, 3, 3, 5] },
      { week: 3, rir: 'M', workingTargets: [5, 5, 3, 3, 3, 5] },
      { week: 4, rir: 'M', workingTargets: [5, 5, 3, 3, 3, 5] },
    ],
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
    tempo: '3 count at the top',
    weeks: [
      { week: 1, rir: 'M', workingTargets: [5, 5, 5] },
      { week: 2, rir: 'M', workingTargets: [5, 5, 5] },
      { week: 3, rir: 'M', workingTargets: [6, 6, 6] },
      { week: 4, rir: 'M', workingTargets: [6, 6, 6] },
    ],
  },
  {
    exerciseName: 'Bear Crawl Forward Walk',
    blockLabel: 'C',
    measureType: 'distance',
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
  1: { startDate: '2026-07-27', endDate: '2026-07-31' },
  2: { startDate: '2026-08-03', endDate: '2026-08-07' },
  3: { startDate: '2026-08-10', endDate: '2026-08-14' },
  4: { startDate: '2026-08-17', endDate: '2026-08-21' },
}

export async function ensureAugustProgramSeeded(): Promise<void> {
  const existing = await db.programs.where('name').equals(PROGRAM_NAME).first()
  if (existing) return

  await db.transaction(
    'rw',
    [db.programs, db.programWeeks, db.programDays, db.programExercises, db.programPrescriptions, db.exercises],
    async () => {
      const programId = await createProgram(PROGRAM_NAME, '2026-07-27', '2026-08-21')
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
  )
}
