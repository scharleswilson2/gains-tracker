import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addExercise } from './exercises'
import {
  addSet,
  flattenHistorySets,
  getExerciseHistory,
  getLastSessionSets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
} from './workouts'

describe('workouts data layer', () => {
  it('reuses the same session for the same date', async () => {
    const id1 = await getOrCreateSessionForDate('2026-07-20')
    const id2 = await getOrCreateSessionForDate('2026-07-20')
    expect(id1).toBe(id2)
  })

  it('does not create duplicate sessions when called concurrently for the same date', async () => {
    const [id1, id2] = await Promise.all([
      getOrCreateSessionForDate('2026-07-23'),
      getOrCreateSessionForDate('2026-07-23'),
    ])
    expect(id1).toBe(id2)
    const all = await db.workoutSessions.where('date').equals('2026-07-23').toArray()
    expect(all).toHaveLength(1)
  })

  it('reuses the same exercise entry for the same session+exercise', async () => {
    const sessionId = await getOrCreateSessionForDate('2026-07-21')
    const exerciseId = await addExercise('Back Squat')
    const entryId1 = await getOrCreateExerciseEntry(sessionId, exerciseId)
    const entryId2 = await getOrCreateExerciseEntry(sessionId, exerciseId)
    expect(entryId1).toBe(entryId2)
  })

  it('does not create duplicate exercise entries when called concurrently for the same session+exercise', async () => {
    const sessionId = await getOrCreateSessionForDate('2026-07-24')
    const exerciseId = await addExercise('Concurrent Squat')
    const [entryId1, entryId2] = await Promise.all([
      getOrCreateExerciseEntry(sessionId, exerciseId),
      getOrCreateExerciseEntry(sessionId, exerciseId),
    ])
    expect(entryId1).toBe(entryId2)
    const all = await db.exerciseEntries
      .where('sessionId')
      .equals(sessionId)
      .and((e) => e.exerciseId === exerciseId)
      .toArray()
    expect(all).toHaveLength(1)
  })

  it('records exercise history in ascending date order with its sets', async () => {
    const exerciseId = await addExercise('Bench Press')

    const session1 = await getOrCreateSessionForDate('2026-07-15')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 185, 5)

    const session2 = await getOrCreateSessionForDate('2026-07-22')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 195, 5, 8)

    const history = await getExerciseHistory(exerciseId)
    expect(history.map((h) => h.date)).toEqual(['2026-07-15', '2026-07-22'])
    expect(history[1].sets).toEqual([
      expect.objectContaining({ weightLbs: 195, reps: 5, rpe: 8 }),
    ])
  })

  it('returns the most recent prior session sets for "last time" reference', async () => {
    const exerciseId = await addExercise('Deadlift')

    const session1 = await getOrCreateSessionForDate('2026-07-10')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 315, 3)

    const session2 = await getOrCreateSessionForDate('2026-07-17')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 325, 3)

    const lastSets = await getLastSessionSets(exerciseId, '2026-07-24')
    expect(lastSets).toEqual([expect.objectContaining({ weightLbs: 325, reps: 3 })])
  })

  it('returns an empty array when there is no prior session', async () => {
    const exerciseId = await addExercise('Overhead Press')
    const lastSets = await getLastSessionSets(exerciseId, '2026-07-24')
    expect(lastSets).toEqual([])
  })

  it('flattenHistorySets flattens history entries into one chronological list of sets', () => {
    const history = [
      { date: '2026-07-10', sets: [{ id: 1, exerciseEntryId: 1, weightLbs: 225, reps: 5 }] },
      {
        date: '2026-07-17',
        sets: [
          { id: 2, exerciseEntryId: 2, weightLbs: 230, reps: 5 },
          { id: 3, exerciseEntryId: 2, weightLbs: 235, reps: 5 },
        ],
      },
    ]
    expect(flattenHistorySets(history)).toEqual([
      history[0].sets[0],
      history[1].sets[0],
      history[1].sets[1],
    ])
  })

  it('includes an already-logged same-day set as "prior" for a later same-day set (via flattenHistorySets)', async () => {
    const exerciseId = await addExercise('Same Day Bench')
    const session = await getOrCreateSessionForDate('2026-07-24')
    const entry = await getOrCreateExerciseEntry(session, exerciseId)
    await addSet(entry, 185, 5)

    const history = await getExerciseHistory(exerciseId)
    const priorSets = flattenHistorySets(history)
    expect(priorSets).toEqual([expect.objectContaining({ weightLbs: 185, reps: 5 })])
  })
})
