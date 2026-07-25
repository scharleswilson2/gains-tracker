import { db } from './schema'
import type { Program, ProgramWeek, ProgramDay } from './schema'

export async function createProgram(
  name: string,
  startDate: string,
  endDate: string
): Promise<number> {
  return db.programs.add({ name, startDate, endDate })
}

export async function addProgramWeek(
  programId: number,
  weekNumber: number,
  startDate: string,
  endDate: string
): Promise<number> {
  return db.programWeeks.add({ programId, weekNumber, startDate, endDate })
}

export async function addProgramDay(
  programId: number,
  dayNumber: number,
  note?: string
): Promise<number> {
  return db.programDays.add({ programId, dayNumber, note })
}

export interface ActiveProgramDay {
  program: Program
  week: ProgramWeek
  day: ProgramDay
}

function localDayOfWeek(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay() // 0=Sun ... 6=Sat
}

export async function getActiveProgramDay(date: string): Promise<ActiveProgramDay | null> {
  const weeks = await db.programWeeks
    .filter((w) => w.startDate <= date && date <= w.endDate)
    .toArray()
  if (weeks.length === 0) return null
  const week = weeks[0]

  const dayOfWeek = localDayOfWeek(date) // Mon=1 ... Fri=5 map directly to dayNumber
  if (dayOfWeek < 1 || dayOfWeek > 5) return null // weekend

  const day = await db.programDays
    .where('programId')
    .equals(week.programId)
    .and((d) => d.dayNumber === dayOfWeek)
    .first()
  if (!day) return null // e.g. Wednesday/dayNumber 3, never seeded (rest day)

  const program = await db.programs.get(week.programId)
  if (!program) return null

  return { program, week, day }
}
