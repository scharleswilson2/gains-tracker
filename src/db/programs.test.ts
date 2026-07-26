import { describe, it, expect } from 'vitest'
import {
  addProgramDay,
  addProgramWeek,
  createProgram,
  getActiveProgramDay,
  getCurrentProgramWeek,
  listProgramDays,
  listPrograms,
  listProgramWeeks,
} from './programs'

async function seedTestProgram() {
  const programId = await createProgram('Test Program', '2026-06-29', '2026-07-24')
  await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
  await addProgramWeek(programId, 2, '2026-07-06', '2026-07-10')
  await addProgramDay(programId, 1)
  await addProgramDay(programId, 2)
  await addProgramDay(programId, 4)
  await addProgramDay(programId, 5)
  return programId
}

describe('programs data layer', () => {
  it('resolves the active program/week/day for a Monday in week 1', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-06-29') // Monday
    expect(active?.week.weekNumber).toBe(1)
    expect(active?.day.dayNumber).toBe(1)
  })

  it('resolves Tuesday to day 2', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-06-30') // Tuesday
    expect(active?.day.dayNumber).toBe(2)
  })

  it('resolves Thursday to day 4 and Friday to day 5', async () => {
    await seedTestProgram()
    const thursday = await getActiveProgramDay('2026-07-02')
    const friday = await getActiveProgramDay('2026-07-03')
    expect(thursday?.day.dayNumber).toBe(4)
    expect(friday?.day.dayNumber).toBe(5)
  })

  it('returns null for Wednesday (rest day, no ProgramDay seeded)', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-07-01') // Wednesday
    expect(active).toBeNull()
  })

  it('returns null for a weekend date (outside any week range)', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-07-04') // Saturday
    expect(active).toBeNull()
  })

  it('returns null for a date outside any program', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2025-01-01')
    expect(active).toBeNull()
  })

  it('resolves the correct week when a date falls in week 2', async () => {
    await seedTestProgram()
    const active = await getActiveProgramDay('2026-07-08') // Wednesday of week 2 -> still rest day
    expect(active).toBeNull()
    const activeThu = await getActiveProgramDay('2026-07-09') // Thursday of week 2
    expect(activeThu?.week.weekNumber).toBe(2)
    expect(activeThu?.day.dayNumber).toBe(4)
  })
})

describe('listPrograms / listProgramWeeks / listProgramDays', () => {
  it('lists programs newest-first by startDate', async () => {
    await createProgram('Older', '2026-05-01', '2026-05-28')
    await createProgram('Newer', '2026-06-29', '2026-07-24')
    const all = await listPrograms()
    expect(all.map((p) => p.name)).toEqual(['Newer', 'Older'])
  })

  it('lists weeks ascending by weekNumber and days ascending by dayNumber', async () => {
    const programId = await createProgram('Test', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 2, '2026-07-06', '2026-07-10')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    await addProgramDay(programId, 5)
    await addProgramDay(programId, 1)

    const weeks = await listProgramWeeks(programId)
    expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2])

    const days = await listProgramDays(programId)
    expect(days.map((d) => d.dayNumber)).toEqual([1, 5])
  })
})

describe('getCurrentProgramWeek', () => {
  it('resolves the program/week containing a date even on a non-training day', async () => {
    const programId = await createProgram('Test', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    const current = await getCurrentProgramWeek('2026-07-01') // Wednesday, rest day
    expect(current?.week.weekNumber).toBe(1)
  })

  it('falls back to the most recent program\'s final week when the date is outside any program', async () => {
    const programId = await createProgram('Old Program', '2026-05-01', '2026-05-28')
    await addProgramWeek(programId, 1, '2026-05-01', '2026-05-05')
    await addProgramWeek(programId, 4, '2026-05-22', '2026-05-28')
    const current = await getCurrentProgramWeek('2099-01-01')
    expect(current?.program.name).toBe('Old Program')
    expect(current?.week.weekNumber).toBe(4)
  })

  it('returns null when there are no programs at all', async () => {
    const current = await getCurrentProgramWeek('2026-07-01')
    expect(current).toBeNull()
  })
})
