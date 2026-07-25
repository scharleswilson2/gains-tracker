import { db } from './schema'
import type { SetRecord } from './schema'

export async function getOrCreateSessionForDate(date: string): Promise<number> {
  return db.transaction('rw', db.workoutSessions, async () => {
    const existing = await db.workoutSessions.where('date').equals(date).first()
    if (existing) return existing.id!
    return db.workoutSessions.add({ date })
  })
}

export async function getOrCreateExerciseEntry(
  sessionId: number,
  exerciseId: number
): Promise<number> {
  return db.transaction('rw', db.exerciseEntries, async () => {
    const existing = await db.exerciseEntries
      .where('sessionId')
      .equals(sessionId)
      .and((e) => e.exerciseId === exerciseId)
      .first()
    if (existing) return existing.id!
    return db.exerciseEntries.add({ sessionId, exerciseId })
  })
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

/**
 * Flattens exercise history entries (assumed to already be in ascending date
 * order, as returned by `getExerciseHistory`) into a single chronological
 * list of sets. Shared by LogLift (to determine PR status for a new set not
 * yet persisted — everything already in history logically happened
 * "before" it, including earlier sets logged today) and Progress (to
 * retroactively determine PR status for each historical set against
 * everything logged earlier, one entry-slice at a time).
 */
export function flattenHistorySets(history: ExerciseHistoryEntry[]): SetRecord[] {
  return history.flatMap((h) => h.sets)
}
