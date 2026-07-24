import { describe, it, expect } from 'vitest'
import { db } from './schema'

describe('GainsTrackerDB', () => {
  it('opens and exposes all expected tables', async () => {
    await db.open()
    const tableNames = db.tables.map((t) => t.name).sort()
    expect(tableNames).toEqual(
      [
        'bodyweightEntries',
        'blockingDrills',
        'catchingSessions',
        'exerciseEntries',
        'exercises',
        'framingDrills',
        'popTimeReps',
        'sets',
        'workoutSessions',
      ].sort()
    )
  })

  it('can add and retrieve an exercise', async () => {
    const id = await db.exercises.add({ name: 'Back Squat' })
    const found = await db.exercises.get(id)
    expect(found?.name).toBe('Back Squat')
  })
})
