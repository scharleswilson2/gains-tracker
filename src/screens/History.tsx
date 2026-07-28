import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import './History.css'

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

    // Two bulk lookups instead of two sequential gets per row: program-log
    // history grows without bound, so a per-row round trip would keep getting
    // slower on every re-run of this live query.
    const slotIds = [...new Set(programLogEntries.map((e) => e.programExerciseId))]
    const slots = await db.programExercises.bulkGet(slotIds)
    const slotsById = new Map(slotIds.map((id, i) => [id, slots[i]]))

    const exerciseIds = [
      ...new Set(slots.filter((s) => s !== undefined).map((s) => s.exerciseId)),
    ]
    const exercises = await db.exercises.bulkGet(exerciseIds)
    const exercisesById = new Map(exerciseIds.map((id, i) => [id, exercises[i]]))

    const programLogRows: HistoryRow[] = []
    for (const entry of programLogEntries) {
      const slot = slotsById.get(entry.programExerciseId)
      const exercise = slot ? exercisesById.get(slot.exerciseId) : undefined
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
    <div className="history-screen">
      <h1>History</h1>
      <ul className="history-list">
        {rows.map((row) => (
          <li key={row.key} className="history-row">
            {row.date} — {row.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
