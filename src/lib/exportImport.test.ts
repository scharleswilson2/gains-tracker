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

  it('exports data wrapped in a versioned envelope with an exportedAt timestamp', async () => {
    await db.exercises.add({ name: 'Front Squat' })

    const json = await exportAllData()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(typeof parsed.exportedAt).toBe('string')
    expect(new Date(parsed.exportedAt).toString()).not.toBe('Invalid Date')
    expect(Array.isArray(parsed.tables.exercises)).toBe(true)
    expect(parsed.tables.exercises.some((e: { name: string }) => e.name === 'Front Squat')).toBe(
      true
    )
  })

  it('rejects a malformed/unrelated JSON file and leaves existing data untouched', async () => {
    await db.exercises.add({ name: 'Deadlift' })

    await expect(importAllData(JSON.stringify({ some: 'unrelated', shape: 42 }))).rejects.toThrow()

    const exercises = await db.exercises.toArray()
    expect(exercises.map((e) => e.name)).toContain('Deadlift')
  })

  it('rejects an envelope with an unknown/unsupported version', async () => {
    await db.exercises.add({ name: 'Overhead Press' })

    const badEnvelope = JSON.stringify({
      version: 999,
      exportedAt: new Date().toISOString(),
      tables: { exercises: [] },
    })

    await expect(importAllData(badEnvelope)).rejects.toThrow()

    const exercises = await db.exercises.toArray()
    expect(exercises.map((e) => e.name)).toContain('Overhead Press')
  })

  it('rejects an envelope whose tables value is not array-shaped per key', async () => {
    await db.exercises.add({ name: 'Bench Press' })

    const badEnvelope = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: { exercises: { notAnArray: true } },
    })

    await expect(importAllData(badEnvelope)).rejects.toThrow()

    const exercises = await db.exercises.toArray()
    expect(exercises.map((e) => e.name)).toContain('Bench Press')
  })
})
