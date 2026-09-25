import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import './History.css'

interface ExerciseDetailRow {
  key: string
  name: string
  detail: string
}

export function HistorySessionDetail() {
  const { date } = useParams<{ date: string }>()

  const rows = useLiveQuery(async (): Promise<ExerciseDetailRow[]> => {
    if (!date) return []

    const weightedRows: ExerciseDetailRow[] = []
    const session = await db.workoutSessions.where('date').equals(date).first()
    if (session) {
      const entries = await db.exerciseEntries.where('sessionId').equals(session.id!).toArray()
      for (const entry of entries) {
        const sets = await db.sets.where('exerciseEntryId').equals(entry.id!).toArray()
        if (sets.length === 0) continue
        const exercise = await db.exercises.get(entry.exerciseId)
        const detail = sets
          .map((s) => `${s.weightLbs} lbs x ${s.reps}${s.isWarmup ? ' (warmup)' : ''}`)
          .join(', ')
        weightedRows.push({
          key: `weighted-${entry.id}`,
          name: exercise?.name ?? 'Unknown Exercise',
          detail,
        })
      }
    }

    const programEntries = await db.programLogEntries.where('date').equals(date).toArray()
    const slotIds = [...new Set(programEntries.map((e) => e.programExerciseId))]
    const slots = await db.programExercises.bulkGet(slotIds)
    const slotsById = new Map(slotIds.map((id, i) => [id, slots[i]]))
    const exerciseIds = [
      ...new Set(slots.filter((s): s is NonNullable<typeof s> => s !== undefined).map((s) => s.exerciseId)),
    ]
    const exercises = await db.exercises.bulkGet(exerciseIds)
    const exercisesById = new Map(exerciseIds.map((id, i) => [id, exercises[i]]))

    const programRows: ExerciseDetailRow[] = programEntries.map((entry) => {
      const slot = slotsById.get(entry.programExerciseId)
      const exercise = slot ? exercisesById.get(slot.exerciseId) : undefined
      const name = exercise?.name ?? 'Unknown Exercise'
      const detail = entry.chosenExercise
        ? `${entry.chosenCategory}: ${entry.chosenExercise} — ${entry.values.join(', ')}`
        : entry.values.join(', ')
      return { key: `program-${entry.id}`, name, detail }
    })

    return [...weightedRows, ...programRows].sort((a, b) => a.name.localeCompare(b.name))
  }, [date]) ?? []

  return (
    <div className="history-screen">
      <Link to="/history">← Back to History</Link>
      <h1>{date}</h1>
      <ul className="history-list">
        {rows.map((row) => (
          <li key={row.key} className="history-row">
            <strong>{row.name}</strong>: {row.detail}
          </li>
        ))}
      </ul>
    </div>
  )
}
