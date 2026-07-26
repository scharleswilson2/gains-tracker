import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addExercise, findExerciseByName, listExercises, listExercisesWithHistory } from './exercises'

describe('exercises data layer', () => {
  it('adds a new exercise and finds it by name case-insensitively', async () => {
    await addExercise('Back Squat')
    const found = await findExerciseByName('back squat')
    expect(found?.name).toBe('Back Squat')
  })

  it('does not create a duplicate when adding the same name twice', async () => {
    const id1 = await addExercise('Bench Press')
    const id2 = await addExercise('bench press')
    expect(id1).toBe(id2)
    const all = await listExercises()
    expect(all.filter((e) => e.name === 'Bench Press')).toHaveLength(1)
  })

  it('lists exercises alphabetically by name', async () => {
    await addExercise('Deadlift')
    await addExercise('Clean')
    const all = await listExercises()
    const names = all.map((e) => e.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('stores a description when provided on creation', async () => {
    const id = await addExercise('Test Front Squat', undefined, 'A barbell squat held in the front rack.')
    const found = await db.exercises.get(id)
    expect(found?.description).toBe('A barbell squat held in the front rack.')
  })
})

it('listExercisesWithHistory only returns exercises with at least one logged entry', async () => {
  const loggedId = await addExercise('Logged Exercise')
  await addExercise('Never Logged Exercise')
  const sessionId = await db.workoutSessions.add({ date: '2026-07-01' })
  await db.exerciseEntries.add({ sessionId, exerciseId: loggedId })

  const withHistory = await listExercisesWithHistory()
  expect(withHistory.map((e) => e.name)).toEqual(['Logged Exercise'])
})
