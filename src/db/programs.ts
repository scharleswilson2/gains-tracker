import { db } from './schema'
import type { Program, ProgramWeek, ProgramDay } from './schema'
import { addDays } from '../lib/dates'

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

  const dayOfWeek = localDayOfWeek(date) // Mon=1 ... Sat=6 map directly to dayNumber
  if (dayOfWeek < 1 || dayOfWeek > 6) return null // Sunday

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

export interface DatedProgramDay {
  program: Program
  week: ProgramWeek
  day: ProgramDay
  date: string
}

/**
 * Every day across every seeded program, each resolved to its concrete
 * calendar date, sorted ascending. Backs the day-navigation arrows: with
 * only a handful of ~16-day programs this is a trivial in-memory list, no
 * pagination needed.
 */
export async function listAllProgramDaysChronological(): Promise<DatedProgramDay[]> {
  const programs = await listPrograms()
  const result: DatedProgramDay[] = []
  for (const program of programs) {
    const weeks = await listProgramWeeks(program.id!)
    const days = await listProgramDays(program.id!)
    for (const week of weeks) {
      for (const day of days) {
        result.push({
          program,
          week,
          day,
          date: addDays(week.startDate, day.dayNumber - 1),
        })
      }
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

/**
 * The day-navigator's starting index: the day matching today exactly, or
 * the closest upcoming day, or the last day if today is past everything.
 * Returns -1 for an empty list (nothing to navigate to).
 */
export function findDefaultDayIndex(days: DatedProgramDay[], today: string): number {
  if (days.length === 0) return -1
  const exact = days.findIndex((d) => d.date === today)
  if (exact !== -1) return exact
  const next = days.findIndex((d) => d.date > today)
  if (next !== -1) return next
  return days.length - 1
}
