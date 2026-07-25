import { describe, it, expect } from 'vitest'
import {
  addPopTimeRep,
  getOrCreateCatchingSessionForDate,
  getPopTimeReps,
  popTimeStats,
  recordBlockingDrill,
  recordFramingDrill,
  successRate,
} from './catching'

describe('catching data layer', () => {
  it('reuses the same catching session for the same date', async () => {
    const id1 = await getOrCreateCatchingSessionForDate('2026-07-20')
    const id2 = await getOrCreateCatchingSessionForDate('2026-07-20')
    expect(id1).toBe(id2)
  })

  it('records multiple pop time reps for a session and retrieves them', async () => {
    const sessionId = await getOrCreateCatchingSessionForDate('2026-07-21')
    await addPopTimeRep(sessionId, 1.95)
    await addPopTimeRep(sessionId, 1.89)
    const reps = await getPopTimeReps(sessionId)
    expect(reps.map((r) => r.seconds).sort()).toEqual([1.89, 1.95])
  })

  it('computes best and average pop time', () => {
    const stats = popTimeStats([{ seconds: 2.01 }, { seconds: 1.89 }, { seconds: 1.95 }])
    expect(stats.best).toBe(1.89)
    expect(stats.average).toBeCloseTo((2.01 + 1.89 + 1.95) / 3)
  })

  it('returns nulls for pop time stats with no reps', () => {
    expect(popTimeStats([])).toEqual({ best: null, average: null })
  })

  it('records blocking and framing drills', async () => {
    const sessionId = await getOrCreateCatchingSessionForDate('2026-07-22')
    await recordBlockingDrill(sessionId, 20, 16)
    await recordFramingDrill(sessionId, 15, 12)
  })

  it('computes success rate as a percentage', () => {
    expect(successRate(20, 16)).toBe(80)
    expect(successRate(0, 0)).toBeNull()
  })
})
