import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './schema'
import { getActiveProgramDay } from './programs'
import { getDaySlots } from './programExercises'
import { ensureSeptemberProgramSeeded } from './seedSeptemberProgram'
import { seedExerciseGlossary } from './exerciseGlossary'

describe('ensureSeptemberProgramSeeded', () => {
  // Program seeders depend on the exercise glossary already being seeded
  // (see main.tsx wiring), so tests must seed it first, same as production.
  beforeEach(async () => {
    await seedExerciseGlossary()
  })

  it('creates exactly one program, 4 weeks, 6 days, 66 exercise slots, 264 prescriptions', async () => {
    await ensureSeptemberProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programWeeks.count()).toBe(4)
    expect(await db.programDays.count()).toBe(6)
    expect(await db.programExercises.count()).toBe(66)
    expect(await db.programPrescriptions.count()).toBe(264)
  })

  it('is idempotent - running twice does not duplicate anything', async () => {
    await ensureSeptemberProgramSeeded()
    await ensureSeptemberProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(66)
  })

  it('resolves Monday of week 1 (9/21) to Day 1 with Trap Bar Deadlift prescribed correctly', async () => {
    await ensureSeptemberProgramSeeded()
    const active = await getActiveProgramDay('2026-09-21')
    expect(active).not.toBeNull()
    expect(active!.week.weekNumber).toBe(1)
    expect(active!.day.dayNumber).toBe(1)

    const slots = await getDaySlots(active!.day.id!, 1)
    const deadlift = slots.find((s) => s.exerciseName === 'Trap Bar Deadlift')
    expect(deadlift?.prescription?.workingTargets).toEqual([6, 6, 6, 6])
    expect(deadlift?.programExercise.blockLabel).toBe('A')
  })

  it('resolves Saturday of week 1 (9/26) to Day 6, the mobility day', async () => {
    await ensureSeptemberProgramSeeded()
    const active = await getActiveProgramDay('2026-09-26')
    expect(active).not.toBeNull()
    expect(active!.day.dayNumber).toBe(6)

    const slots = await getDaySlots(active!.day.id!, 1)
    expect(slots).toHaveLength(12)
    const hipCars = slots.find((s) => s.exerciseName === 'Hip CARS')
    expect(hipCars?.programExercise.blockLabel).toBe('Hips')
    expect(hipCars?.prescription?.workingTargets).toEqual([1])
  })

  it('gives Wednesday (Day 3) the same mobility slots as Saturday (Day 6)', async () => {
    await ensureSeptemberProgramSeeded()
    const wednesday = await getActiveProgramDay('2026-09-23')
    const saturday = await getActiveProgramDay('2026-09-26')

    const wedSlots = await getDaySlots(wednesday!.day.id!, 1)
    const satSlots = await getDaySlots(saturday!.day.id!, 1)
    expect(wedSlots.map((s) => s.exerciseName).sort()).toEqual(
      satSlots.map((s) => s.exerciseName).sort()
    )
  })

  it('keeps working targets constant across all 4 weeks for a strength slot', async () => {
    await ensureSeptemberProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-09-21'))!.day
    for (const week of [1, 2, 3, 4]) {
      const slots = await getDaySlots(day1.id!, week)
      const deadlift = slots.find((s) => s.exerciseName === 'Trap Bar Deadlift')
      expect(deadlift?.prescription?.workingTargets).toEqual([6, 6, 6, 6])
    }
  })

  it('models the Friday Arm Farm slot with 3 categories, categoriesToPick of 3', async () => {
    await ensureSeptemberProgramSeeded()
    const active = await getActiveProgramDay('2026-09-25') // Friday, week 1, Day 5
    const slots = await getDaySlots(active!.day.id!, 1)
    const armFarm = slots.find((s) => s.exerciseName === 'Arm Farm')
    expect(armFarm?.programExercise.categoriesToPick).toBe(3)
    expect(armFarm?.programExercise.categoryOptions).toHaveLength(3)
  })

  it('marks Copenhagen ISO Hold and Weighted Planks as time-based, each-side flag set correctly', async () => {
    await ensureSeptemberProgramSeeded()
    const monday = await getActiveProgramDay('2026-09-21')
    const mondaySlots = await getDaySlots(monday!.day.id!, 1)
    const copenhagen = mondaySlots.find((s) => s.exerciseName === 'Copenhagen ISO Hold')
    expect(copenhagen?.programExercise.measureType).toBe('time')
    expect(copenhagen?.programExercise.eachSide).toBe(true)

    const thursday = await getActiveProgramDay('2026-09-24')
    const thursdaySlots = await getDaySlots(thursday!.day.id!, 1)
    const plank = thursdaySlots.find((s) => s.exerciseName === 'Weighted Planks')
    expect(plank?.programExercise.measureType).toBe('time')
    expect(plank?.programExercise.eachSide).toBe(false)
  })

  it('sets a descriptive note on every program day', async () => {
    await ensureSeptemberProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-09-21'))!.day
    expect(day1.note).toBe('Lower — Rate of Force Development')
    const day3 = (await getActiveProgramDay('2026-09-23'))!.day
    expect(day3.note).toBe('Mobility/Movement — Recovery')
  })
})
