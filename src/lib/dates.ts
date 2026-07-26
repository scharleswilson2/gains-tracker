/**
 * Returns today's date as a YYYY-MM-DD string using LOCAL date components.
 *
 * Deliberately does NOT use `new Date().toISOString().slice(0, 10)` — that
 * derives the date from UTC, so anyone west of UTC logging an evening
 * workout (roughly after 5-8pm local time for US timezones) would have it
 * filed under tomorrow's date instead of today's.
 */
export function todayIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
