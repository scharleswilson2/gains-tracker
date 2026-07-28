import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ResolvedSlot } from '../db/programExercises'
import { SlotHeader } from './SlotHeader'
import { logWeightSet } from '../lib/logWeightSet'
import { getLastWeekWeightResult, getSetsForExerciseOnDate, getWorkingSetCountForSlotWeek, updateSet } from '../db/workouts'
import type { SetRecord } from '../db/schema'
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

interface SetRow {
  key: string
  isWarmup: boolean
  targetReps: number
  set: SetRecord | null
}

function WeightSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [extraSlotCount, setExtraSlotCount] = useState(0)
  const exerciseId = slot.programExercise.exerciseId
  const programExerciseId = slot.programExercise.id!
  const warmupTargets = slot.prescription?.warmupTargets ?? []
  const workingTargets = slot.prescription?.workingTargets ?? []
  const targetReps = workingTargets.length > 0 ? workingTargets[workingTargets.length - 1] : null
  const targetSetCount = workingTargets.length

  const loggedSets = useLiveQuery(
    () => getSetsForExerciseOnDate(exerciseId, date),
    [exerciseId, date]
  ) ?? { warmup: [], working: [] }

  const thisWeekSetCount = useLiveQuery(
    () => getWorkingSetCountForSlotWeek(exerciseId, programExerciseId, weekNumber),
    [exerciseId, programExerciseId, weekNumber]
  ) ?? 0
  const hasCompletedPrescribedSets = targetSetCount > 0 && thisWeekSetCount >= targetSetCount

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

  const warmupRows: SetRow[] = warmupTargets.map((target, i) => ({
    key: `warmup-${i}`,
    isWarmup: true,
    targetReps: target,
    set: loggedSets.warmup[i] ?? null,
  }))
  const workingRows: SetRow[] = workingTargets.map((target, i) => ({
    key: `working-${i}`,
    isWarmup: false,
    targetReps: target,
    set: loggedSets.working[i] ?? null,
  }))
  const loggedExtras = loggedSets.working.slice(workingTargets.length)
  const extraRows: SetRow[] = loggedExtras.map((set, i) => ({
    key: `extra-${i}`,
    isWarmup: false,
    targetReps: set.reps,
    set,
  }))
  // `extraSlotCount` only ever grows (clicking "+ Add extra set" bumps it,
  // nothing decrements it), so how many *pending* (not-yet-logged) extra
  // rows to render is purely derived from how far ahead of the logged data
  // it currently is — the pending row disappears exactly when the live
  // query catches up and the real row lands in `extraRows`, with no
  // imperative "hide it now" step that could race ahead of that data.
  const pendingCount = Math.max(0, extraSlotCount - extraRows.length)
  const pendingRows: SetRow[] = Array.from({ length: pendingCount }, (_, i) => ({
    key: `extra-${extraRows.length + i}`,
    isWarmup: false,
    targetReps: workingTargets[workingTargets.length - 1] ?? 0,
    set: null,
  }))

  const rows = [...warmupRows, ...workingRows, ...extraRows, ...pendingRows]

  return (
    <div>
      {lastWeekResult && (
        <p>
          Last week: {lastWeekResult.weightLbs} lbs x {lastWeekResult.reps}
        </p>
      )}
      {rows.map((row, i) => {
        const rowLabel = row.isWarmup ? `Warmup ${i + 1}` : `Set ${i + 1 - warmupRows.length}`
        return (
          <WeightRow
            key={row.key}
            row={row}
            rowLabel={rowLabel}
            slot={slot}
            date={date}
            weekNumber={weekNumber}
          />
        )
      })}
      {/* A row's set is attributed by insertion order (getSetsForExerciseOnDate's
          contract), not by which row's button the user clicked — so an extra set
          logged before the prescribed rows are done would land on an earlier,
          untouched row instead of at the end. Gating this on the prescription
          being complete keeps every new save unambiguously "the next row." */}
      {pendingCount === 0 && loggedSets.working.length >= workingTargets.length && (
        <button type="button" onClick={() => setExtraSlotCount((c) => c + 1)}>
          + Add extra set
        </button>
      )}
      {progressBadge && <p role="status">{BADGE_LABEL[progressBadge]}</p>}
    </div>
  )
}

function WeightRow({
  row,
  rowLabel,
  slot,
  date,
  weekNumber,
}: {
  row: SetRow
  rowLabel: string
  slot: ResolvedSlot
  date: string
  weekNumber: number
}) {
  const [weight, setWeight] = useState(row.set ? String(row.set.weightLbs) : '')
  const [reps, setReps] = useState(row.set ? String(row.set.reps) : String(row.targetReps))
  const [prMessage, setPrMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const weightId = `weight-${slot.programExercise.id}-${row.key}`
  const repsId = `reps-${slot.programExercise.id}-${row.key}`

  // The row's key is stable (it never changes based on row.set), so this
  // component instance survives the transition from "not yet logged" to
  // "logged" — including when `row.set` first arrives asynchronously from
  // the live query on initial mount (a pre-existing set loaded from a prior
  // session). Sync the displayed values from row.set whenever its identity
  // changes, without touching prMessage — a remount-on-set-arrival approach
  // would instead wipe the just-set "PR!" message the instant handleSave's
  // own live-query refresh lands, before it ever painted.
  useEffect(() => {
    if (row.set) {
      setWeight(String(row.set.weightLbs))
      setReps(String(row.set.reps))
    }
  }, [row.set?.id])

  async function handleSave() {
    if (isSubmitting) return
    const weightLbs = Number(weight)
    const repsNum = Number(reps)
    if (!(weightLbs > 0) || !Number.isInteger(repsNum) || repsNum <= 0) return

    setIsSubmitting(true)
    try {
      if (row.set) {
        await updateSet(row.set.id!, { weightLbs, reps: repsNum })
        setPrMessage(null)
      } else {
        const pr = await logWeightSet({
          exerciseId: slot.programExercise.exerciseId,
          date,
          weightLbs,
          reps: repsNum,
          isWarmup: row.isWarmup,
          programExerciseId: slot.programExercise.id,
          weekNumber,
        })
        setPrMessage(!row.isWarmup && (pr.isWeightPr || pr.isEstimated1RmPr) ? 'PR!' : null)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <span>
        {rowLabel} (target {row.targetReps})
      </span>
      <label htmlFor={weightId}>Weight (lbs) — {rowLabel}</label>
      <input id={weightId} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      <label htmlFor={repsId}>Reps — {rowLabel}</label>
      <input id={repsId} type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
      <button type="button" onClick={handleSave} disabled={isSubmitting}>
        {row.set ? 'Update' : 'Log set'}
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
