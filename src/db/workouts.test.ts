import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addExercise } from './exercises'
import {
  addSet,
  flattenHistorySets,
  getExerciseHistory,
  getLastSessionSets,
  getLastWeekWeightResult,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
  getWorkingSetCountForSlotWeek,
  getWorkingSetHistory,
  workingSetsOnly,
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
    await addSet(entry2, 195, 5)

    const history = await getExerciseHistory(exerciseId)
    expect(history.map((h) => h.date)).toEqual(['2026-07-15', '2026-07-22'])
    expect(history[1].sets).toEqual([
      expect.objectContaining({ weightLbs: 195, reps: 5 }),
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

  it('addSet defaults isWarmup to false when not provided', async () => {
    const exerciseId = await addExercise('Test Isolation Exercise')
    const sessionId = await getOrCreateSessionForDate('2026-07-01')
    const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId)
    const setId = await addSet(entryId, 100, 5)
    const set = await db.sets.get(setId)
    expect(set?.isWarmup).toBe(false)
  })

  it('addSet stores isWarmup: true when passed', async () => {
    const exerciseId = await addExercise('Test Isolation Exercise 2')
    const sessionId = await getOrCreateSessionForDate('2026-07-01')
    const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId)
    const setId = await addSet(entryId, 45, 5, true)
    const set = await db.sets.get(setId)
    expect(set?.isWarmup).toBe(true)
  })

  it('getOrCreateExerciseEntry stores programExerciseId/weekNumber on a new entry', async () => {
    const exerciseId = await addExercise('Test Program Exercise')
    const sessionId = await getOrCreateSessionForDate('2026-07-06')
    const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2)
    const entry = await db.exerciseEntries.get(entryId)
    expect(entry?.programExerciseId).toBe(42)
    expect(entry?.weekNumber).toBe(2)
  })

  it('getOrCreateExerciseEntry does not overwrite an existing entry\'s program tag', async () => {
    const exerciseId = await addExercise('Test Program Exercise 2')
    const sessionId = await getOrCreateSessionForDate('2026-07-06')
    const entryId1 = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2)
    const entryId2 = await getOrCreateExerciseEntry(sessionId, exerciseId, 99, 3)
    expect(entryId1).toBe(entryId2)
    const entry = await db.exerciseEntries.get(entryId1)
    expect(entry?.programExerciseId).toBe(42) // unchanged from first call
  })
})

describe('workingSetsOnly', () => {
  it('filters out warmup sets', () => {
    const sets = [
      { id: 1, exerciseEntryId: 1, weightLbs: 45, reps: 5, isWarmup: true },
      { id: 2, exerciseEntryId: 1, weightLbs: 135, reps: 5, isWarmup: false },
      { id: 3, exerciseEntryId: 1, weightLbs: 145, reps: 3 }, // undefined isWarmup
    ]
    const result = workingSetsOnly(sets)
    expect(result.map((s) => s.id)).toEqual([2, 3])
  })
})

describe('getWorkingSetHistory', () => {
  it('excludes warmup sets and drops entries left with zero sets', async () => {
    const exerciseId = await addExercise('Test Warmup Exercise')
    const session1 = await getOrCreateSessionForDate('2026-07-01')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 45, 5, true) // warmup only this session

    const session2 = await getOrCreateSessionForDate('2026-07-08')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 45, 5, true) // warmup
    await addSet(entry2, 225, 5, false) // working set

    const history = await getWorkingSetHistory(exerciseId)
    expect(history).toHaveLength(1) // 2026-07-01 dropped entirely (all warmup)
    expect(history[0].date).toBe('2026-07-08')
    expect(history[0].sets).toHaveLength(1)
    expect(history[0].sets[0].weightLbs).toBe(225)
  })
})

it('getExerciseHistory includes weekNumber from the entry when present', async () => {
  const exerciseId = await addExercise('Test Week Tag Exercise')
  const sessionId = await getOrCreateSessionForDate('2026-07-06')
  const entryId = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2)
  await addSet(entryId, 135, 5)
  const history = await getExerciseHistory(exerciseId)
  expect(history[0].weekNumber).toBe(2)
})

it('getOrCreateExerciseEntry backfills a program tag onto an existing untagged entry', async () => {
  const exerciseId = await addExercise('Test Backfill Exercise')
  const sessionId = await getOrCreateSessionForDate('2026-07-06')
  const entryId1 = await getOrCreateExerciseEntry(sessionId, exerciseId) // untagged, e.g. free-form
  const entryId2 = await getOrCreateExerciseEntry(sessionId, exerciseId, 42, 2) // same slot, now tagged
  expect(entryId1).toBe(entryId2)
  const entry = await db.exerciseEntries.get(entryId1)
  expect(entry?.programExerciseId).toBe(42)
  expect(entry?.weekNumber).toBe(2)
})

describe('getLastWeekWeightResult', () => {
  it('returns the heaviest logged set for the given slot and week', async () => {
    const exerciseId = await addExercise('Test Front Squat Progress')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 10, 3)
    await addSet(entry, 205, 5)
    await addSet(entry, 215, 3)

    const result = await getLastWeekWeightResult(exerciseId, 10, 3)
    expect(result?.weightLbs).toBe(215)
    expect(result?.reps).toBe(3)
  })

  it('excludes warmup sets even if logged last', async () => {
    const exerciseId = await addExercise('Test Warmup Excluded Progress')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 11, 3)
    await addSet(entry, 205, 5)
    await addSet(entry, 45, 8, true) // warmup, logged last

    const result = await getLastWeekWeightResult(exerciseId, 11, 3)
    expect(result?.weightLbs).toBe(205)
  })

  it('returns null when nothing was logged for that slot/week', async () => {
    const exerciseId = await addExercise('Test Nothing Logged Progress')
    const result = await getLastWeekWeightResult(exerciseId, 999, 1)
    expect(result).toBeNull()
  })

  it('does not match a different programExerciseId for the same exercise', async () => {
    const exerciseId = await addExercise('Test Shared Exercise Progress')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 12, 3)
    await addSet(entry, 300, 2)

    const result = await getLastWeekWeightResult(exerciseId, 13, 3)
    expect(result).toBeNull()
  })

  it('returns the heaviest set even when a lighter one was logged last (e.g. a back-off set)', async () => {
    const exerciseId = await addExercise('Test Heaviest Not Last')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 60, 3)
    await addSet(entry, 215, 5) // heaviest, logged first
    await addSet(entry, 205, 3) // lighter, logged last

    const result = await getLastWeekWeightResult(exerciseId, 60, 3)
    expect(result?.weightLbs).toBe(215)
    expect(result?.reps).toBe(5)
  })

  it('breaks ties on weight by preferring more reps', async () => {
    const exerciseId = await addExercise('Test Tie Break Reps')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 61, 3)
    await addSet(entry, 215, 4)
    await addSet(entry, 215, 4)
    await addSet(entry, 215, 4)
    await addSet(entry, 215, 5) // same weight, most reps, logged last

    const result = await getLastWeekWeightResult(exerciseId, 61, 3)
    expect(result?.weightLbs).toBe(215)
    expect(result?.reps).toBe(5)
  })
})

describe('getWorkingSetCountForSlotWeek', () => {
  it('counts only working (non-warmup) sets for the given slot and week', async () => {
    const exerciseId = await addExercise('Test Set Count')
    const session = await getOrCreateSessionForDate('2026-07-13')
    const entry = await getOrCreateExerciseEntry(session, exerciseId, 70, 3)
    await addSet(entry, 45, 5, true) // warmup, not counted
    await addSet(entry, 205, 5)
    await addSet(entry, 205, 4)

    const count = await getWorkingSetCountForSlotWeek(exerciseId, 70, 3)
    expect(count).toBe(2)
  })

  it('returns 0 when nothing was logged for that slot/week', async () => {
    const exerciseId = await addExercise('Test Zero Set Count')
    const count = await getWorkingSetCountForSlotWeek(exerciseId, 999, 1)
    expect(count).toBe(0)
  })
})
