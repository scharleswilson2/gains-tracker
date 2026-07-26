import { describe, it, expect } from 'vitest'
import {
  addProgramLogEntry,
  getProgramLogEntries,
  getProgramLogEntriesForDate,
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
