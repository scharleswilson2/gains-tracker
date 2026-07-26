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
  it('logs a weight set via the weight-type form and shows a PR badge', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Front Squat')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight', tempo: '4/1/0' },
      { id: 1, programExerciseId: 1, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/weight/i), '225')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
  })

  it('shows a warmup checkbox only when the week has warmup targets, and does not flag warmups as PRs', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Bench Press')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 2, programExerciseId: 2, weekNumber: 1, rir: 'M', warmupTargets: [5, 4], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    const warmupCheckbox = screen.getByLabelText(/warmup/i)
    await user.click(warmupCheckbox)
    await user.type(screen.getByLabelText(/weight/i), '45')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
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

  it('logs a weight set with an RPE value and persists it on the underlying set', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Overhead Press')
    const slot = makeSlot(
      { exerciseId, measureType: 'weight' },
      { id: 6, programExerciseId: 6, weekNumber: 1, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-06" weekNumber={1} />)

    await user.type(screen.getByLabelText(/weight/i), '135')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.type(screen.getByLabelText(/rpe/i), '8')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    await screen.findByText(/pr!/i)
    const sets = await db.sets.toArray()
    expect(sets.some((s) => s.weightLbs === 135 && s.reps === 5 && s.rpe === 8)).toBe(true)
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
      { id: 1, programExerciseId: 50, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(await screen.findByText(/Last week: 205 lbs x 5/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight/i), '215')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

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
      { id: 2, programExerciseId: 51, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    await user.type(screen.getByLabelText(/weight/i), '205')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

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
      { id: 3, programExerciseId: 52, weekNumber: 4, rir: 'M', warmupTargets: [], workingTargets: [3, 3, 3, 5], isTest: false }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    await user.type(screen.getByLabelText(/weight/i), '195')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

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
})
