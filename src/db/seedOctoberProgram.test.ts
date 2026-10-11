import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './schema'
import { getActiveProgramDay } from './programs'
import { getDaySlots } from './programExercises'
import { ensureOctoberProgramSeeded } from './seedOctoberProgram'
import { ensureSeptemberProgramSeeded } from './seedSeptemberProgram'
import { seedExerciseGlossary } from './exerciseGlossary'

describe('ensureOctoberProgramSeeded', () => {
  beforeEach(async () => {
    await seedExerciseGlossary()
  })

  it('creates one program, 4 weeks, 6 days, 66 slots, 264 prescriptions', async () => {
    await ensureOctoberProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programWeeks.count()).toBe(4)
    expect(await db.programDays.count()).toBe(6)
    expect(await db.programExercises.count()).toBe(66)
    expect(await db.programPrescriptions.count()).toBe(264)
  })

  it('is idempotent', async () => {
    await ensureOctoberProgramSeeded()
    await ensureOctoberProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(66)
  })

  it('coexists with the September program without overlapping dates', async () => {
    await ensureSeptemberProgramSeeded()
    await ensureOctoberProgramSeeded()
    expect(await db.programs.count()).toBe(2)
    const sept = await getActiveProgramDay('2026-10-12') // Mon, September week 4
    const oct = await getActiveProgramDay('2026-10-19') // Mon, October week 1
    expect(sept?.program.name).toBe('September 21 – October 17, 2026')
    expect(oct?.program.name).toBe('October 19 – November 14, 2026')
    expect(oct?.week.weekNumber).toBe(1)
    expect(oct?.day.dayNumber).toBe(1)
  })

  it('puts Plyos and Med Balls before the lettered blocks on Monday', async () => {
    await ensureOctoberProgramSeeded()
    const monday = await getActiveProgramDay('2026-10-19')
    const slots = await getDaySlots(monday!.day.id!, 1)
    expect(slots.slice(0, 3).map((s) => s.exerciseName)).toEqual([
      'Hurdle Hops / PAP Circuit',
      'Kneeling Scoop / OH Toss',
      'Safety Bar Box Squat',
    ])
    const squat = slots.find((s) => s.exerciseName === 'Safety Bar Box Squat')
    expect(squat?.prescription?.workingTargets).toEqual([3, 3, 3, 3])
    expect(squat?.programExercise.measureType).toBe('weight')
  })

  it('resolves Saturday to the mobility day', async () => {
    await ensureOctoberProgramSeeded()
    const saturday = await getActiveProgramDay('2026-10-24')
    expect(saturday?.day.dayNumber).toBe(6)
    const slots = await getDaySlots(saturday!.day.id!, 1)
    expect(slots).toHaveLength(12)
  })

  it('keeps the Friday Arm Farm slot and bench-with-chains prescription', async () => {
    await ensureOctoberProgramSeeded()
    const friday = await getActiveProgramDay('2026-10-23')
    const slots = await getDaySlots(friday!.day.id!, 1)
    expect(slots.find((s) => s.exerciseName === 'Arm Farm')?.programExercise.categoriesToPick).toBe(3)
    expect(
      slots.find((s) => s.exerciseName === 'BB Bench Press with Chains')?.prescription?.workingTargets
    ).toEqual([4, 4, 4])
  })
})
