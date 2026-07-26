import { describe, it, expect } from 'vitest'
import {
  addProgramLogEntry,
  appendProgramLogValue,
  getProgramLogEntries,
  getProgramLogEntriesForDate,
  logCategoryChoice,
  upsertProgramLogEntry,
} from './programLogEntries'

describe('programLogEntries data layer', () => {
  it('adds and retrieves log entries ascending by date', async () => {
    await addProgramLogEntry({
      programExerciseId: 1,
      date: '2026-07-06',
      weekNumber: 2,
      values: [25, 25, 25],
      isWarmup: [false, false, false],
    })
    await addProgramLogEntry({
      programExerciseId: 1,
      date: '2026-06-29',
      weekNumber: 1,
      values: [20, 20, 20],
      isWarmup: [false, false, false],
    })

    const entries = await getProgramLogEntries(1)
    expect(entries.map((e) => e.date)).toEqual(['2026-06-29', '2026-07-06'])
    expect(entries[0].values).toEqual([20, 20, 20])
  })

  it('round-trips category_choice fields', async () => {
    await addProgramLogEntry({
      programExerciseId: 2,
      date: '2026-07-03',
      weekNumber: 1,
      values: [12],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })

    const entries = await getProgramLogEntries(2)
    expect(entries[0].chosenCategory).toBe('Triceps')
    expect(entries[0].chosenExercise).toBe('Cable Push Downs')
  })

  it('only returns entries for the requested programExerciseId', async () => {
    await addProgramLogEntry({
      programExerciseId: 3,
      date: '2026-07-01',
      weekNumber: 1,
      values: [10],
      isWarmup: [false],
    })
    await addProgramLogEntry({
      programExerciseId: 4,
      date: '2026-07-01',
      weekNumber: 1,
      values: [99],
      isWarmup: [false],
    })

    const entries = await getProgramLogEntries(3)
    expect(entries).toHaveLength(1)
    expect(entries[0].values).toEqual([10])
  })
})

describe('upsertProgramLogEntry / getProgramLogEntriesForDate', () => {
  it('inserts a new entry when none exists for the slot+date+category', async () => {
    const id = await upsertProgramLogEntry({
      programExerciseId: 10,
      date: '2026-07-03',
      weekNumber: 1,
      values: [12],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })
    const entries = await getProgramLogEntriesForDate(10, '2026-07-03')
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe(id)
  })

  it('updates the existing entry in place when the same slot+date+category is re-submitted', async () => {
    const id1 = await upsertProgramLogEntry({
      programExerciseId: 11,
      date: '2026-07-03',
      weekNumber: 1,
      values: [10],
      isWarmup: [false],
    })
    const id2 = await upsertProgramLogEntry({
      programExerciseId: 11,
      date: '2026-07-03',
      weekNumber: 1,
      values: [15],
      isWarmup: [false],
    })
    expect(id1).toBe(id2)
    const entries = await getProgramLogEntriesForDate(11, '2026-07-03')
    expect(entries).toHaveLength(1)
    expect(entries[0].values).toEqual([15])
  })

  it('treats a different category on the same slot+date as a separate entry', async () => {
    await upsertProgramLogEntry({
      programExerciseId: 12,
      date: '2026-07-03',
      weekNumber: 1,
      values: [8],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })
    await upsertProgramLogEntry({
      programExerciseId: 12,
      date: '2026-07-03',
      weekNumber: 1,
      values: [10],
      isWarmup: [false],
      chosenCategory: 'Biceps',
      chosenExercise: 'Hammer Curl',
    })
    const entries = await getProgramLogEntriesForDate(12, '2026-07-03')
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.chosenCategory).sort()).toEqual(['Biceps', 'Triceps'])
  })
})

describe('appendProgramLogValue', () => {
  it('creates a one-value entry when the slot+date has nothing logged yet', async () => {
    const id = await appendProgramLogValue(20, '2026-07-06', 2, 3)

    const entries = await getProgramLogEntriesForDate(20, '2026-07-06')
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe(id)
    expect(entries[0].values).toEqual([3])
    expect(entries[0].isWarmup).toEqual([false])
    expect(entries[0].weekNumber).toBe(2)
  })

  it('appends to the existing entry rather than creating a duplicate row', async () => {
    const id1 = await appendProgramLogValue(21, '2026-07-06', 2, 3)
    const id2 = await appendProgramLogValue(21, '2026-07-06', 2, 5)

    expect(id2).toBe(id1)
    const entries = await getProgramLogEntriesForDate(21, '2026-07-06')
    expect(entries).toHaveLength(1)
    expect(entries[0].values).toEqual([3, 5])
    expect(entries[0].isWarmup).toEqual([false, false])
  })

  it('does not lose a value when two appends are fired back-to-back', async () => {
    await Promise.all([
      appendProgramLogValue(22, '2026-07-06', 2, 3),
      appendProgramLogValue(22, '2026-07-06', 2, 5),
    ])

    const entries = await getProgramLogEntriesForDate(22, '2026-07-06')
    expect(entries).toHaveLength(1)
    expect([...entries[0].values].sort()).toEqual([3, 5])
  })

  it('keeps category entries for the same slot+date separate from the plain entry', async () => {
    await upsertProgramLogEntry({
      programExerciseId: 23,
      date: '2026-07-06',
      weekNumber: 2,
      values: [12],
      isWarmup: [false],
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
    })
    await appendProgramLogValue(23, '2026-07-06', 2, 3)

    const entries = await getProgramLogEntriesForDate(23, '2026-07-06')
    expect(entries).toHaveLength(2)
    const plain = entries.find((e) => e.chosenCategory === undefined)
    expect(plain?.values).toEqual([3])
  })
})

describe('logCategoryChoice', () => {
  const base = {
    programExerciseId: 30,
    date: '2026-07-06',
    weekNumber: 2,
    value: 10,
    categoriesToPick: 3,
  }

  it('rejects a 4th distinct category while still allowing an existing one to be re-logged', async () => {
    for (const category of ['Triceps', 'Biceps', 'Forearms']) {
      const result = await logCategoryChoice({
        ...base,
        chosenCategory: category,
        chosenExercise: `${category} Move`,
      })
      expect(result.ok).toBe(true)
    }

    const rejected = await logCategoryChoice({
      ...base,
      chosenCategory: 'Shoulders',
      chosenExercise: 'Lateral Raise',
    })
    expect(rejected).toEqual({ ok: false, capReached: true })

    const afterReject = await getProgramLogEntriesForDate(30, '2026-07-06')
    expect(afterReject).toHaveLength(3)
    expect(afterReject.map((e) => e.chosenCategory).sort()).toEqual([
      'Biceps',
      'Forearms',
      'Triceps',
    ])

    const relogged = await logCategoryChoice({
      ...base,
      value: 99,
      chosenCategory: 'Triceps',
      chosenExercise: 'OH Tricep Ext',
    })
    expect(relogged.ok).toBe(true)

    const entries = await getProgramLogEntriesForDate(30, '2026-07-06')
    expect(entries).toHaveLength(3)
    const triceps = entries.find((e) => e.chosenCategory === 'Triceps')
    expect(triceps?.values).toEqual([99])
    expect(triceps?.chosenExercise).toBe('OH Tricep Ext')
  })

  it('enforces the cap even when picks are fired concurrently', async () => {
    const results = await Promise.all(
      ['Triceps', 'Biceps', 'Forearms', 'Shoulders'].map((category) =>
        logCategoryChoice({
          ...base,
          programExerciseId: 31,
          chosenCategory: category,
          chosenExercise: `${category} Move`,
        })
      )
    )

    expect(results.filter((r) => r.ok)).toHaveLength(3)
    expect(results.filter((r) => !r.ok)).toHaveLength(1)
    const entries = await getProgramLogEntriesForDate(31, '2026-07-06')
    expect(entries).toHaveLength(3)
  })
})
