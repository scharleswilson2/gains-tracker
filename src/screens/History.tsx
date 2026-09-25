import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import './History.css'

interface HistoryRow {
  date: string
  label: string
  key: string
  to?: string
}

export function History() {
  const rows = useLiveQuery(async (): Promise<HistoryRow[]> => {
    const [entries, sets, catching, bodyweight, programLogEntries, sessions] = await Promise.all([
      db.exerciseEntries.toArray(),
      db.sets.toArray(),
      db.catchingSessions.toArray(),
      db.bodyweightEntries.toArray(),
      db.programLogEntries.toArray(),
      db.workoutSessions.toArray(),
    ])

    const sessionDateById = new Map(sessions.map((s) => [s.id!, s.date]))
    const entryIdsWithSets = new Set(sets.map((s) => s.exerciseEntryId))

    // A "lift session" groups every exercise logged on a date — both the
    // weighted-lift path (workoutSessions/exerciseEntries/sets) and the
    // bodyweight/time/distance/category path (programLogEntries) — into a
    // single clickable summary row instead of one row per exercise. An
    // exerciseEntry with no sets isn't something the lifter actually did,
    // so it's excluded.
    const exerciseIdsByDate = new Map<string, Set<number>>()
    for (const entry of entries) {
      if (!entryIdsWithSets.has(entry.id!)) continue
      const date = sessionDateById.get(entry.sessionId)
      if (!date) continue
      const ids = exerciseIdsByDate.get(date) ?? new Set<number>()
      ids.add(entry.exerciseId)
      exerciseIdsByDate.set(date, ids)
    }

    const slotIds = [...new Set(programLogEntries.map((e) => e.programExerciseId))]
    const slots = await db.programExercises.bulkGet(slotIds)
    const slotsById = new Map(slotIds.map((id, i) => [id, slots[i]]))
    for (const entry of programLogEntries) {
      const slot = slotsById.get(entry.programExerciseId)
      if (!slot) continue
      const ids = exerciseIdsByDate.get(entry.date) ?? new Set<number>()
      ids.add(slot.exerciseId)
      exerciseIdsByDate.set(entry.date, ids)
    }

    const liftRows: HistoryRow[] = [...exerciseIdsByDate.entries()].map(([date, exerciseIds]) => ({
      date,
      label: `Lift session (${exerciseIds.size} exercise${exerciseIds.size === 1 ? '' : 's'})`,
      key: `lift-${date}`,
      to: `/history/${date}`,
    }))

    const combined: HistoryRow[] = [
      ...liftRows,
      ...catching.map((s) => ({ date: s.date, label: 'Catching session', key: `catching-${s.id}` })),
      ...bodyweight.map((b) => ({
        date: b.date,
        label: `Bodyweight: ${b.weightLbs} lbs`,
        key: `bw-${b.id}`,
      })),
    ]

    combined.sort((a, b) => b.date.localeCompare(a.date))
    return combined
  }, []) ?? []

  return (
    <div className="history-screen">
      <h1>History</h1>
      <ul className="history-list">
        {rows.map((row) => (
          <li key={row.key} className="history-row">
            {row.to ? (
              <Link to={row.to}>
                {row.date} — {row.label}
              </Link>
            ) : (
              <>
                {row.date} — {row.label}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
