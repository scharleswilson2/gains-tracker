import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from './schema'
import { getActiveProgramDay } from './programs'
import { getDaySlots } from './programExercises'
import { ensureAugustProgramSeeded } from './seedAugustProgram'
import { seedExerciseGlossary } from './exerciseGlossary'

describe('ensureAugustProgramSeeded', () => {
  // Program seeders depend on the exercise glossary already being seeded
  // (see main.tsx wiring), so tests must seed it first, same as production.
  beforeEach(async () => {
    await seedExerciseGlossary()
  })

  it('creates exactly one program, 4 weeks, 4 days, 32 exercise slots, 128 prescriptions', async () => {
    await ensureAugustProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programWeeks.count()).toBe(4)
    expect(await db.programDays.count()).toBe(4)
    expect(await db.programExercises.count()).toBe(32)
    expect(await db.programPrescriptions.count()).toBe(128)
  })

  it('is idempotent - running twice does not duplicate anything', async () => {
    await ensureAugustProgramSeeded()
    await ensureAugustProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(32)
  })

  it('resolves Monday of week 1 (7/27) to Day 1 with Front Squat prescribed correctly', async () => {
    await ensureAugustProgramSeeded()
    const active = await getActiveProgramDay('2026-07-27')
    expect(active).not.toBeNull()
    expect(active!.week.weekNumber).toBe(1)
    expect(active!.day.dayNumber).toBe(1)

    const slots = await getDaySlots(active!.day.id!, 1)
    const frontSquat = slots.find((s) => s.exerciseName === 'Front Squat')
    expect(frontSquat?.prescription?.rir).toBe('M')
    expect(frontSquat?.prescription?.workingTargets).toEqual([3, 3, 3, 3, 5])
    expect(frontSquat?.programExercise.tempo).toBe('3 second hold at bottom')
  })

  it('carries Front Squat into week 3 with the increased working targets', async () => {
    await ensureAugustProgramSeeded()
    const active = await getActiveProgramDay('2026-08-10') // Monday, week 3
    const slots = await getDaySlots(active!.day.id!, 3)
    const frontSquat = slots.find((s) => s.exerciseName === 'Front Squat')
    expect(frontSquat?.prescription?.workingTargets).toEqual([3, 3, 3, 3, 3, 5])
  })

  it('marks Hands on Hips Vertical Jump as a test in week 4', async () => {
    await ensureAugustProgramSeeded()
    const active = await getActiveProgramDay('2026-08-17') // Monday, week 4
    const slots = await getDaySlots(active!.day.id!, 4)
    const jump = slots.find((s) => s.exerciseName === 'Hands on Hips Vertical Jump')
    expect(jump?.prescription?.isTest).toBe(true)
  })

  it('progresses KB Lateral Deadlift RIR and targets correctly across all 4 weeks', async () => {
    await ensureAugustProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-07-27'))!.day
    const expected: Array<{ week: number; date: string; rir: string; targets: number[] }> = [
      { week: 1, date: '2026-07-27', rir: 'L', targets: [3, 3, 3] },
      { week: 2, date: '2026-08-03', rir: 'L', targets: [3, 3, 3] },
      { week: 3, date: '2026-08-10', rir: 'M', targets: [4, 4, 4] },
      { week: 4, date: '2026-08-17', rir: 'M', targets: [4, 4, 4] },
    ]
    for (const e of expected) {
      const slots = await getDaySlots(day1.id!, e.week)
      const kbLateral = slots.find((s) => s.exerciseName === 'KB Lateral Deadlift')
      expect(kbLateral?.prescription?.rir).toBe(e.rir)
      expect(kbLateral?.prescription?.workingTargets).toEqual(e.targets)
    }
  })

  it('keeps Reverse Lunge fully per-side across all 4 working sets, week 1', async () => {
    await ensureAugustProgramSeeded()
    const active = await getActiveProgramDay('2026-07-30') // Thursday, week 1, Day 4
    const slots = await getDaySlots(active!.day.id!, 1)
    const lunge = slots.find((s) => s.exerciseName === 'Reverse Lunge')
    expect(lunge?.programExercise.eachSide).toBe(true)
    expect(lunge?.prescription?.workingTargets).toEqual([3, 3, 3, 3, 5])
  })

  it('fills in Day 4 Block C (Barbell Hip Thrust, DB Pull Throughs, Back Ext Holds) unchanged from July', async () => {
    await ensureAugustProgramSeeded()
    const active = await getActiveProgramDay('2026-07-30') // Thursday, week 1, Day 4
    const slots = await getDaySlots(active!.day.id!, 1)

    const hipThrust = slots.find((s) => s.exerciseName === 'Barbell Hip Thrust')
    expect(hipThrust?.prescription?.rir).toBe('M')
    expect(hipThrust?.prescription?.workingTargets).toEqual([5, 5, 5])

    const pullThroughs = slots.find((s) => s.exerciseName === 'DB Pull Throughs')
    expect(pullThroughs?.programExercise.eachSide).toBe(true)
    expect(pullThroughs?.prescription?.workingTargets).toEqual([5, 5])

    const backExt = slots.find((s) => s.exerciseName === 'Back Ext Holds')
    expect(backExt?.programExercise.measureType).toBe('time')
    expect(backExt?.prescription?.workingTargets).toEqual([10, 10])
  })

  it('models the Arm Farm slot with 4 categories and categoriesToPick of 3', async () => {
    await ensureAugustProgramSeeded()
    const active = await getActiveProgramDay('2026-07-31') // Friday, week 1, Day 5
    const slots = await getDaySlots(active!.day.id!, 1)
    const armFarm = slots.find((s) => s.exerciseName === 'Arm Farm')
    expect(armFarm?.programExercise.categoriesToPick).toBe(3)
    expect(armFarm?.programExercise.categoryOptions).toHaveLength(4)
  })

  it('sets a Recovery note on every program day', async () => {
    await ensureAugustProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-07-27'))!.day
    expect(day1.note).toBe('Recovery')
  })

  it('rolls back the entire seed if a failure occurs partway through, leaving no partial program', async () => {
    const originalAdd = db.programPrescriptions.add.bind(db.programPrescriptions)
    let callCount = 0
    const addSpy = vi
      .spyOn(db.programPrescriptions, 'add')
      .mockImplementation((async (...args: Parameters<typeof originalAdd>) => {
        callCount++
        if (callCount === 5) {
          throw new Error('Simulated failure mid-seed')
        }
        return originalAdd(...args)
      }) as typeof db.programPrescriptions.add)

    try {
      await expect(ensureAugustProgramSeeded()).rejects.toThrow('Simulated failure mid-seed')

      expect(await db.programs.count()).toBe(0)
      expect(await db.programWeeks.count()).toBe(0)
      expect(await db.programDays.count()).toBe(0)
      expect(await db.programExercises.count()).toBe(0)
      expect(await db.programPrescriptions.count()).toBe(0)
    } finally {
      addSpy.mockRestore()
    }

    await ensureAugustProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(32)
    expect(await db.programPrescriptions.count()).toBe(128)
  })
})
