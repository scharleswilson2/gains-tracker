import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    // "+ Add extra set" is gated behind the prescribed rows being complete
    // (see the next test), so the prescribed row must be logged first.
    expect(screen.queryByRole('button', { name: /add extra set/i })).not.toBeInTheDocument()

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
    // `pendingCount` only drops back to 0 once the live query's `extraRows`
    // actually reflects the newly-persisted set.
    await waitFor(() => expect(screen.getByRole('button', { name: /add extra set/i })).toBeInTheDocument())
    expect(screen.getByLabelText(/weight \(lbs\) — set 2/i)).toHaveValue(95)
  })

  it('hides "+ Add extra set" until every prescribed working row is logged', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Gate Extra Set')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 12, programExerciseId: 12, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    expect(screen.queryByRole('button', { name: /add extra set/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '90')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '3')
    await user.click(screen.getAllByRole('button', { name: /log set/i })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: /update/i })).toHaveLength(1))

    // One of two prescribed rows logged — still gated.
    expect(screen.queryByRole('button', { name: /add extra set/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight \(lbs\) — set 2/i), '90')
    await user.clear(screen.getByLabelText(/reps — set 2/i))
    await user.type(screen.getByLabelText(/reps — set 2/i), '3')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add extra set/i })).toBeInTheDocument()
    )
  })

  it('disables "Log set" on every not-yet-logged row except the next one, so logging cannot land on the wrong row', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Out Of Order Guard')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 13, programExerciseId: 13, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const logButtons = screen.getAllByRole('button', { name: /log set/i })
    expect(logButtons).toHaveLength(3)
    expect(logButtons[0]).toBeEnabled()
    expect(logButtons[1]).toBeDisabled()
    expect(logButtons[2]).toBeDisabled()

    // Filling Set 3's own inputs and clicking its (disabled) button must
    // not log anything under Set 1 — attempting the click is a no-op.
    await user.type(screen.getByLabelText(/weight \(lbs\) — set 3/i), '200')
    await user.click(logButtons[2])
    expect(screen.getByLabelText(/weight \(lbs\) — set 1/i)).toHaveValue(null)
    expect(screen.getAllByRole('button', { name: /log set/i })).toHaveLength(3)

    // Logging Set 1 for real advances the guard to Set 2.
    await user.type(screen.getByLabelText(/weight \(lbs\) — set 1/i), '90')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '3')
    await user.click(logButtons[0])

    await waitFor(() => {
      const remaining = screen.getAllByRole('button', { name: /log set/i })
      expect(remaining).toHaveLength(2)
      expect(remaining[0]).toBeEnabled()
      expect(remaining[1]).toBeDisabled()
    })
    expect(screen.getByLabelText(/weight \(lbs\) — set 1/i)).toHaveValue(90)
  })

  it('does not show a different slot\'s logged set as if it were this slot\'s Set 1', async () => {
    const exerciseId = await addExercise('Test Slot Scoped Rows')
    const priorSession = await getOrCreateSessionForDate('2026-07-06')
    // A different program slot (id 998) logged this same exercise on the
    // same day — without programExerciseId scoping in the underlying
    // query, this slot's Set 1 row would incorrectly show this set.
    const otherSlotEntry = await getOrCreateExerciseEntry(priorSession, exerciseId, 998, 1)
    await addSet(otherSlotEntry, 999, 9)

    // Also seed a genuine "last week" result for *this* slot (id 14) so the
    // test has a reliable signal that WeightSlotForm's live queries have
    // actually resolved at least once before asserting the negative case —
    // without this, "Set 1 is empty" would trivially pass on the very
    // first synchronous render, before the (possibly buggy) query for the
    // other slot's set has had a chance to come back and populate it.
    const lastWeekSession = await getOrCreateSessionForDate('2026-06-29')
    const lastWeekEntry = await getOrCreateExerciseEntry(lastWeekSession, exerciseId, 14, 1)
    await addSet(lastWeekEntry, 205, 5)

    const slot = makeSlot(
      { id: 14, exerciseId, measureType: 'weight' },
      { id: 9, programExerciseId: 14, weekNumber: 2, rir: 'M', warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={2} />)

    expect(await screen.findByText(/Last week: 205 lbs x 5/)).toBeInTheDocument()

    const weightInput = screen.getByLabelText(/weight \(lbs\) — set 1/i)
    expect(weightInput).toHaveValue(null)
    expect(screen.getByRole('button', { name: /log set/i })).toBeEnabled()
    expect(screen.queryByText('999')).not.toBeInTheDocument()
  })

  it('checking the first row logs its prescribed target value', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Depth Drop')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 3, programExerciseId: 3, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const row1 = screen.getByLabelText(/set 1 \(target 3\)/i)
    await user.click(row1)

    await waitFor(() => expect(row1).toBeChecked())
    expect(screen.getByLabelText(/set 2 \(target 3\)/i)).not.toBeChecked()
  })

  it('does not double-log when two change events land on the same row before the first write resolves', async () => {
    const exerciseId = await addExercise('Test Rapid Double Check')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 13, programExerciseId: 13, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const row1 = screen.getByLabelText(/set 1 \(target 3\)/i)
    // fireEvent (unlike userEvent) doesn't await between events, so both
    // change events fire before the first appendProgramLogValue write (and
    // the live-query refresh it triggers) resolves — reproducing the race
    // the isSubmitting guard closes.
    fireEvent.click(row1)
    fireEvent.click(row1)

    await waitFor(() => expect(row1).toBeChecked())
    // Only row 1 should be checked — a double-fire must not silently log a
    // second set and check row 2 on the user's behalf.
    expect(screen.getByLabelText(/set 2 \(target 3\)/i)).not.toBeChecked()
  })

  it('unchecking the most recently checked row removes it, but an earlier row cannot be unchecked', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Uncheck Row')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 10, programExerciseId: 10, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3, 4], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const row1 = screen.getByLabelText(/set 1 \(target 3\)/i)
    const row2 = screen.getByLabelText(/set 2 \(target 4\)/i)
    await user.click(row1)
    await waitFor(() => expect(row1).toBeChecked())
    await user.click(row2)
    await waitFor(() => expect(row2).toBeChecked())

    await user.click(row2)
    await waitFor(() => expect(row2).not.toBeChecked())
    expect(row1).toBeChecked()
  })

  it('adds an extra checkbox row beyond the prescription, logging the last target value when checked', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Extra Bodyweight Row')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 11, programExerciseId: 11, weekNumber: 1, rir: null, warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.click(screen.getByLabelText(/set 1 \(target 3\)/i))
    await waitFor(() => expect(screen.getByLabelText(/set 1 \(target 3\)/i)).toBeChecked())

    await user.click(screen.getByRole('button', { name: /add extra set/i }))
    const extraRow = screen.getByLabelText(/set 2 \(target 3\)/i)
    await user.click(extraRow)

    await waitFor(() => expect(extraRow).toBeChecked())
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

  it('shows last week\'s value and a matched badge for a simple-value slot', async () => {
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

    // Checkbox rows log the exact prescribed target with no numeric
    // override, so this week's achievable outcome is fixed by the
    // prescription rather than typed input. Prescription targets are
    // [3, 3] here — same as last week's 3 — so completing them (including
    // an extra row, which also logs the last defined target) can only ever
    // match, never beat, last week's value. See the next test for a
    // prescription that legitimately beats last week.
    await user.click(screen.getByLabelText(/set 1 \(target 3\)/i))
    await user.click(screen.getByLabelText(/set 2 \(target 3\)/i))
    await user.click(screen.getByRole('button', { name: /add extra set/i }))
    await user.click(screen.getByLabelText(/set 3 \(target 3\)/i))

    expect(await screen.findByText('Matched last week')).toBeInTheDocument()
  })

  it('shows a beat badge for a simple-value slot when this week\'s prescribed target exceeds last week\'s value', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Depth Drop Beat Progress')
    await upsertProgramLogEntry({
      programExerciseId: 56,
      date: '2026-07-13',
      weekNumber: 3,
      values: [2],
      isWarmup: [false],
    })
    const slot = makeSlot(
      { id: 56, exerciseId, measureType: 'bodyweight_reps' },
      { id: 8, programExerciseId: 56, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [3], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(await screen.findByText('Last week: 2')).toBeInTheDocument()

    await user.click(screen.getByLabelText(/set 1 \(target 3\)/i))

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
