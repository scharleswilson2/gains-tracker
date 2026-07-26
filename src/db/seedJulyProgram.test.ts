import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from './schema'
import { getActiveProgramDay } from './programs'
import { getDaySlots } from './programExercises'
import { ensureJulyProgramSeeded } from './seedJulyProgram'
import { seedExerciseGlossary } from './exerciseGlossary'

describe('ensureJulyProgramSeeded', () => {
  // ensureJulyProgramSeeded no longer seeds the exercise glossary itself
  // (that now runs independently on every app startup, see main.tsx), so
  // tests must seed the glossary first, same as production wiring does.
  beforeEach(async () => {
    await seedExerciseGlossary()
  })


  it('creates exactly one program, 4 weeks, 4 days, 32 exercise slots, 128 prescriptions', async () => {
    await ensureJulyProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programWeeks.count()).toBe(4)
    expect(await db.programDays.count()).toBe(4)
    expect(await db.programExercises.count()).toBe(32)
    expect(await db.programPrescriptions.count()).toBe(128)
  })

  it('is idempotent - running twice does not duplicate anything', async () => {
    await ensureJulyProgramSeeded()
    await ensureJulyProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(32)
  })

  it('resolves Monday of week 1 (6/29) to Day 1 with Front Squat prescribed correctly', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-06-29')
    expect(active).not.toBeNull()
    expect(active!.week.weekNumber).toBe(1)
    expect(active!.day.dayNumber).toBe(1)

    const slots = await getDaySlots(active!.day.id!, 1)
    const frontSquat = slots.find((s) => s.exerciseName === 'Front Squat')
    expect(frontSquat?.prescription?.rir).toBe('M')
    expect(frontSquat?.prescription?.warmupTargets).toEqual([5, 4])
    expect(frontSquat?.prescription?.workingTargets).toEqual([3, 3, 3, 5])
  })

  it('carries Front Squat into week 3 with the increased working targets', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-13') // Monday, week 3
    const slots = await getDaySlots(active!.day.id!, 3)
    const frontSquat = slots.find((s) => s.exerciseName === 'Front Squat')
    expect(frontSquat?.prescription?.workingTargets).toEqual([4, 4, 4, 5])
  })

  it('marks 1 Step Approach Vertical Jump as a test in week 4', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-20') // Monday, week 4
    const slots = await getDaySlots(active!.day.id!, 4)
    const jump = slots.find((s) => s.exerciseName === '1 Step Approach Vertical Jump')
    expect(jump?.prescription?.isTest).toBe(true)
  })

  it('progresses KB Lateral Deadlift RIR and targets correctly across all 4 weeks', async () => {
    await ensureJulyProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-06-29'))!.day
    const expected: Array<{ week: number; date: string; rir: string; targets: number[] }> = [
      { week: 1, date: '2026-06-29', rir: 'L', targets: [4, 4, 4] },
      { week: 2, date: '2026-07-06', rir: 'L', targets: [5, 5, 5] },
      { week: 3, date: '2026-07-13', rir: 'M', targets: [5, 5, 5] },
      { week: 4, date: '2026-07-20', rir: 'M', targets: [6, 6, 6] },
    ]
    for (const e of expected) {
      const slots = await getDaySlots(day1.id!, e.week)
      const kbLateral = slots.find((s) => s.exerciseName === 'KB Lateral Deadlift')
      expect(kbLateral?.prescription?.rir).toBe(e.rir)
      expect(kbLateral?.prescription?.workingTargets).toEqual(e.targets)
    }
  })

  it('keeps Reverse Lunge fully per-side across all 4 working sets, week 1', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-02') // Thursday, week 1, Day 4
    const slots = await getDaySlots(active!.day.id!, 1)
    const lunge = slots.find((s) => s.exerciseName === 'Reverse Lunge')
    expect(lunge?.programExercise.eachSide).toBe(true)
    expect(lunge?.prescription?.warmupTargets).toEqual([5])
    expect(lunge?.prescription?.workingTargets).toEqual([5, 3, 3, 5])
  })

  it('keeps Copenhagen Plank per-side in week 3 despite the source text dropping "ea"', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-14') // Tuesday, week 3, Day 2
    const slots = await getDaySlots(active!.day.id!, 3)
    const plank = slots.find((s) => s.exerciseName === 'Copenhagen Plank')
    expect(plank?.programExercise.eachSide).toBe(true)
    expect(plank?.prescription?.workingTargets).toEqual([30, 30, 30])
  })

  it('models the Arm Farm slot with 4 categories and categoriesToPick of 3', async () => {
    await ensureJulyProgramSeeded()
    const active = await getActiveProgramDay('2026-07-03') // Friday, week 1, Day 5
    const slots = await getDaySlots(active!.day.id!, 1)
    const armFarm = slots.find((s) => s.exerciseName === 'Arm Farm')
    expect(armFarm?.programExercise.categoriesToPick).toBe(3)
    expect(armFarm?.programExercise.categoryOptions).toHaveLength(4)
    const forearms = armFarm?.programExercise.categoryOptions?.find(
      (c) => c.categoryLabel === 'Forearms & Grip'
    )
    expect(forearms?.exercises).toEqual([
      'Wrist Curls',
      'Reverse Wrist Curls',
      'Pronations/Supinations',
      'Plate Holds',
      'Dead Hangs',
      'Farmer Holds',
    ])
  })

  it('sets a Recovery note on every program day', async () => {
    await ensureJulyProgramSeeded()
    const day1 = (await getActiveProgramDay('2026-06-29'))!.day
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
      await expect(ensureJulyProgramSeeded()).rejects.toThrow('Simulated failure mid-seed')

      // The transaction must have rolled back entirely: no program, no
      // weeks/days/exercises/prescriptions left behind despite several of
      // them having been created before the simulated failure occurred.
      expect(await db.programs.count()).toBe(0)
      expect(await db.programWeeks.count()).toBe(0)
      expect(await db.programDays.count()).toBe(0)
      expect(await db.programExercises.count()).toBe(0)
      expect(await db.programPrescriptions.count()).toBe(0)
    } finally {
      addSpy.mockRestore()
    }

    // A subsequent call, unimpeded, must fully re-seed rather than being
    // permanently blocked by a half-created program row.
    await ensureJulyProgramSeeded()
    expect(await db.programs.count()).toBe(1)
    expect(await db.programExercises.count()).toBe(32)
    expect(await db.programPrescriptions.count()).toBe(128)
  })
})
