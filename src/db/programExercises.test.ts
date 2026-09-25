import { describe, it, expect } from 'vitest'
import { db } from './schema'
import {
  addProgramExercise,
  addProgramPrescription,
  getDaySlots,
  groupSlotsByBlock,
  type ResolvedSlot,
} from './programExercises'

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

  it('sorts a null blockLabel slot after real block labels, regardless of insertion order', async () => {
    const exerciseIdNull = await db.exercises.add({ name: 'Ex Null' })
    const exerciseIdB = await db.exercises.add({ name: 'Ex B' })
    const exerciseIdA = await db.exercises.add({ name: 'Ex A' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    // Insert the null-blockLabel slot FIRST, with a low orderIndex, so a
    // broken sort (e.g. `blockLabel ?? ''`) that sorts null before real
    // labels, or one that relies on insertion/orderIndex order, would
    // misplace it instead of pushing it to the end.
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdNull,
      blockLabel: null,
      orderIndex: 0,
      measureType: 'distance',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdB,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdA,
      blockLabel: 'A',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots.map((s) => s.exerciseName)).toEqual(['Ex A', 'Ex B', 'Ex Null'])
  })

  it('sorts by blockOrder ahead of alphabetical order when set', async () => {
    const exerciseIdA = await db.exercises.add({ name: 'Ex Block A' })
    const exerciseIdMedBalls = await db.exercises.add({ name: 'Ex Med Balls' })
    const exerciseIdPlyos = await db.exercises.add({ name: 'Ex Plyos' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    // Inserted in alphabetical (wrong) order, so only an explicit blockOrder
    // comparison — not insertion order or a stale sort — could produce the
    // Plyos/Med Balls/A ordering asserted below.
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdA,
      blockLabel: 'A',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
      blockOrder: 2,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdMedBalls,
      blockLabel: 'Med Balls',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
      blockOrder: 1,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdPlyos,
      blockLabel: 'Plyos',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
      blockOrder: 0,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots.map((s) => s.exerciseName)).toEqual(['Ex Plyos', 'Ex Med Balls', 'Ex Block A'])
  })

  it('sorts a block with no blockOrder after every block that has one', async () => {
    const exerciseIdOrdered = await db.exercises.add({ name: 'Ex Ordered' })
    const exerciseIdUnordered = await db.exercises.add({ name: 'Ex Unordered' })
    const programId = await db.programs.add({
      name: 'Test',
      startDate: '2026-06-29',
      endDate: '2026-07-24',
    })
    const dayId = await db.programDays.add({ programId, dayNumber: 1 })

    // "Unordered"'s label alphabetizes before "Zzz Ordered" — without the
    // Infinity fallback, alphabetical order alone would put it first.
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdUnordered,
      blockLabel: 'Unordered',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramExercise({
      dayId,
      exerciseId: exerciseIdOrdered,
      blockLabel: 'Zzz Ordered',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
      blockOrder: 0,
    })

    const slots = await getDaySlots(dayId, 1)
    expect(slots.map((s) => s.exerciseName)).toEqual(['Ex Ordered', 'Ex Unordered'])
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

describe('groupSlotsByBlock', () => {
  it('groups consecutive same-blockLabel slots, using "Other" for null', () => {
    const makeSlot = (blockLabel: string | null, exerciseName: string): ResolvedSlot => ({
      programExercise: {
        id: 1,
        dayId: 1,
        exerciseId: 1,
        blockLabel,
        orderIndex: 0,
        measureType: 'bodyweight_reps',
        eachSide: false,
        tempo: null,
      },
      exerciseName,
      prescription: null,
    })
    const slots = [
      makeSlot('A', 'Ex A1'),
      makeSlot('A', 'Ex A2'),
      makeSlot('B', 'Ex B1'),
      makeSlot(null, 'Ex None'),
    ]
    const grouped = groupSlotsByBlock(slots)
    expect(grouped.map(([label, group]) => [label, group.map((s) => s.exerciseName)])).toEqual([
      ['A', ['Ex A1', 'Ex A2']],
      ['B', ['Ex B1']],
      ['Other', ['Ex None']],
    ])
  })
})
