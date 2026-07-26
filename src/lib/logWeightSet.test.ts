import { describe, it, expect } from 'vitest'
import { addExercise } from '../db/exercises'
import { getOrCreateExerciseEntry, getOrCreateSessionForDate, addSet } from '../db/workouts'
import { db } from '../db/schema'
import { logWeightSet } from './logWeightSet'

describe('logWeightSet', () => {
  it('logs a set and reports a PR against prior working history', async () => {
    const exerciseId = await addExercise('Test Bench')
    const priorSession = await getOrCreateSessionForDate('2026-07-01')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId)
    await addSet(priorEntry, 185, 5)

    const result = await logWeightSet({
      exerciseId,
      date: '2026-07-08',
      weightLbs: 195,
      reps: 5,
    })

    expect(result.isWeightPr).toBe(true)
    const history = await db.sets.toArray()
    expect(history.some((s) => s.weightLbs === 195 && s.reps === 5)).toBe(true)
  })

  it('never reports a PR for a warmup set, even if the weight would otherwise be one', async () => {
    const exerciseId = await addExercise('Test Squat')
    const result = await logWeightSet({
      exerciseId,
      date: '2026-07-01',
      weightLbs: 315,
      reps: 5,
      isWarmup: true,
    })
    expect(result.isWeightPr).toBe(false)
    expect(result.isEstimated1RmPr).toBe(false)
  })

  it('does not let a prior warmup set count as history when checking a later real PR', async () => {
    const exerciseId = await addExercise('Test Deadlift')
    await logWeightSet({ exerciseId, date: '2026-07-01', weightLbs: 405, reps: 3, isWarmup: true })
    const result = await logWeightSet({ exerciseId, date: '2026-07-01', weightLbs: 225, reps: 3 })
    // 225 beats "nothing" (the 405 was a warmup and doesn't count), so this is a PR
    expect(result.isWeightPr).toBe(true)
  })

  it('tags the exercise entry with programExerciseId/weekNumber when provided', async () => {
    const exerciseId = await addExercise('Test Program Tagged Lift')
    await logWeightSet({
      exerciseId,
      date: '2026-07-06',
      weightLbs: 100,
      reps: 5,
      programExerciseId: 7,
      weekNumber: 2,
    })
    const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
    expect(entries[0].programExerciseId).toBe(7)
    expect(entries[0].weekNumber).toBe(2)
  })
})
