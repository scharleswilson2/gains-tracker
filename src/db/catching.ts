import { db } from './schema'
import type { PopTimeRep } from './schema'

export async function getOrCreateCatchingSessionForDate(date: string): Promise<number> {
  return db.transaction('rw', db.catchingSessions, async () => {
    const existing = await db.catchingSessions.where('date').equals(date).first()
    if (existing) return existing.id!
    return db.catchingSessions.add({ date })
  })
}

export async function addPopTimeRep(
  catchingSessionId: number,
  seconds: number
): Promise<number> {
  return db.popTimeReps.add({ catchingSessionId, seconds })
}

export async function getPopTimeReps(catchingSessionId: number): Promise<PopTimeRep[]> {
  return db.popTimeReps.where('catchingSessionId').equals(catchingSessionId).toArray()
}

export function popTimeStats(
  reps: { seconds: number }[]
): { best: number | null; average: number | null } {
  if (reps.length === 0) return { best: null, average: null }
  const best = Math.min(...reps.map((r) => r.seconds))
  const average = reps.reduce((sum, r) => sum + r.seconds, 0) / reps.length
  return { best, average }
}

export async function recordBlockingDrill(
  catchingSessionId: number,
  repCount: number,
  successCount: number
): Promise<number> {
  return db.blockingDrills.add({ catchingSessionId, repCount, successCount })
}

export async function recordFramingDrill(
  catchingSessionId: number,
  repCount: number,
  successCount: number
): Promise<number> {
  return db.framingDrills.add({ catchingSessionId, repCount, successCount })
}

export function successRate(repCount: number, successCount: number): number | null {
  if (repCount === 0) return null
  return (successCount / repCount) * 100
}
