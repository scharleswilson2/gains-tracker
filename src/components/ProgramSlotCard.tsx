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
  updateProgramLogValue,
} from '../db/programLogEntries'
import { compareSimpleValues, compareWeightSets } from '../lib/compareProgress'
import type { ProgressBadge } from '../lib/compareProgress'
import './ProgramSlotCard.css'

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

// How much to bump the suggested weight over last week's heaviest set.
const WEIGHT_INCREMENT_LBS = 5

export function ProgramSlotCard({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const { programExercise } = slot

  return (
    <div className="program-slot-card">
      <div className="program-slot-card-header">
        <SlotHeader slot={slot} />
        {programExercise.blockLabel && <span className="pill">{programExercise.blockLabel}</span>}
      </div>

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
  // Whether this row is the next one that logging a new set will actually
  // land on — a row's set is attributed by insertion order (see
  // getSetsForExerciseOnDate), not by which row's button was clicked, so
  // any not-yet-logged row other than the next one must not offer to log:
  // doing so would silently fill an earlier row instead. Already-logged
  // rows are always independently editable regardless of this flag.
  canLog: boolean
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
    () => getSetsForExerciseOnDate(exerciseId, date, programExerciseId),
    [exerciseId, date, programExerciseId]
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
  // The whole point of tracking last week's heaviest set is to know what to
  // load today — so surface it as a concrete next number rather than making
  // the lifter do the arithmetic every time.
  const suggestedWeight = lastWeekResult ? lastWeekResult.weightLbs + WEIGHT_INCREMENT_LBS : null
  const progressBadge =
    hasCompletedPrescribedSets && thisWeekResult && lastWeekResult
      ? compareWeightSets(thisWeekResult, lastWeekResult, targetReps)
      : null

  const warmupRows: SetRow[] = warmupTargets.map((target, i) => ({
    key: `warmup-${i}`,
    isWarmup: true,
    targetReps: target,
    set: loggedSets.warmup[i] ?? null,
    canLog: i === loggedSets.warmup.length,
  }))
  const workingRows: SetRow[] = workingTargets.map((target, i) => ({
    key: `working-${i}`,
    isWarmup: false,
    targetReps: target,
    set: loggedSets.working[i] ?? null,
    canLog: i === loggedSets.working.length,
  }))
  const loggedExtras = loggedSets.working.slice(workingTargets.length)
  const extraRows: SetRow[] = loggedExtras.map((set, i) => ({
    key: `extra-${i}`,
    isWarmup: false,
    targetReps: set.reps,
    set,
    canLog: true, // already logged — Update is always available regardless of canLog
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
    // Only the first pending row is ever the immediate next working-stream
    // slot — the "+ Add extra set" gate (below) keeps more than one pending
    // row from existing at once in practice, but this stays correct even if
    // that ever changes.
    canLog: workingTargets.length + extraRows.length + i === loggedSets.working.length,
  }))

  const rows = [...warmupRows, ...workingRows, ...extraRows, ...pendingRows]

  return (
    <div className="slot-form">
      {lastWeekResult && (
        <p className="slot-form-last-week">
          Last week: {lastWeekResult.weightLbs} lbs x {lastWeekResult.reps} — try {suggestedWeight} lbs
          this week
        </p>
      )}
      <div className="set-row-grid">
        {rows.map((row, i) => {
          const rowNumber = row.isWarmup ? i + 1 : i + 1 - warmupRows.length
          const rowLabel = row.isWarmup ? `Warmup ${rowNumber}` : `Set ${rowNumber}`
          return (
            <WeightRow
              key={row.key}
              row={row}
              rowLabel={rowLabel}
              rowNumber={rowNumber}
              slot={slot}
              date={date}
              weekNumber={weekNumber}
              suggestedWeight={row.isWarmup ? null : suggestedWeight}
            />
          )
        })}
      </div>
      {/* A row's set is attributed by insertion order (getSetsForExerciseOnDate's
          contract), not by which row's button the user clicked — so an extra set
          logged before the prescribed rows are done would land on an earlier,
          untouched row instead of at the end. Gating this on the prescription
          being complete keeps every new save unambiguously "the next row." */}
      {pendingCount === 0 && loggedSets.working.length >= workingTargets.length && (
        <button
          type="button"
          className="btn btn-ghost set-row-add"
          onClick={() => setExtraSlotCount((c) => c + 1)}
        >
          + Add extra set
        </button>
      )}
      {progressBadge && (
        <p role="status" className="status-badge">
          {BADGE_LABEL[progressBadge]}
        </p>
      )}
    </div>
  )
}

function WeightRow({
  row,
  rowLabel,
  rowNumber,
  slot,
  date,
  weekNumber,
  suggestedWeight,
}: {
  row: SetRow
  rowLabel: string
  rowNumber: number
  slot: ResolvedSlot
  date: string
  weekNumber: number
  suggestedWeight: number | null
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
    if (isSubmitting || (!row.set && !row.canLog)) return
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

  const status: 'logged' | 'open' = row.set ? 'logged' : 'open'

  return (
    <div className="set-row" data-status={status}>
      <span className="set-row-number">{rowNumber}</span>
      <div className="set-row-fields">
        <div className="set-row-field">
          <label htmlFor={weightId}>Weight (lbs) — {rowLabel}</label>
          <input
            id={weightId}
            className="field"
            type="number"
            value={weight}
            placeholder={!row.set && suggestedWeight !== null ? String(suggestedWeight) : undefined}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="set-row-field">
          <label htmlFor={repsId}>Reps — {rowLabel}</label>
          <input
            id={repsId}
            className="field"
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
      </div>
      <span className="set-row-status" aria-hidden="true">
        {row.set ? '✓' : '○'}
      </span>
      <button
        type="button"
        className="btn btn-primary set-row-save"
        onClick={handleSave}
        disabled={isSubmitting || (!row.set && !row.canLog)}
      >
        {row.set ? 'Update' : 'Log set'}
      </button>
      {prMessage && (
        <p role="status" className="pr-badge set-row-pr">
          <span aria-hidden="true">★</span> {prMessage}
        </p>
      )}
    </div>
  )
}

function SimpleValueSlotForm({ slot, date, weekNumber }: ProgramSlotCardProps) {
  const [extraRowRequestCount, setExtraRowRequestCount] = useState(0)
  const programExerciseId = slot.programExercise.id!
  const workingTargets = slot.prescription?.workingTargets ?? []

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

  const lastTarget = workingTargets[workingTargets.length - 1] ?? 0
  const loggedExtraCount = Math.max(0, loggedValues.length - workingTargets.length)
  // `extraRowRequestCount` only ever grows (clicking "+ Add extra set" bumps
  // it, nothing decrements it), so how many extra rows to render is purely
  // derived from how far ahead of the logged data it currently is — mirrors
  // WeightSlotForm's `extraSlotCount`/`pendingCount` pattern.
  const extraRowCount = Math.max(extraRowRequestCount, loggedExtraCount)
  const pendingExtraCount = Math.max(0, extraRowRequestCount - loggedExtraCount)

  const rows = [
    ...workingTargets.map((target, i) => ({ index: i, target })),
    ...Array.from({ length: extraRowCount }, (_, i) => ({
      index: workingTargets.length + i,
      target: lastTarget,
    })),
  ]

  return (
    <div className="slot-form">
      {lastWeekValue !== undefined && <p className="slot-form-last-week">Last week: {lastWeekValue}</p>}
      <div className="set-row-grid">
        {rows.map((row) => (
          <SimpleValueRow
            key={row.index}
            index={row.index}
            target={row.target}
            loggedValue={row.index < loggedValues.length ? loggedValues[row.index] : null}
            canLog={row.index === loggedValues.length}
            programExerciseId={programExerciseId}
            date={date}
            weekNumber={weekNumber}
          />
        ))}
      </div>
      {/* No working targets at all (e.g. no prescription for this week) means
          there's no target value to pre-fill an extra row with — lastTarget
          would fall back to 0, which would render as a nonsensical target. */}
      {pendingExtraCount === 0 && lastTarget > 0 && (
        <button
          type="button"
          className="btn btn-ghost set-row-add"
          onClick={() => setExtraRowRequestCount((c) => c + 1)}
        >
          + Add extra set
        </button>
      )}
      {progressBadge && (
        <p role="status" className="status-badge">
          {BADGE_LABEL[progressBadge]}
        </p>
      )}
    </div>
  )
}

function SimpleValueRow({
  index,
  target,
  loggedValue,
  canLog,
  programExerciseId,
  date,
  weekNumber,
}: {
  index: number
  target: number
  loggedValue: number | null
  canLog: boolean
  programExerciseId: number
  date: string
  weekNumber: number
}) {
  const [value, setValue] = useState(loggedValue !== null ? String(loggedValue) : String(target))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputId = `value-${programExerciseId}-${index}`

  // Sync the displayed value from the persisted `loggedValue` whenever it
  // changes — on initial arrival from the live query, and after this row's
  // own Update/Log write resolves. Effects only run when the value actually
  // changes, so a draft the user is still typing (not yet saved) is never
  // clobbered by an unrelated re-render.
  useEffect(() => {
    if (loggedValue !== null) setValue(String(loggedValue))
  }, [loggedValue])

  async function handleSave() {
    if (isSubmitting || (loggedValue === null && !canLog)) return
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) return

    setIsSubmitting(true)
    try {
      if (loggedValue !== null) {
        await updateProgramLogValue(programExerciseId, date, index, numValue)
      } else {
        await appendProgramLogValue(programExerciseId, date, weekNumber, numValue)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const status: 'logged' | 'open' = loggedValue !== null ? 'logged' : 'open'

  return (
    <div className="set-row" data-status={status}>
      <span className="set-row-number">{index + 1}</span>
      <div className="set-row-fields">
        <div className="set-row-field">
          <label htmlFor={inputId}>
            Set {index + 1} (target {target})
          </label>
          <input
            id={inputId}
            className="field"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      </div>
      <span className="set-row-status" aria-hidden="true">
        {loggedValue !== null ? '✓' : '○'}
      </span>
      <button
        type="button"
        className="btn btn-primary set-row-save"
        onClick={handleSave}
        disabled={isSubmitting || (loggedValue === null && !canLog)}
      >
        {loggedValue !== null ? 'Update' : 'Log set'}
      </button>
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
    <div className="slot-form">
      <p className="slot-form-last-week">
        Logged today: {loggedCategories.length > 0 ? loggedCategories.join(', ') : 'none'}
      </p>
      {(capReached || rejectedByCap) && (
        <p className="status-badge">
          You've logged {categoriesToPick} categories today — the max for this exercise
        </p>
      )}
      <div className="category-picker">
        {categoryOptions.map((category) => {
          const alreadyLogged = loggedCategories.includes(category.categoryLabel)
          const disabled = capReached && !alreadyLogged
          const selected = selectedCategory === category.categoryLabel
          return (
            <button
              key={category.categoryLabel}
              type="button"
              className={`pill category-pill${selected ? ' pill-selected' : ''}`}
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
        <div className="category-detail">
          {lastWeekCategoryValue !== undefined && (
            <p className="slot-form-last-week">
              Last week ({selectedCategory}): {lastWeekCategoryValue}
            </p>
          )}
          <label htmlFor={`exercise-${programExerciseId}`}>Exercise</label>
          <select
            id={`exercise-${programExerciseId}`}
            className="field"
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
            className="field"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSubmitting}>
            Save
          </button>
          {progressBadge && (
            <p role="status" className="status-badge">
              {BADGE_LABEL[progressBadge]}
            </p>
          )}
          {loggedCategories.includes(selectedCategory) && <p>{selectedCategory} logged</p>}
        </div>
      )}
    </div>
  )
}
