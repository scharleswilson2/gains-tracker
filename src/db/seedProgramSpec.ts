import { db } from './schema'
import type { MeasureType, Rir } from './schema'
import { addProgramDay, addProgramWeek, createProgram } from './programs'
import { addProgramExercise, addProgramPrescription } from './programExercises'
import { findExerciseByName } from './exercises'

export interface WeekTarget {
  week: number
  rir: Rir | null
  warmupTargets?: number[]
  workingTargets: number[]
  isTest?: boolean
}

export interface SlotSpec {
  exerciseName: string
  blockLabel: string | null
  measureType: MeasureType
  eachSide: boolean
  tempo: string | null
  weeks: WeekTarget[]
  categoryOptions?: { categoryLabel: string; exercises: string[] }[]
  categoriesToPick?: number
}

export interface DaySpec {
  dayNumber: number
  note: string
  slots: SlotSpec[]
}

export interface ProgramSpec {
  name: string
  startDate: string
  endDate: string
  weekRanges: Record<number, { startDate: string; endDate: string }>
  days: DaySpec[]
}

export const ALL_WEEKS = [1, 2, 3, 4]

export function sameEveryWeek(
  rir: Rir | null,
  workingTargets: number[],
  warmupTargets?: number[]
): WeekTarget[] {
  return ALL_WEEKS.map((week) => ({ week, rir, workingTargets, warmupTargets }))
}

// Repeats a single target `count` times — shorthand for the many "3x6",
// "2x8" style prescriptions, where every set shares the same target.
export function reps(count: number, target: number): number[] {
  return Array.from({ length: count }, () => target)
}

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

export async function seedProgramFromSpec(spec: ProgramSpec): Promise<void> {
  const existing = await db.programs.where('name').equals(spec.name).first()
  if (existing) return

  await db.transaction(
    'rw',
    [db.programs, db.programWeeks, db.programDays, db.programExercises, db.programPrescriptions, db.exercises],
    async () => {
      const programId = await createProgram(spec.name, spec.startDate, spec.endDate)
      for (const weekNumber of ALL_WEEKS) {
        const range = spec.weekRanges[weekNumber]
        await addProgramWeek(programId, weekNumber, range.startDate, range.endDate)
      }

      for (const day of spec.days) {
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
