import { describe, it, expect } from 'vitest'
import { db } from '../db/schema'
import { exportAllData, importAllData } from './exportImport'

describe('exportAllData / importAllData', () => {
  it('round-trips all table data through JSON', async () => {
    await db.exercises.add({ name: 'Back Squat' })
    await db.bodyweightEntries.add({ date: '2026-07-20', weightLbs: 190 })

    const json = await exportAllData()

    await db.exercises.clear()
    await db.bodyweightEntries.clear()

    await importAllData(json)

    const exercises = await db.exercises.toArray()
    const bodyweights = await db.bodyweightEntries.toArray()
    expect(exercises.map((e) => e.name)).toEqual(['Back Squat'])
    expect(bodyweights.map((b) => b.weightLbs)).toEqual([190])
  })
})
