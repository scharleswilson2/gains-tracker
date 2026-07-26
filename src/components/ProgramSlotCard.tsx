import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { ExerciseInfo } from './ExerciseInfo'
import { logWeightSet } from '../lib/logWeightSet'
import { getProgramLogEntriesForDate, upsertProgramLogEntry } from '../db/programLogEntries'

interface ProgramSlotCardProps {
  slot: ResolvedSlot
  date: string
  weekNumber: number
}

function targetSummary(slot: ResolvedSlot): string {
  const { prescription } = slot
  if (!prescription) return ''
  if (prescription.isTest) return 'TEST'
  const parts: string[] = []
  if (prescription.warmupTargets.length > 0) parts.push(`Warmup: ${prescription.warmupTargets.join(', ')}`)
  if (prescription.workingTargets.length > 0) parts.push(`Working: ${prescription.workingTargets.join(', ')}`)
  return parts.join(' | ')
}

export function ProgramSlotCard({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const { programExercise, prescription } = slot

  return (
    <div>
      <ExerciseInfo name={slot.exerciseName} />
      {programExercise.tempo && <span> Tempo: {programExercise.tempo}</span>}
      {prescription?.rir && <span> RIR: {prescription.rir}</span>}
      <p>{targetSummary(slot)}</p>

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
  const [isWarmup, setIsWarmup] = useState(false)
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasWarmupTargets = (slot.prescription?.warmupTargets.length ?? 0) > 0

  async function handleAddSet() {
    if (isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
      const pr = await logWeightSet({
        exerciseId: slot.programExercise.exerciseId,
        date,
        weightLbs,
        reps: repsNum,
        isWarmup,
        programExerciseId: slot.programExercise.id,
        weekNumber,
      })
      setWeight('')
      setReps('')
      setIsWarmup(false)
      setPrMessage(!isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const weightId = `weight-${slot.programExercise.id}`
  const repsId = `reps-${slot.programExercise.id}`
  const warmupId = `warmup-${slot.programExercise.id}`

  return (
    <div>
      <label htmlFor={weightId}>Weight (lbs)</label>
      <input id={weightId} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <label htmlFor={repsId}>Reps</label>
      <input id={repsId} type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
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

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedValues = entries[0]?.values ?? []

  async function handleAdd() {
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) return
    const nextValues = [...loggedValues, numValue]
    const nextIsWarmup = [...(entries[0]?.isWarmup ?? []), false]
    await upsertProgramLogEntry({
      programExerciseId,
      date,
      weekNumber,
      values: nextValues,
      isWarmup: nextIsWarmup,
    })
    setValue('')
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
  const programExerciseId = slot.programExercise.id!
  const categoryOptions = slot.programExercise.categoryOptions ?? []

  const entries = useLiveQuery(
    () => getProgramLogEntriesForDate(programExerciseId, date),
    [programExerciseId, date]
  ) ?? []
  const loggedCategories = entries.map((e) => e.chosenCategory).filter(Boolean)

  async function handleSave() {
    const numValue = Number(value)
    if (!selectedCategory || !selectedExercise || !Number.isFinite(numValue) || numValue <= 0) return
    await upsertProgramLogEntry({
      programExerciseId,
      date,
      weekNumber,
      values: [numValue],
      isWarmup: [false],
      chosenCategory: selectedCategory,
      chosenExercise: selectedExercise,
    })
    setValue('')
  }

  return (
    <div>
      <p>Logged today: {loggedCategories.length > 0 ? loggedCategories.join(', ') : 'none'}</p>
      <div>
        {categoryOptions.map((category) => (
          <button
            key={category.categoryLabel}
            type="button"
            onClick={() => {
              setSelectedCategory(category.categoryLabel)
              setSelectedExercise('')
            }}
          >
            {category.categoryLabel}
          </button>
        ))}
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
          <button type="button" onClick={handleSave}>
            Save
          </button>
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
