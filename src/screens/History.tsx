import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

interface HistoryRow {
  date: string
  label: string
  key: string
}

export function History() {
  const rows = useLiveQuery(async (): Promise<HistoryRow[]> => {
    const [lifts, catching, bodyweight, programLogEntries] = await Promise.all([
      db.workoutSessions.toArray(),
      db.catchingSessions.toArray(),
      db.bodyweightEntries.toArray(),
      db.programLogEntries.toArray(),
    ])

    const programLogRows: HistoryRow[] = []
    for (const entry of programLogEntries) {
      const slot = await db.programExercises.get(entry.programExerciseId)
      const exercise = slot ? await db.exercises.get(slot.exerciseId) : undefined
      const name = exercise?.name ?? 'Unknown Exercise'
      const label = entry.chosenExercise
        ? `${name} (${entry.chosenCategory}): ${entry.chosenExercise} — ${entry.values.join(', ')}`
        : `${name}: ${entry.values.length} set${entry.values.length === 1 ? '' : 's'} logged`
      programLogRows.push({ date: entry.date, label, key: `program-${entry.id}` })
    }

    const combined: HistoryRow[] = [
      ...lifts.map((s) => ({ date: s.date, label: 'Lift session', key: `lift-${s.id}` })),
      ...catching.map((s) => ({ date: s.date, label: 'Catching session', key: `catching-${s.id}` })),
      ...bodyweight.map((b) => ({
        date: b.date,
        label: `Bodyweight: ${b.weightLbs} lbs`,
        key: `bw-${b.id}`,
      })),
      ...programLogRows,
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
