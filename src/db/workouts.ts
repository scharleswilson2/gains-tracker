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
    if (existing) {
      if (existing.programExerciseId === undefined && programExerciseId !== undefined) {
        await db.exerciseEntries.update(existing.id!, { programExerciseId, weekNumber })
      }
      return existing.id!
    }
    return db.exerciseEntries.add({ sessionId, exerciseId, programExerciseId, weekNumber })
  })
}

export async function addSet(
  exerciseEntryId: number,
  weightLbs: number,
  reps: number,
  isWarmup = false
): Promise<number> {
  return db.sets.add({ exerciseEntryId, weightLbs, reps, isWarmup })
}

export function workingSetsOnly(sets: SetRecord[]): SetRecord[] {
  return sets.filter((s) => !s.isWarmup)
}

export interface ExerciseHistoryEntry {
  date: string
  sets: SetRecord[]
  weekNumber?: number
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
    results.push({ date: session.date, sets, weekNumber: entry.weekNumber })
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

export async function getWorkingSetHistory(exerciseId: number): Promise<ExerciseHistoryEntry[]> {
  const history = await getExerciseHistory(exerciseId)
  return history
    .map((h) => ({ ...h, sets: workingSetsOnly(h.sets) }))
    .filter((h) => h.sets.length > 0)
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

export async function getLastWeekWeightResult(
  exerciseId: number,
  programExerciseId: number,
  weekNumber: number
): Promise<SetRecord | null> {
  const entries = await db.exerciseEntries
    .where('exerciseId')
    .equals(exerciseId)
    .and((e) => e.programExerciseId === programExerciseId && e.weekNumber === weekNumber)
    .toArray()
  if (entries.length === 0) return null

  const sets: SetRecord[] = []
  for (const entry of entries) {
    const entrySets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
    sets.push(...workingSetsOnly(entrySets))
  }
  if (sets.length === 0) return null

  // The heaviest set (tie-broken by more reps at the same weight), not the
  // chronologically last one — a session's working sets are usually logged
  // in ascending order (e.g. targets [3,3,3,5], same weight throughout,
  // more reps on the final set), so "heaviest, most reps at that weight"
  // reliably picks out the set that actually represents the week's effort,
  // regardless of what order sets were entered in.
  return sets.reduce((best, s) =>
    s.weightLbs > best.weightLbs || (s.weightLbs === best.weightLbs && s.reps > best.reps) ? s : best
  )
}

export async function getWorkingSetCountForSlotWeek(
  exerciseId: number,
  programExerciseId: number,
  weekNumber: number
): Promise<number> {
  const entries = await db.exerciseEntries
    .where('exerciseId')
    .equals(exerciseId)
    .and((e) => e.programExerciseId === programExerciseId && e.weekNumber === weekNumber)
    .toArray()
  let count = 0
  for (const entry of entries) {
    const entrySets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
    count += workingSetsOnly(entrySets).length
  }
  return count
}

export interface SetsForDate {
  warmup: SetRecord[]
  working: SetRecord[]
}

/**
 * Sets logged for one exercise on one date, split by `isWarmup`, in
 * insertion order — row *i* of the fixed-row set-entry UI maps to element
 * *i* of the matching list. Relies on the same ascending-`id`-equals-
 * insertion-order assumption `flattenHistorySets` already depends on.
 *
 * When `programExerciseId` is given, entries tagged with a *different*
 * slot (or left untagged so far) are treated as having nothing logged —
 * a free-form log of the same exercise on the same day shares the
 * underlying entry (`getOrCreateExerciseEntry` matches on session+exercise
 * only), so without this an ad-hoc set could silently fill a prescribed
 * row. Passing no `programExerciseId` (or `undefined`) skips this check
 * entirely and returns everything on the entry, tagged or not.
 *
 * This is entry-level, not set-level, scoping, and it only ever suppresses
 * — it never separates sets that already share one tagged entry. Concretely:
 * if a free-form log happens *before* this slot has logged anything, its
 * read of `programExerciseId` sees nothing (correct, but only until the
 * slot's own first log backfills the tag onto that same entry — the
 * backfill in `getOrCreateExerciseEntry` never retags an already-tagged
 * entry, but does adopt an untagged one). Once the entry is tagged to this
 * slot — by that backfill, or because the slot logged first, which is the
 * more common ordering since prescribed rows render above the free-form
 * section — every set already on the entry, including an earlier or later
 * free-form one, is indistinguishable from the slot's own and shows up in
 * its rows. Only per-set attribution (`programExerciseId` on `SetRecord`
 * itself, not just on the entry) would close that — out of scope here; see
 * `workouts.test.ts`'s "KNOWN LIMITATION" test for the exact behavior this
 * leaves in place.
 */
export async function getSetsForExerciseOnDate(
  exerciseId: number,
  date: string,
  programExerciseId?: number
): Promise<SetsForDate> {
  const session = await db.workoutSessions.where('date').equals(date).first()
  if (!session) return { warmup: [], working: [] }

  const entry = await db.exerciseEntries
    .where('sessionId')
    .equals(session.id!)
    .and((e) => e.exerciseId === exerciseId)
    .first()
  if (!entry) return { warmup: [], working: [] }
  if (programExerciseId !== undefined && entry.programExerciseId !== programExerciseId) {
    return { warmup: [], working: [] }
  }

  const sets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
  return {
    warmup: sets.filter((s) => s.isWarmup === true),
    working: sets.filter((s) => s.isWarmup !== true),
  }
}

export async function updateSet(
  setId: number,
  changes: { weightLbs: number; reps: number }
): Promise<void> {
  await db.sets.update(setId, changes)
}
