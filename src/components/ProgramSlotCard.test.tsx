import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgramSlotCard } from './ProgramSlotCard'
import { addExercise } from '../db/exercises'
import { getOrCreateSessionForDate, getOrCreateExerciseEntry, addSet } from '../db/workouts'
import { logCategoryChoice, upsertProgramLogEntry } from '../db/programLogEntries'
import { db } from '../db/schema'
import type { ResolvedSlot } from '../db/programExercises'

function makeSlot(overrides: Partial<ResolvedSlot['programExercise']>, prescription: ResolvedSlot['prescription']): ResolvedSlot {
  return {
    programExercise: {
      id: 1,
      dayId: 1,
      exerciseId: 1,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
      ...overrides,
    },
    exerciseName: 'Test Exercise',
    prescription,
  }
}

describe('ProgramSlotCard', () => {
  it('logs the first prescribed set row and shows a PR badge on that row', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Front Squat')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight', tempo: '4/1/0' },
      { id: 1, programExerciseId: 1, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '225')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    // Four unlogged working rows all render a "Log set" button at this
    // point (workingTargets has 4 entries), so this targets the first one —
    // the row we just filled in — rather than assuming a single match.
    await user.click(screen.getAllByRole('button', { name: /log set/i })[0])

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
  })

  it('renders a warmup row before the working rows when the week has warmup targets, and does not flag a warmup as a PR', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Bench Press')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 2, programExerciseId: 2, weekNumber: 1, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    expect(screen.getByLabelText(/weight \(lbs\) — warmup 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/weight \(lbs\) — warmup 2/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — warmup 1/i), '45')
    await user.clear(screen.getByLabelText(/reps — warmup 1/i))
    await user.type(screen.getByLabelText(/reps — warmup 1/i), '5')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[0])

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
  })

  it('lets an already-logged row be edited independently via Update', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Editable Row')
    const priorSession = await getOrCreateSessionForDate('2026-07-06')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 8, 1)
    const setId = await addSet(priorEntry, 100, 3)

    const slot = makeSlot(
      { id: 8, exerciseId, measureType: 'weight' },
      { id: 1, programExerciseId: 8, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    // The row is unlogged on first paint (the live query resolving with the
    // prior set is async), so wait for the pre-filled value to actually
    // arrive before capturing a stable input reference — grabbing it too
    // early risks holding a reference to a node from before the row's key
    // (based on the now-loaded set id) settles.
    await waitFor(() => expect(screen.getByLabelText(/weight \(lbs\) — set 1/i)).toHaveValue(100))
    const weightInput = screen.getByLabelText(/weight \(lbs\) — set 1/i)

    await user.clear(weightInput)
    await user.type(weightInput, '105')
    await user.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(async () => {
      const updated = await db.sets.get(setId)
      expect(updated?.weightLbs).toBe(105)
    })
  })

  it('adds an extra set row beyond the prescription via "+ Add extra set"', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Extra Set')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 9, programExerciseId: 9, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    // A row's working-vs-extra classification is positional (the Nth
    // chronologically-logged working set fills row N), so the prescribed
    // row must be logged first — otherwise the "extra" set would itself
    // become row 1 instead of landing beyond it.
    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '90')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '3')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[0])
    await waitFor(() => expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /add extra set/i }))
    expect(screen.getByLabelText(/weight \(lbs\) — set 2/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 2/i), '95')
    await user.clear(screen.getByLabelText(/reps — set 2/i))
    await user.type(screen.getByLabelText(/reps — set 2/i), '8')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    // The typed value is already 95 before the save round-trip completes
    // (it's just controlled input state), so that alone isn't a reliable
    // signal the save finished. Wait for "+ Add extra set" to reappear —
    // it's hidden while `showExtraRow` is true and only comes back via the
    // row's `onSaved` callback once the set has actually been persisted.
    await waitFor(() => expect(screen.getByRole('button', { name: /add extra set/i })).toBeInTheDocument())
    expect(screen.getByLabelText(/weight \(lbs\) — set 2/i)).toHaveValue(95)
  })

  it('logs a bodyweight_reps set via the simple numeric form', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Depth Drop')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 3, programExerciseId: 3, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/value/i), '3')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/3$/)).toBeInTheDocument()
  })

  it('logs a category_choice (Arm Farm) entry with the picked category and exercise', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Arm Farm')
    const slot = makeSlot(
      {
        exerciseId,
        measureType: 'category_choice',
        categoryOptions: [
          { categoryLabel: 'Triceps', exercises: ['Cable Push Downs', 'OH Tricep Ext'] },
          { categoryLabel: 'Biceps', exercises: ['Hammer Curl', 'Zottman Curl'] },
        ],
        categoriesToPick: 3,
      },
      { id: 4, programExerciseId: 4, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.click(screen.getByRole('button', { name: 'Triceps' }))
    await user.selectOptions(screen.getByLabelText(/exercise/i), 'Cable Push Downs')
    await user.type(screen.getByLabelText(/value/i), '12')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText(/Triceps.*logged/i)).toBeInTheDocument()
  })

  it('disables not-yet-logged category buttons once categoriesToPick is reached, but keeps already-logged ones enabled', async () => {
    const exerciseId = await addExercise('Test Arm Farm Capped')
    const slot = makeSlot(
      {
        id: 7,
        exerciseId,
        measureType: 'category_choice',
        categoryOptions: [
          { categoryLabel: 'Triceps', exercises: ['Cable Push Downs'] },
          { categoryLabel: 'Biceps', exercises: ['Hammer Curl'] },
          { categoryLabel: 'Forearms', exercises: ['Wrist Curl'] },
          { categoryLabel: 'Shoulders', exercises: ['Lateral Raise'] },
        ],
        categoriesToPick: 3,
      },
      { id: 7, programExerciseId: 7, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [], isTest: false }
    )

    for (const category of ['Triceps', 'Biceps', 'Forearms']) {
      await upsertProgramLogEntry({
        programExerciseId: 7,
        date: '2026-07-06',
        weekNumber: 1,
        values: [10],
        isWarmup: [false],
        chosenCategory: category,
        chosenExercise: 'placeholder',
      })
    }

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Shoulders' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Triceps' })).toBeEnabled()
  })

  it('shows TEST instead of numeric targets when the prescription is a test week', async () => {
    const exerciseId = await addExercise('Test Vertical Jump')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 5, programExerciseId: 5, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [], isTest: true }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(screen.getByText(/TEST/)).toBeInTheDocument()
  })

  it('shows last week\'s result and a "Beat last week!" badge when this week beats it', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Beat Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-13')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 50, 3)
    await addSet(priorEntry, 205, 5)

    const slot = makeSlot(
      { id: 50, exerciseId, measureType: 'weight' },
      { id: 1, programExerciseId: 50, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(await screen.findByText(/Last week: 205 lbs x 5/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '215')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
  })

  it('shows "Matched last week" when this week\'s set equals last week\'s', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Matched Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-13')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 51, 3)
    await addSet(priorEntry, 205, 5)

    const slot = makeSlot(
      { id: 51, exerciseId, measureType: 'weight' },
      { id: 2, programExerciseId: 51, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '205')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    expect(await screen.findByText('Matched last week')).toBeInTheDocument()
  })

  it('shows "Fell short of last week" when this week is lighter', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Fell Short Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-13')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 52, 3)
    await addSet(priorEntry, 205, 5)

    const slot = makeSlot(
      { id: 52, exerciseId, measureType: 'weight' },
      { id: 3, programExerciseId: 52, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '195')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    expect(await screen.findByText('Fell short of last week')).toBeInTheDocument()
  })

  it('omits the last-week line and badge when nothing was logged last week', async () => {
    const exerciseId = await addExercise('Test No Prior Week')
    const slot = makeSlot(
      { id: 53, exerciseId, measureType: 'weight' },
      { id: 4, programExerciseId: 53, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={1} />)

    expect(screen.queryByText(/Last week/)).not.toBeInTheDocument()
  })

  it('shows last week\'s value and a beat badge for a simple-value slot', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Depth Drop Progress')
    await upsertProgramLogEntry({
      programExerciseId: 54,
      date: '2026-07-13',
      weekNumber: 3,
      values: [3],
      isWarmup: [false],
    })
    const slot = makeSlot(
      { id: 54, exerciseId, measureType: 'bodyweight_reps' },
      { id: 5, programExerciseId: 54, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(await screen.findByText('Last week: 3')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/value/i), '4')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
  })

  it('shows last week\'s value for a matching Arm Farm category, omitted for a non-matching one', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Arm Farm Progress')
    await logCategoryChoice({
      programExerciseId: 55,
      date: '2026-07-13',
      weekNumber: 3,
      value: 10,
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
      categoriesToPick: 3,
    })
    const slot = makeSlot(
      {
        id: 55,
        exerciseId,
        measureType: 'category_choice',
        categoryOptions: [
          { categoryLabel: 'Triceps', exercises: ['Cable Push Downs'] },
          { categoryLabel: 'Biceps', exercises: ['Hammer Curl'] },
        ],
        categoriesToPick: 3,
      },
      { id: 6, programExerciseId: 55, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    await user.click(screen.getByRole('button', { name: 'Biceps' }))
    expect(screen.queryByText(/Last week/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Triceps' }))
    expect(await screen.findByText('Last week (Triceps): 10')).toBeInTheDocument()
  })

  it('hides the progress badge until the full prescribed set count has been logged this week', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Deferred Badge Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-13')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 56, 3)
    await addSet(priorEntry, 215, 5)

    const slot = makeSlot(
      { id: 56, exerciseId, measureType: 'weight' },
      { id: 7, programExerciseId: 56, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(await screen.findByText(/Last week: 215 lbs x 5/)).toBeInTheDocument()

    // Once a row's set is persisted its button flips from "Log set" to
    // "Update" and drops out of this query, so the *first* remaining "Log
    // set" button is always the next not-yet-logged row — as long as we
    // wait for the previous row's save (and the live-query refresh it
    // triggers) to actually land before moving on, rather than assuming a
    // fixed index that would go stale as earlier rows convert.
    for (let i = 1; i <= 3; i++) {
      await user.type(screen.getByLabelText(new RegExp(`weight \\(lbs\\) — set ${i}$`, 'i')), '225')
      await user.clear(screen.getByLabelText(new RegExp(`reps — set ${i}$`, 'i')))
      await user.type(screen.getByLabelText(new RegExp(`reps — set ${i}$`, 'i')), '3')
      await user.click(screen.getAllByRole('button', { name: /log set/i })[0])
      await waitFor(() => expect(screen.getAllByRole('button', { name: /log set/i })).toHaveLength(4 - i))
    }

    expect(screen.queryByText('Beat last week!')).not.toBeInTheDocument()
    expect(screen.queryByText('Fell short of last week')).not.toBeInTheDocument()
    expect(screen.queryByText('Matched last week')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 4/i), '225')
    await user.clear(screen.getByLabelText(/reps — set 4/i))
    await user.type(screen.getByLabelText(/reps — set 4/i), '5')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[0])

    expect(await screen.findByText('Beat last week!')).toBeInTheDocument()
  })
})
