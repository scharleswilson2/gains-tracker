import { describe, it, expect } from 'vitest'
import { addProgramDay, addProgramWeek, createProgram, getActiveProgramDay } from './programs'

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
