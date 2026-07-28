import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addExercise, listExercises } from '../db/exercises'
import { getExerciseHistory, getLastSessionSets } from '../db/workouts'
import { findDefaultDayIndex, listAllProgramDaysChronological } from '../db/programs'
import { getDaySlots, groupSlotsByBlock } from '../db/programExercises'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { SlotHeader } from '../components/SlotHeader'
import { DayNavigator } from '../components/DayNavigator'
import { logWeightSet } from '../lib/logWeightSet'
import { todayIso } from '../lib/dates'

export function LogLift() {
  const today = todayIso()
  const [dayIndex, setDayIndex] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [isBodyweight, setIsBodyweight] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const allDaysQuery = useLiveQuery(() => listAllProgramDaysChronological(), [])
  const allDays = allDaysQuery ?? []
  const currentIndex = dayIndex ?? findDefaultDayIndex(allDays, today)
  const activeEntry = currentIndex >= 0 ? allDays[currentIndex] ?? null : null

  const slots = useLiveQuery(
    () =>
      activeEntry ? getDaySlots(activeEntry.day.id!, activeEntry.week.weekNumber) : Promise.resolve([]),
    [activeEntry]
  ) ?? []

  const isLiveWeek = activeEntry
    ? today >= activeEntry.week.startDate && today <= activeEntry.week.endDate
    : false

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
    setIsBodyweight(false)
  }

  async function handleAddSet() {
    if (!selectedExerciseId || isSubmitting) return
    const repsNum = Number(reps)
    if (!Number.isInteger(repsNum) || repsNum <= 0) return
    const weightLbs = isBodyweight ? 0 : Number(weight)
    if (!isBodyweight && !(weightLbs > 0)) return

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

  // `allDaysQuery === undefined` means the live query hasn't resolved yet.
  // Waiting for it (rather than rendering with an empty `allDays` fallback)
  // matches Program.tsx's old loading gate and keeps DayNavigator from
  // briefly flashing "no days" before the real list arrives.
  if (allDaysQuery === undefined) {
    return (
      <div>
        <h1>Log</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Log</h1>

      <DayNavigator days={allDays} currentIndex={currentIndex} onNavigate={setDayIndex} />

      {activeEntry && (
        <section>
          {activeEntry.day.note && <p>{activeEntry.day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel}>
              <h3>{blockLabel}</h3>
              {blockSlots.map((slot) =>
                isLiveWeek ? (
                  <ProgramSlotCard
                    key={slot.programExercise.id}
                    slot={slot}
                    date={activeEntry.date}
                    weekNumber={activeEntry.week.weekNumber}
                  />
                ) : (
                  <SlotHeader key={slot.programExercise.id} slot={slot} />
                )
              )}
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
            <p>Last time: {lastSets.map((s) => `${s.weightLbs} x ${s.reps}`).join(', ')}</p>
          )}

          <label htmlFor="bodyweight-toggle">No weight (bodyweight)</label>
          <input
            id="bodyweight-toggle"
            type="checkbox"
            checked={isBodyweight}
            onChange={(e) => setIsBodyweight(e.target.checked)}
          />

          {!isBodyweight && (
            <div>
              <label htmlFor="weight-input">Weight (lbs)</label>
              <input
                id="weight-input"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          )}
          <div>
            <label htmlFor="reps-input">Reps</label>
            <input id="reps-input" type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
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
