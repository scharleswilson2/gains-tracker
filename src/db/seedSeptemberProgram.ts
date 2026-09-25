import { db } from './schema'
import type { MeasureType, Rir } from './schema'
import { addProgramDay, addProgramWeek, createProgram } from './programs'
import { addProgramExercise, addProgramPrescription } from './programExercises'
import { findExerciseByName } from './exercises'

const PROGRAM_NAME = 'September 21 – October 17, 2026'

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

// Repeats a single target `count` times — shorthand for the many "3x6",
// "2x8" style prescriptions in this program, where every set shares the
// same target.
function reps(count: number, target: number): number[] {
  return Array.from({ length: count }, () => target)
}

// --- Monday: Lower ---------------------------------------------------

const DAY_1_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'Banded Broad Jump',
    blockLabel: 'Plyos',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 1)),
  },
  {
    exerciseName: 'Split Stance Scoop Toss / Rainbow Slam',
    blockLabel: 'Med Balls',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 6)),
  },
  {
    exerciseName: 'Trap Bar Deadlift',
    blockLabel: 'A',
    measureType: 'weight',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(4, 6)),
  },
  {
    exerciseName: 'Band Assisted Pogo Vert Jump',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 10)),
  },
  {
    exerciseName: 'Pylo Box Jump with Depth Jump',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 4)),
  },
  {
    exerciseName: 'DB Lateral Lunge',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 5)),
  },
  {
    exerciseName: 'Skater Jump with SL Vert Jump',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 4)),
  },
  {
    exerciseName: 'Seated Pistol Squat',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: '3 second eccentric',
    weeks: sameEveryWeek(null, reps(3, 6)),
  },
  {
    exerciseName: 'GHD Back Extension ISO',
    blockLabel: 'C',
    measureType: 'time',
    eachSide: false,
    tempo: 'hold to failure — log actual seconds held',
    weeks: sameEveryWeek(null, reps(2, 20)),
  },
  {
    exerciseName: 'Copenhagen ISO Hold',
    blockLabel: 'C',
    measureType: 'time',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 30)),
  },
]

// --- Tuesday: Upper ----------------------------------------------------

const DAY_2_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'Push Up Drop Catch',
    blockLabel: 'Plyos',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: 'from 6" elevation',
    weeks: sameEveryWeek(null, reps(2, 10)),
  },
  {
    exerciseName: 'OH Crow Hop Throw / Standing Scoop Toss',
    blockLabel: 'Med Balls',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 6)),
  },
  {
    exerciseName: 'DB Bench Incline Press',
    blockLabel: 'A',
    measureType: 'weight',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(4, 5)),
  },
  {
    exerciseName: 'BB Bench Press Drop Catch',
    blockLabel: 'A',
    measureType: 'weight',
    eachSide: false,
    tempo: 'just the bar',
    weeks: sameEveryWeek(null, reps(3, 5)),
  },
  {
    exerciseName: 'SA DB Bent Over Heavy Row',
    blockLabel: 'A',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 8)),
  },
  {
    exerciseName: 'Landmine Rotational Press',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 5)),
  },
  {
    exerciseName: 'Half Kneeling SA Lat Pulldown',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 10)),
  },
  {
    exerciseName: 'Finger Push Ups',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 10)),
  },
  {
    exerciseName: 'Stahl Rotation',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 8)),
  },
  {
    exerciseName: 'Zottman Curl',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: false,
    tempo: 'AMRAP',
    weeks: sameEveryWeek(null, reps(2, 12)),
  },
  {
    exerciseName: 'Pronations/Supinations',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: 'any forearm circuit, AMRAP',
    weeks: sameEveryWeek(null, reps(2, 12)),
  },
]

// --- Wednesday & Saturday: Mobility/Recovery (identical content) -------

const MOBILITY_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'Hip CARS',
    blockLabel: 'Hips',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Hip Airplanes',
    blockLabel: 'Hips',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Pigeon Stretch on Incline Bench',
    blockLabel: 'Hips',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: '90/90 Hip Flips',
    blockLabel: 'Hips',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Cat Cow',
    blockLabel: 'T-Spine',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Back Bridge',
    blockLabel: 'T-Spine',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: "Spinal CAR's",
    blockLabel: 'T-Spine',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: "Shoulder CAR's",
    blockLabel: 'Shoulder',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Prone Swimmers',
    blockLabel: 'Shoulder',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Wall Slides',
    blockLabel: 'Scap',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Serratus Wall Slides',
    blockLabel: 'Scap',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
  {
    exerciseName: 'Scap Push Ups',
    blockLabel: 'Scap',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, [1]),
  },
]

// --- Thursday: Lower -----------------------------------------------------

const DAY_4_SLOTS: SlotSpec[] = [
  {
    exerciseName: 'Banded Lateral Jump / Triple Broad Jump',
    blockLabel: 'Plyos',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 1)),
  },
  {
    exerciseName: 'Hop Back Scoop Toss / Split Stance Rainbow Slam',
    blockLabel: 'Med Balls',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 4)),
  },
  {
    exerciseName: 'B Stance Belt Squat',
    blockLabel: 'A',
    measureType: 'weight',
    eachSide: true,
    tempo: '5 second eccentric; 10 second iso hold at 90° on the last rep',
    weeks: sameEveryWeek(null, reps(3, 6)),
  },
  {
    exerciseName: 'Band-resisted Alternating Split Squat Jumps',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 5)),
  },
  {
    exerciseName: 'Front Foot Elevated Reverse Lunge',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 5)),
  },
  {
    exerciseName: 'SL RDL',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: true,
    tempo: '3 second eccentric',
    weeks: sameEveryWeek(null, reps(3, 6)),
  },
  {
    exerciseName: 'Skater Jump with SL Vert Jump',
    blockLabel: 'B',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 4)),
  },
  {
    exerciseName: 'Weighted Planks',
    blockLabel: 'C',
    measureType: 'time',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 30)),
  },
  {
    exerciseName: 'Stahl Rotation',
    blockLabel: 'C',
    measureType: 'weight',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 8)),
  },
  {
    exerciseName: 'Banded Clam Shells',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 8)),
  },
]

// --- Friday: Upper ---------------------------------------------------

const ARM_FARM_CATEGORIES = [
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
    exerciseName: 'Partner Med Ball Supine Chest Pass Explosive',
    blockLabel: 'Plyos',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 8)),
  },
  {
    exerciseName: 'Overhead Slam / Quick Turn Rotational Med Ball Throw',
    blockLabel: 'Med Balls',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 6)),
  },
  {
    exerciseName: 'Hex Bar Bench Press',
    blockLabel: 'A',
    measureType: 'weight',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 6)),
  },
  {
    exerciseName: 'Rapid Plyo Push',
    blockLabel: 'A',
    measureType: 'bodyweight_reps',
    eachSide: false,
    tempo: 'as fast as possible, 6-12" push-up',
    weeks: sameEveryWeek(null, reps(3, 10)),
  },
  {
    exerciseName: 'Weighted Neutral Grip Chin Up',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(3, 5)),
  },
  {
    exerciseName: 'Incline Chest Supported Row',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: '3 second eccentric',
    weeks: sameEveryWeek(null, reps(3, 6)),
  },
  {
    exerciseName: 'Cable Face Pull',
    blockLabel: 'B',
    measureType: 'weight',
    eachSide: false,
    tempo: '8-12 rep range',
    weeks: sameEveryWeek(null, reps(3, 10)),
  },
  {
    exerciseName: 'DEEP Push Up ISO',
    blockLabel: 'C',
    measureType: 'time',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 90)),
  },
  {
    exerciseName: 'Incline Prone I,Y,T',
    blockLabel: 'C',
    measureType: 'bodyweight_reps',
    eachSide: true,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 8)),
  },
  {
    exerciseName: 'Body Saw on Sliders',
    blockLabel: 'C',
    measureType: 'time',
    eachSide: false,
    tempo: null,
    weeks: sameEveryWeek(null, reps(2, 60)),
  },
  {
    exerciseName: 'Arm Farm',
    blockLabel: 'C',
    measureType: 'category_choice',
    eachSide: false,
    tempo: '2-3 sets, bi/tricep/forearms focus',
    categoryOptions: ARM_FARM_CATEGORIES,
    categoriesToPick: 3,
    weeks: sameEveryWeek(null, []),
  },
]

const DAYS: { dayNumber: number; note: string; slots: SlotSpec[] }[] = [
  { dayNumber: 1, note: 'Lower — Rate of Force Development', slots: DAY_1_SLOTS },
  { dayNumber: 2, note: 'Upper — Rate of Force Development', slots: DAY_2_SLOTS },
  { dayNumber: 3, note: 'Mobility/Movement — Recovery', slots: MOBILITY_SLOTS },
  { dayNumber: 4, note: 'Lower — Rate of Force Development', slots: DAY_4_SLOTS },
  { dayNumber: 5, note: 'Upper — Rate of Force Development', slots: DAY_5_SLOTS },
  { dayNumber: 6, note: 'Mobility/Movement — Recovery', slots: MOBILITY_SLOTS },
]

// Explicit display order for each block, matching the source spreadsheet's
// top-to-bottom layout — Plyos and Med Balls (the warmup blocks) come before
// the lettered strength blocks, which alphabetical order alone gets
// backwards. The mobility days' blocks get their own order for the same
// reason (Hips, T-Spine, Shoulder, Scap — not alphabetical).
const BLOCK_ORDER: Record<string, number> = {
  Plyos: 0,
  'Med Balls': 1,
  A: 2,
  B: 3,
  C: 4,
  Hips: 0,
  'T-Spine': 1,
  Shoulder: 2,
  Scap: 3,
}

const WEEK_DATE_RANGES: Record<number, { startDate: string; endDate: string }> = {
  1: { startDate: '2026-09-21', endDate: '2026-09-26' },
  2: { startDate: '2026-09-28', endDate: '2026-10-03' },
  3: { startDate: '2026-10-05', endDate: '2026-10-10' },
  4: { startDate: '2026-10-12', endDate: '2026-10-17' },
}

export async function ensureSeptemberProgramSeeded(): Promise<void> {
  const existing = await db.programs.where('name').equals(PROGRAM_NAME).first()
  if (existing) return

  await db.transaction(
    'rw',
    [db.programs, db.programWeeks, db.programDays, db.programExercises, db.programPrescriptions, db.exercises],
    async () => {
      const programId = await createProgram(PROGRAM_NAME, '2026-09-21', '2026-10-17')
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
            blockOrder: slot.blockLabel ? BLOCK_ORDER[slot.blockLabel] : undefined,
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
