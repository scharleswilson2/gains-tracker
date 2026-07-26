import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgramSlotCard } from './ProgramSlotCard'
import { addExercise } from '../db/exercises'
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

  it('shows TEST instead of numeric targets when the prescription is a test week', async () => {
    const exerciseId = await addExercise('Test Vertical Jump')
    const slot = makeSlot(
      { exerciseId, measureType: 'bodyweight_reps' },
      { id: 5, programExerciseId: 5, weekNumber: 4, rir: null, warmupTargets: [], workingTargets: [], isTest: true }
    )

    render(<ProgramSlotCard slot={slot} date="2026-07-20" weekNumber={4} />)

    expect(screen.getByText(/TEST/)).toBeInTheDocument()
  })
})
