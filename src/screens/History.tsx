import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

interface HistoryRow {
  date: string
  label: string
  key: string
}

export function History() {
  const rows = useLiveQuery(async (): Promise<HistoryRow[]> => {
    const [lifts, catching, bodyweight] = await Promise.all([
      db.workoutSessions.toArray(),
      db.catchingSessions.toArray(),
      db.bodyweightEntries.toArray(),
    ])

    const combined: HistoryRow[] = [
      ...lifts.map((s) => ({ date: s.date, label: 'Lift session', key: `lift-${s.id}` })),
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
    <div>
      <h1>History</h1>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            {row.date} — {row.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
