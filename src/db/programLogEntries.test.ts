import { describe, it, expect } from 'vitest'
import { addProgramLogEntry, getProgramLogEntries } from './programLogEntries'

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
