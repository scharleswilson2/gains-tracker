import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { SlotHeader } from './SlotHeader'
import { logWeightSet } from '../lib/logWeightSet'
import { getLastWeekWeightResult, getWorkingSetCountForSlotWeek } from '../db/workouts'
import {
  appendProgramLogValue,
  getLastWeekCategoryValue,
  getLastWeekSimpleValue,
  getProgramLogEntriesForDate,
  logCategoryChoice,
} from '../db/programLogEntries'
import { compareSimpleValues, compareWeightSets } from '../lib/compareProgress'
import type { ProgressBadge } from '../lib/compareProgress'

interface ProgramSlotCardProps {
  slot: ResolvedSlot
  date: string
  weekNumber: number
}

const BADGE_LABEL: Record<ProgressBadge, string> = {
  beat: 'Beat last week!',
  matched: 'Matched last week',
  'fell-short': 'Fell short of last week',
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
  const [isWarmup, setIsWarmup] = useState(false)
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasWarmupTargets = (slot.prescription?.warmupTargets.length ?? 0) > 0

  const exerciseId = slot.programExercise.exerciseId
  const programExerciseId = slot.programExercise.id!
  const targetReps =
    slot.prescription && slot.prescription.workingTargets.length > 0
      ? slot.prescription.workingTargets[slot.prescription.workingTargets.length - 1]
      : null
  const targetSetCount = slot.prescription?.workingTargets.length ?? 0
  const thisWeekSetCount = useLiveQuery(
    () => getWorkingSetCountForSlotWeek(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  ) ?? 0
  const hasCompletedPrescribedSets = targetSetCount > 0 && thisWeekSetCount >= targetSetCount

  // Called with the current weekNumber here, and weekNumber - 1 below —
  // "last week" describes the function's primary use, not a hardcoded
  // offset, so it doubles as "this week's" result too.
  const thisWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  )
  const lastWeekResult = useLiveQuery(
    () => getLastWeekWeightResult(exerciseId, programExerciseId, weekNumber - 1),
    [exerciseId, programExerciseId, weekNumber]
  )
  const progressBadge =
    hasCompletedPrescribedSets && thisWeekResult && lastWeekResult
      ? compareWeightSets(thisWeekResult, lastWeekResult, targetReps)
      : null

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
      {lastWeekResult && (
        <p>
          Last week: {lastWeekResult.weightLbs} lbs x {lastWeekResult.reps}
        </p>
      )}
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
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
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

  const lastWeekValue = useLiveQuery(
    () => getLastWeekSimpleValue(programExerciseId, weekNumber - 1),
    [programExerciseId, weekNumber]
  )
  const thisWeekLastValue = loggedValues.length > 0 ? loggedValues[loggedValues.length - 1] : undefined
  const progressBadge =
    thisWeekLastValue !== undefined ? compareSimpleValues(thisWeekLastValue, lastWeekValue) : null

  async function handleAdd() {
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) return
    setValue('')
    await appendProgramLogValue(programExerciseId, date, weekNumber, numValue)
  }

  const valueId = `value-${programExerciseId}`

  return (
    <div>
      {lastWeekValue !== undefined && <p>Last week: {lastWeekValue}</p>}
      <label htmlFor={valueId}>Value</label>
      <input id={valueId} type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" onClick={handleAdd}>
        Add Set
      </button>
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
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

  const lastWeekCategoryValue = useLiveQuery(
    () =>
      selectedCategory
        ? getLastWeekCategoryValue(programExerciseId, weekNumber - 1, selectedCategory)
        : Promise.resolve(undefined),
    [programExerciseId, weekNumber, selectedCategory]
  )
  const thisWeekEntry = selectedCategory
    ? entries.find((e) => e.chosenCategory === selectedCategory)
    : undefined
  const thisWeekValue =
    thisWeekEntry && thisWeekEntry.values.length > 0
      ? thisWeekEntry.values[thisWeekEntry.values.length - 1]
      : undefined
  const progressBadge =
    thisWeekValue !== undefined ? compareSimpleValues(thisWeekValue, lastWeekCategoryValue) : null

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
          {lastWeekCategoryValue !== undefined && (
            <p>
              Last week ({selectedCategory}): {lastWeekCategoryValue}
            </p>
          )}
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
          {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
