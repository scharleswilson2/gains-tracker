import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription } from '../db/programExercises'

vi.mock('../lib/dates', () => ({ todayIso: () => '2026-07-20' }))

describe('LogLift', () => {
  it('shows last session reference and lets the user log a new PR set', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Back Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-10')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId)
    await addSet(priorEntry, 225, 5)

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Back Squat')
    await user.click(await screen.findByText('Back Squat'))

    expect(await screen.findByText(/last time: 225 x 5/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight/i), '235')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
    expect(await screen.findByText(/235.*5/)).toBeInTheDocument()
  })

  it('does not flag a later same-day set as a PR when it does not beat an earlier same-day set', async () => {
    const user = userEvent.setup()
    await addExercise('Front Squat')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Front Squat')
    await user.click(await screen.findByText('Front Squat'))

    await user.type(screen.getByLabelText(/weight/i), '225')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight/i), '200')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    // Regression test: the old logic excluded ALL of today's sets from the
    // prior-sets comparison, so every same-day set after the first compared
    // against an empty list and looked like a PR. The fixed logic includes
    // already-logged same-day sets, so this lighter second set must NOT be
    // flagged.
    expect(await screen.findByText(/200.*5/)).toBeInTheDocument()
    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
  })

  it('flags a later same-day set as a PR when it beats an earlier same-day set', async () => {
    const user = userEvent.setup()
    await addExercise('Incline Bench')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Incline Bench')
    await user.click(await screen.findByText('Incline Bench'))

    await user.type(screen.getByLabelText(/weight/i), '135')
    await user.type(screen.getByLabelText(/reps/i), '8')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight/i), '145')
    await user.type(screen.getByLabelText(/reps/i), '8')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/145.*8/)).toBeInTheDocument()
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
  })

  it('does not log a set when weight or reps are missing/invalid', async () => {
    const user = userEvent.setup()
    await addExercise('Romanian Deadlift')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Romanian Deadlift')
    await user.click(await screen.findByText('Romanian Deadlift'))

    // Reps left blank -> Number('') is 0, which must not be logged.
    await user.type(screen.getByLabelText(/weight/i), '135')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/135/)).not.toBeInTheDocument()
  })

  async function seedTestProgramDay(dayNumber: number, exerciseId: number) {
    const programId = await createProgram('Test Program', '2026-07-20', '2026-07-24')
    await addProgramWeek(programId, 1, '2026-07-20', '2026-07-24')
    const dayId = await addProgramDay(programId, dayNumber)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: '4/1/0',
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: 'M',
      warmupTargets: [5, 4],
      workingTargets: [3, 3, 3, 5],
      isTest: false,
    })
    return { programId, dayId, slotId }
  }

  it('shows the program day section with a slot when today has an active program day', async () => {
    const exerciseId = await addExercise('Test Program Front Squat')
    await seedTestProgramDay(1, exerciseId) // 2026-07-20 is a Monday = dayNumber 1

    render(<LogLift />)

    expect(await screen.findByText('Test Program Front Squat')).toBeInTheDocument()
    expect(screen.getByText(/Tempo: 4\/1\/0/)).toBeInTheDocument()
  })

  it('still shows the free-form "Log something else" section on a program day', async () => {
    const exerciseId = await addExercise('Test Program Bench')
    await seedTestProgramDay(1, exerciseId)

    render(<LogLift />)

    expect(await screen.findByText(/log something else/i)).toBeInTheDocument()
  })
})
