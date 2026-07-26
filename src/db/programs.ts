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

export async function listPrograms(): Promise<Program[]> {
  const all = await db.programs.toArray()
  return all.sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export async function listProgramWeeks(programId: number): Promise<ProgramWeek[]> {
  const weeks = await db.programWeeks.where('programId').equals(programId).toArray()
  return weeks.sort((a, b) => a.weekNumber - b.weekNumber)
}

export async function listProgramDays(programId: number): Promise<ProgramDay[]> {
  const days = await db.programDays.where('programId').equals(programId).toArray()
  return days.sort((a, b) => a.dayNumber - b.dayNumber)
}

export interface CurrentProgramWeek {
  program: Program
  week: ProgramWeek
}

export async function getCurrentProgramWeek(date: string): Promise<CurrentProgramWeek | null> {
  const weeks = await db.programWeeks
    .filter((w) => w.startDate <= date && date <= w.endDate)
    .toArray()
  if (weeks.length > 0) {
    const week = weeks[0]
    const program = await db.programs.get(week.programId)
    if (program) return { program, week }
  }

  const programs = await listPrograms()
  if (programs.length === 0) return null
  const latestProgram = programs[0]
  const weeksForLatest = await listProgramWeeks(latestProgram.id!)
  if (weeksForLatest.length === 0) return null
  return { program: latestProgram, week: weeksForLatest[weeksForLatest.length - 1] }
}
