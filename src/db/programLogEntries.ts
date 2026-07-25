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
