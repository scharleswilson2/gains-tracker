import { describe, it, expect } from 'vitest'
import { db } from './schema'
import { addProgramExercise, addProgramPrescription, getDaySlots } from './programExercises'

describe('programExercises data layer', () => {
  it('adds a slot and its prescription, then resolves via getDaySlots', async () => {
    const exerciseId = await db.exercises.add({ name: 'Front Squat' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: '4/1/0',
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: 'M',
      warmupTargets: [5, 4],
      workingTargets: [3, 3, 3, 5],
      isTest: false,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots).toHaveLength(1)
    expect(slots[0].exerciseName).toBe('Front Squat')
    expect(slots[0].prescription?.workingTargets).toEqual([3, 3, 3, 5])
  })

  it('sorts slots by blockLabel then orderIndex', async () => {
    const exerciseId1 = await db.exercises.add({ name: 'Ex A1' })
    const exerciseId2 = await db.exercises.add({ name: 'Ex A2' })
    const exerciseId3 = await db.exercises.add({ name: 'Ex B1' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    await addProgramExercise({
      dayId,
      exerciseId: exerciseId3,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseId2,
      blockLabel: 'A',
      orderIndex: 1,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseId1,
      blockLabel: 'A',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots.map((s) => s.exerciseName)).toEqual(['Ex A1', 'Ex A2', 'Ex B1'])
  })

  it('returns prescription: null when no prescription exists for the requested week', async () => {
    const exerciseId = await db.exercises.add({ name: 'Some Exercise' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })
    await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: null,
      orderIndex: 0,
      measureType: 'distance',
      eachSide: false,
      tempo: null,
    })

    const slots = await getDaySlots(dayId, 3)
    expect(slots[0].prescription).toBeNull()
  })

  it('round-trips category_choice fields', async () => {
    const exerciseId = await db.exercises.add({ name: 'Arm Farm' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 5 })

    await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'C',
      orderIndex: 2,
      measureType: 'category_choice',
      eachSide: false,
      tempo: null,
      categoryOptions: [
        { categoryLabel: 'Triceps', exercises: ['Cable Push Downs', 'OH Tricep Ext'] },
        { categoryLabel: 'Biceps', exercises: ['Hammer Curl', 'Zottman Curl'] },
      ],
      categoriesToPick: 3,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots[0].programExercise.categoriesToPick).toBe(3)
    expect(slots[0].programExercise.categoryOptions).toHaveLength(2)
  })
})
