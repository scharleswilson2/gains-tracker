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
        'programDays',
        'programExercises',
        'programLogEntries',
        'programPrescriptions',
        'programWeeks',
        'programs',
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

describe('Program schema (v2)', () => {
  it('opens and exposes all program tables alongside the original tables', async () => {
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
        'programDays',
        'programExercises',
        'programLogEntries',
        'programPrescriptions',
        'programWeeks',
        'programs',
        'sets',
        'workoutSessions',
      ].sort()
    )
  })

  it('stores a program with weeks and days, and reads them back', async () => {
    const programId = await db.programs.add({
      name: 'Test Program',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const weekId = await db.programWeeks.add({
      programId,
      weekNumber: 1,
      startDate: '2026-06-29',
      endDate: '2026-07-03',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    const week = await db.programWeeks.get(weekId)
    const day = await db.programDays.get(dayId)
    expect(week?.programId).toBe(programId)
    expect(day?.dayNumber).toBe(1)
  })

  it('stores a program exercise slot with category options and a prescription', async () => {
    const exerciseId = await db.exercises.add({ name: 'Test Exercise' })
    const programId = await db.programs.add({
      name: 'Test Program',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 5 })

    const slotId = await db.programExercises.add({
      dayId,
      exerciseId,
      blockLabel: 'C',
      orderIndex: 2,
      measureType: 'category_choice',
      eachSide: false,
      tempo: null,
      categoryOptions: [
        { categoryLabel: 'Triceps', exercises: ['Cable Push Downs', 'OH Tricep Ext'] },
      ],
      categoriesToPick: 3,
    })

    await db.programPrescriptions.add({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [],
      isTest: false,
    })

    const slot = await db.programExercises.get(slotId)
    expect(slot?.categoryOptions?.[0].categoryLabel).toBe('Triceps')
    expect(slot?.categoriesToPick).toBe(3)
  })

  it('exercises can carry an optional description', async () => {
    const id = await db.exercises.add({
      name: 'Front Squat',
      description: 'A barbell squat with the bar racked across the front of the shoulders.',
    })
    const found = await db.exercises.get(id)
    expect(found?.description).toContain('front of the shoulders')
  })

  it('exerciseEntries can carry an optional program tag, sets can carry isWarmup', async () => {
    const sessionId = await db.workoutSessions.add({ date: '2026-06-29' })
    const exerciseId = await db.exercises.add({ name: 'Front Squat' })
    const entryId = await db.exerciseEntries.add({
      sessionId,
      exerciseId,
      programExerciseId: 999,
      weekNumber: 1,
    })
    const setId = await db.sets.add({
      exerciseEntryId: entryId,
      weightLbs: 45,
      reps: 5,
      isWarmup: true,
    })
    const entry = await db.exerciseEntries.get(entryId)
    const set = await db.sets.get(setId)
    expect(entry?.weekNumber).toBe(1)
    expect(set?.isWarmup).toBe(true)
  })

  it('existing sets without isWarmup remain valid (backward compatibility)', async () => {
    const sessionId = await db.workoutSessions.add({ date: '2026-06-29' })
    const exerciseId = await db.exercises.add({ name: 'Bench Press' })
    const entryId = await db.exerciseEntries.add({ sessionId, exerciseId })
    const setId = await db.sets.add({ exerciseEntryId: entryId, weightLbs: 135, reps: 5 })
    const set = await db.sets.get(setId)
    expect(set?.isWarmup).toBeUndefined()
  })
})
