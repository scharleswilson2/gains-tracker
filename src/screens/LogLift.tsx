import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExercise, listExercises } from '../db/exercises'
import {
  addSet,
  getExerciseHistory,
  getLastSessionSets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
} from '../db/workouts'
import { detectPr } from '../lib/prDetection'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LogLift() {
  const today = todayIso()
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)

  const allExercises = useLiveQuery(() => listExercises(), []) ?? []
  const matches =
    query.length > 0
      ? allExercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
      : []

  const lastSets = useLiveQuery(
    () => (selectedExerciseId ? getLastSessionSets(selectedExerciseId, today) : Promise.resolve([])),
    [selectedExerciseId, today]
  )

  const todaySets = useLiveQuery(async () => {
    if (!selectedExerciseId) return []
    const history = await getExerciseHistory(selectedExerciseId)
    return history.find((h) => h.date === today)?.sets ?? []
  }, [selectedExerciseId, today])

  async function selectExercise(name: string) {
    const id = await addExercise(name)
    setSelectedExerciseId(id)
    setSelectedExerciseName(name)
    setQuery('')
    setPrMessage(null)
  }

  async function handleAddSet() {
    if (!selectedExerciseId) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    const rpeNum = rpe ? Number(rpe) : undefined

    const priorHistory = await getExerciseHistory(selectedExerciseId)
    const priorSets = priorHistory.filter((h) => h.date < today).flatMap((h) => h.sets)
    const pr = detectPr({ weightLbs, reps: repsNum }, priorSets)

    const sessionId = await getOrCreateSessionForDate(today)
    const entryId = await getOrCreateExerciseEntry(sessionId, selectedExerciseId)
    await addSet(entryId, weightLbs, repsNum, rpeNum)

    setWeight('')
    setReps('')
    setRpe('')
    setPrMessage(pr.isWeightPr || pr.isEstimated1RmPr ? 'PR!' : null)
  }

  return (
    <div>
      <h1>Log Lift</h1>

      <label htmlFor="exercise-input">Exercise</label>
      <input
        id="exercise-input"
        value={selectedExerciseName || query}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelectedExerciseName('')
          setSelectedExerciseId(null)
        }}
        placeholder="Type to search or add an exercise"
      />
      <ul>
        {matches.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => selectExercise(m.name)}>
              {m.name}
            </button>
          </li>
        ))}
        {query.length > 0 && !matches.some((m) => m.name.toLowerCase() === query.toLowerCase()) && (
          <li>
            <button type="button" onClick={() => selectExercise(query)}>
              Add "{query}"
            </button>
          </li>
        )}
      </ul>

      {selectedExerciseId && (
        <div>
          <h2>{selectedExerciseName}</h2>

          {lastSets && lastSets.length > 0 && (
            <p>
              Last time: {lastSets.map((s) => `${s.weightLbs} x ${s.reps}`).join(', ')}
            </p>
          )}

          <div>
            <label htmlFor="weight-input">Weight (lbs)</label>
            <input
              id="weight-input"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="reps-input">Reps</label>
            <input
              id="reps-input"
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rpe-input">RPE (optional)</label>
            <input id="rpe-input" type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </div>
          <button type="button" onClick={handleAddSet}>
            Add Set
          </button>

          {prMessage && <p role="status">{prMessage}</p>}

          <h3>Today's sets</h3>
          <ul>
            {(todaySets ?? []).map((s, i) => (
              <li key={i}>
                {s.weightLbs} x {s.reps}
                {s.rpe ? ` @RPE ${s.rpe}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
