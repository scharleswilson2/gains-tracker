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

export async function getProgramLogEntriesForDate(
  programExerciseId: number,
  date: string
): Promise<ProgramLogEntry[]> {
  return db.programLogEntries
    .where('programExerciseId')
    .equals(programExerciseId)
    .and((e) => e.date === date)
    .toArray()
}

export async function upsertProgramLogEntry(input: AddProgramLogEntryInput): Promise<number> {
  return db.transaction('rw', db.programLogEntries, async () => {
    const existing = await db.programLogEntries
      .where('programExerciseId')
      .equals(input.programExerciseId)
      .and(
        (e) =>
          e.date === input.date &&
          (e.chosenCategory ?? null) === (input.chosenCategory ?? null)
      )
      .first()
    if (existing) {
      await db.programLogEntries.update(existing.id!, input as Partial<ProgramLogEntry>)
      return existing.id!
    }
    return db.programLogEntries.add(input)
  })
}
