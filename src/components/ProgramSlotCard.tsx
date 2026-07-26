import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { SlotHeader } from './SlotHeader'
import { logWeightSet } from '../lib/logWeightSet'
import {
  appendProgramLogValue,
  getProgramLogEntriesForDate,
  logCategoryChoice,
} from '../db/programLogEntries'

interface ProgramSlotCardProps {
  slot: ResolvedSlot
  date: string
  weekNumber: number
}

export function ProgramSlotCard({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const { programExercise } = slot

  return (
    <div>
      <SlotHeader slot={slot} />

      {programExercise.measureType === 'weight' && (
        <WeightSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
      {programExercise.measureType === 'category_choice' && (
        <CategoryChoiceSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
      {(programExercise.measureType === 'bodyweight_reps' ||
        programExercise.measureType === 'time' ||
        programExercise.measureType === 'distance') && (
        <SimpleValueSlotForm slot={slot} date={date} weekNumber={weekNumber} />
      )}
    </div>
  )
}

function WeightSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [isWarmup, setIsWarmup] = useState(false)
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasWarmupTargets = (slot.prescription?.warmupTargets.length ?? 0) > 0

  async function handleAddSet() {
    if (isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    const rpeNum = rpe ? Number(rpe) : undefined
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: slot.programExercise.exerciseId,
        date,
        weightLbs,
        reps: repsNum,
        rpe: rpeNum,
        isWarmup,
        programExerciseId: slot.programExercise.id,
        weekNumber,
      })
      setWeight('')
      setReps('')
      setRpe('')
      setIsWarmup(false)
      setPrMessage(!isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const weightId = `weight-${slot.programExercise.id}`
  const repsId = `reps-${slot.programExercise.id}`
  const rpeId = `rpe-${slot.programExercise.id}`
  const warmupId = `warmup-${slot.programExercise.id}`

  return (
    <div>
      <label htmlFor={weightId}>Weight (lbs)</label>
      <input id={weightId} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <label htmlFor={repsId}>Reps</label>
      <input id={repsId} type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
      <label htmlFor={rpeId}>RPE (optional)</label>
      <input id={rpeId} type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} />
      {hasWarmupTargets && (
        <>
          <label htmlFor={warmupId}>Warmup set</label>
          <input
            id={warmupId}
            type="checkbox"
            checked={isWarmup}
            onChange={(e) => setIsWarmup(e.target.checked)}
          />
        </>
      )}
      <button type="button" onClick={handleAddSet} disabled={isSubmitting}>
        Add Set
      </button>
      {prMessage && <p role="status">{prMessage}</p>}
    </div>
  )
}

function SimpleValueSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [value, setValue] = useState('')
  const programExerciseId = slot.programExercise.id!

  // Read only — the write path never derives its next state from this
  // snapshot, so a stale live-query result cannot cause a lost value.
  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedValues = entries.find((e) => e.chosenCategory === undefined)?.values ?? []

  async function handleAdd() {
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) return
    setValue('')
    await appendProgramLogValue(programExerciseId, date, weekNumber, numValue)
  }

  const valueId = `value-${programExerciseId}`

  return (
    <div>
      <label htmlFor={valueId}>Value</label>
      <input id={valueId} type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" onClick={handleAdd}>
        Add Set
      </button>
      <ul>
        {loggedValues.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </div>
  )
}

function CategoryChoiceSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState('')
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectedByCap, setRejectedByCap] = useState(false)
  const programExerciseId = slot.programExercise.id!
  const categoryOptions = slot.programExercise.categoryOptions ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedCategories = entries.map((e) => e.chosenCategory).filter(Boolean)
  const categoriesToPick = slot.programExercise.categoriesToPick ?? categoryOptions.length
  // Display-only hint. The cap itself is enforced atomically inside
  // `logCategoryChoice`, so a stale snapshot here can never let an extra
  // category through; `rejectedByCap` surfaces a write the DB turned away.
  const capReached = loggedCategories.length >= categoriesToPick

  async function handleSave() {
    if (isSubmitting) return
    const numValue = Number(value)
    if (!selectedCategory || !selectedExercise || !Number.isFinite(numValue) || numValue <= 0) return
    setIsSubmitting(true)
    try {
      const result = await logCategoryChoice({
        programExerciseId,
        date,
        weekNumber,
        value: numValue,
        chosenCategory: selectedCategory,
        chosenExercise: selectedExercise,
        categoriesToPick,
      })
      setRejectedByCap(!result.ok)
      if (result.ok) setValue('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <p>Logged today: {loggedCategories.length > 0 ? loggedCategories.join(', ') : 'none'}</p>
      {(capReached || rejectedByCap) && (
        <p>
          You've logged {categoriesToPick} categories today — the max for this exercise
        </p>
      )}
      <div>
        {categoryOptions.map((category) => {
          const alreadyLogged = loggedCategories.includes(category.categoryLabel)
          const disabled = capReached && !alreadyLogged
          return (
            <button
              key={category.categoryLabel}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelectedCategory(category.categoryLabel)
                setSelectedExercise('')
              }}
            >
              {category.categoryLabel}
            </button>
          )
        })}
      </div>
      {selectedCategory && (
        <div>
          <label htmlFor={`exercise-${programExerciseId}`}>Exercise</label>
          <select
            id={`exercise-${programExerciseId}`}
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            <option value="" disabled>
              Choose...
            </option>
            {categoryOptions
              .find((c) => c.categoryLabel === selectedCategory)
              ?.exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
          </select>
          <label htmlFor={`value-${programExerciseId}`}>Value</label>
          <input
            id={`value-${programExerciseId}`}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" onClick={handleSave} disabled={isSubmitting}>
            Save
          </button>
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
