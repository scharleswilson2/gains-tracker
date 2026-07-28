import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExercise, listExercises } from '../db/exercises'
import { getExerciseHistory, getLastSessionSets } from '../db/workouts'
import { getActiveProgramDay } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { logWeightSet } from '../lib/logWeightSet'
import { todayIso } from '../lib/dates'

export function LogLift() {
  const today = todayIso()
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeDay = useLiveQuery(() => getActiveProgramDay(today), [today])
  const slots = useLiveQuery(
    () => (activeDay ? getDaySlots(activeDay.day.id!, activeDay.week.weekNumber) : Promise.resolve([])),
    [activeDay]
  ) ?? []

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
    if (!selectedExerciseId || isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)

    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) {
      return
    }

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: selectedExerciseId,
        date: today,
        weightLbs,
        reps: repsNum,
      })

      setWeight('')
      setReps('')
      setPrMessage(pr.isWeightPr || pr.isEstimated1RmPr ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  // `activeDay === undefined` means the live query hasn't resolved yet;
  // `null` means resolved with "no program today" — both are valid states
  // to render the free-form-only screen below, so there's no loading gate
  // needed here (unlike Progress's exercise picker, nothing downstream of
  // `activeDay` requires synchronous option-list presence for tests).

  return (
    <div>
      <h1>Log Lift</h1>

      {activeDay && (
        <section>
          <h2>
            Day {activeDay.day.dayNumber} — Week {activeDay.week.weekNumber}
          </h2>
          {activeDay.day.note && <p>{activeDay.day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel}>
              <h3>{blockLabel}</h3>
              {blockSlots.map((slot) => (
                <ProgramSlotCard
                  key={slot.programExercise.id}
                  slot={slot}
                  date={today}
                  weekNumber={activeDay.week.weekNumber}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      <hr />
      <h2>Log something else</h2>

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
          <button type="button" onClick={handleAddSet} disabled={isSubmitting}>
            Add Set
          </button>

          {prMessage && <p role="status">{prMessage}</p>}

          <h3>Today's sets</h3>
          <ul>
            {(todaySets ?? []).map((s, i) => (
              <li key={i}>
                {s.weightLbs} x {s.reps}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
