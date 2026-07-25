import { describe, it, expect } from 'vitest'
import { addBodyweightEntry, listBodyweightEntries } from './bodyweight'

describe('bodyweight data layer', () => {
  it('adds entries and lists them ascending by date', async () => {
    await addBodyweightEntry('2026-07-22', 195)
    await addBodyweightEntry('2026-07-15', 197)
    const entries = await listBodyweightEntries()
    expect(entries.map((e) => e.date)).toEqual(['2026-07-15', '2026-07-22'])
  })

  it('upserts (overwrites) the entry for a date that already has one', async () => {
    await addBodyweightEntry('2026-07-20', 196)
    await addBodyweightEntry('2026-07-20', 194)
    const entries = await listBodyweightEntries()
    const forDate = entries.filter((e) => e.date === '2026-07-20')
    expect(forDate).toHaveLength(1)
    expect(forDate[0].weightLbs).toBe(194)
  })
})
