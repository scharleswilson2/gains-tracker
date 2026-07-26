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

/**
 * Appends a single value to the (programExerciseId, date) entry that has no
 * `chosenCategory`, creating that entry if it does not exist yet.
 *
 * The read-modify-write happens inside one readwrite transaction, so two
 * back-to-back calls can never both compute their "next" array from the same
 * stale base: IndexedDB serializes readwrite transactions against the same
 * object store, so the second call's read only starts after the first call's
 * write has committed. Callers therefore do not need their own guard against
 * a rapid double-tap losing a value.
 */
export async function appendProgramLogValue(
  programExerciseId: number,
  date: string,
  weekNumber: number,
  value: number
): Promise<number> {
  return db.transaction('rw', db.programLogEntries, async () => {
    const existing = await db.programLogEntries
      .where('programExerciseId')
      .equals(programExerciseId)
      .and((e) => e.date === date && (e.chosenCategory ?? null) === null)
      .first()
    if (existing) {
      await db.programLogEntries.update(existing.id!, {
        weekNumber,
        values: [...existing.values, value],
        isWarmup: [...existing.isWarmup, false],
      })
      return existing.id!
    }
    return db.programLogEntries.add({
      programExerciseId,
      date,
      weekNumber,
      values: [value],
      isWarmup: [false],
    })
  })
}

export interface LogCategoryChoiceInput {
  programExerciseId: number
  date: string
  weekNumber: number
  value: number
  chosenCategory: string
  chosenExercise: string
  categoriesToPick: number
}

export type LogCategoryChoiceResult =
  | { ok: true; id: number }
  | { ok: false; capReached: true }

/**
 * Logs one category_choice pick, enforcing the slot's `categoriesToPick` cap
 * atomically rather than relying on a (possibly stale) UI `disabled` state.
 *
 * Re-logging a category that already has an entry for this slot+date always
 * succeeds and updates that entry in place. A brand-new category is rejected
 * without writing anything once the number of distinct categories already
 * logged today has reached the cap.
 */
export async function logCategoryChoice(
  input: LogCategoryChoiceInput
): Promise<LogCategoryChoiceResult> {
  return db.transaction('rw', db.programLogEntries, async () => {
    const todaysEntries = await db.programLogEntries
      .where('programExerciseId')
      .equals(input.programExerciseId)
      .and((e) => e.date === input.date)
      .toArray()

    const existing = todaysEntries.find((e) => e.chosenCategory === input.chosenCategory)
    if (existing) {
      await db.programLogEntries.update(existing.id!, {
        weekNumber: input.weekNumber,
        values: [input.value],
        isWarmup: [false],
        chosenExercise: input.chosenExercise,
      })
      return { ok: true, id: existing.id! }
    }

    const distinctCategories = new Set(
      todaysEntries.map((e) => e.chosenCategory).filter((c): c is string => c !== undefined)
    )
    if (distinctCategories.size >= input.categoriesToPick) {
      return { ok: false, capReached: true }
    }

    const id = await db.programLogEntries.add({
      programExerciseId: input.programExerciseId,
      date: input.date,
      weekNumber: input.weekNumber,
      values: [input.value],
      isWarmup: [false],
      chosenCategory: input.chosenCategory,
      chosenExercise: input.chosenExercise,
    })
    return { ok: true, id }
  })
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

async function lastValueForMatchingEntry(
  programExerciseId: number,
  weekNumber: number,
  matchesCategory: (chosenCategory: string | undefined) => boolean
): Promise<number | undefined> {
  const entry = await db.programLogEntries
    .where('programExerciseId')
    .equals(programExerciseId)
    .and((e) => e.weekNumber === weekNumber && matchesCategory(e.chosenCategory))
    .first()
  if (!entry || entry.values.length === 0) return undefined
  return entry.values[entry.values.length - 1]
}

export async function getLastWeekSimpleValue(
  programExerciseId: number,
  weekNumber: number
): Promise<number | undefined> {
  return lastValueForMatchingEntry(programExerciseId, weekNumber, (c) => c === undefined)
}

export async function getLastWeekCategoryValue(
  programExerciseId: number,
  weekNumber: number,
  category: string
): Promise<number | undefined> {
  return lastValueForMatchingEntry(programExerciseId, weekNumber, (c) => c === category)
}
