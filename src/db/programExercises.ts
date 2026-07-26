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
