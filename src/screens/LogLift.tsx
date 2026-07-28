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
import './LogLift.css'

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
    <div className="log-lift">
      <h1>Log</h1>

      <DayNavigator days={allDays} currentIndex={currentIndex} onNavigate={setDayIndex} />

      {activeEntry && (
        <section>
          {activeEntry.day.note && <p className="log-lift-day-note">{activeEntry.day.note}</p>}
          {groupSlotsByBlock(slots).map(([blockLabel, blockSlots]) => (
            <div key={blockLabel} className="log-lift-block">
              <h3 className="log-lift-block-label">{blockLabel}</h3>
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

      <hr className="log-lift-divider" />
      <h2>Log something else</h2>

      <div className="log-lift-freeform-search">
        <label htmlFor="exercise-input">Exercise</label>
        <input
          id="exercise-input"
          className="field"
          value={selectedExerciseName || query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedExerciseName('')
            setSelectedExerciseId(null)
          }}
          placeholder="Type to search or add an exercise"
        />
        <ul className="log-lift-matches">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" className="btn" onClick={() => selectExercise(m.name)}>
                {m.name}
              </button>
            </li>
          ))}
          {query.length > 0 && !matches.some((m) => m.name.toLowerCase() === query.toLowerCase()) && (
            <li>
              <button type="button" className="btn" onClick={() => selectExercise(query)}>
                Add "{query}"
              </button>
            </li>
          )}
        </ul>
      </div>

      {selectedExerciseId && (
        <div className="log-lift-freeform-entry">
          <h2>{selectedExerciseName}</h2>

          {lastSets && lastSets.length > 0 && (
            <p className="log-lift-last-time">
              Last time: {lastSets.map((s) => `${s.weightLbs} x ${s.reps}`).join(', ')}
            </p>
          )}

          <div className="log-lift-bodyweight-toggle">
            <label htmlFor="bodyweight-toggle">No weight (bodyweight)</label>
            <input
              id="bodyweight-toggle"
              type="checkbox"
              checked={isBodyweight}
              onChange={(e) => setIsBodyweight(e.target.checked)}
            />
          </div>

          {!isBodyweight && (
            <div className="log-lift-field">
              <label htmlFor="weight-input">Weight (lbs)</label>
              <input
                id="weight-input"
                className="field"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          )}
          <div className="log-lift-field">
            <label htmlFor="reps-input">Reps</label>
            <input
              id="reps-input"
              className="field"
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleAddSet} disabled={isSubmitting}>
            Add Set
          </button>

          {prMessage && (
            <p role="status" className="pr-badge">
              ★ {prMessage}
            </p>
          )}

          <h3>Today's sets</h3>
          <ul className="log-lift-today-sets">
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
