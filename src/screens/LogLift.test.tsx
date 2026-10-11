import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription } from '../db/programExercises'
import { db } from '../db/schema'

vi.mock('../lib/dates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dates')>()
  return { ...actual, todayIso: () => '2026-07-20' }
})

describe('LogLift free-form logging', () => {
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

    await user.type(screen.getByLabelText(/^weight/i), '235')
    await user.type(screen.getByLabelText(/^reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
    expect(await screen.findByText(/235.*5/)).toBeInTheDocument()
  })

  it('hides the weight field and logs weightLbs: 0 when "No weight (bodyweight)" is checked', async () => {
    const user = userEvent.setup()
    await addExercise('Push Up')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Push Up')
    await user.click(await screen.findByText('Push Up'))

    await user.click(screen.getByLabelText(/no weight \(bodyweight\)/i))
    expect(screen.queryByLabelText(/^weight/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^reps/i), '20')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/0.*20/)).toBeInTheDocument()
  })

  it('does not log a set when reps are missing/invalid', async () => {
    const user = userEvent.setup()
    await addExercise('Romanian Deadlift')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Romanian Deadlift')
    await user.click(await screen.findByText('Romanian Deadlift'))

    await user.type(screen.getByLabelText(/^weight/i), '135')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(screen.queryByText(/pr!/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/135/)).not.toBeInTheDocument()
  })

  it('does not flag a later same-day set as a PR when it does not beat an earlier same-day set', async () => {
    const user = userEvent.setup()
    await addExercise('Front Squat')

    render(<LogLift />)

    await user.type(await screen.findByLabelText(/exercise/i), 'Front Squat')
    await user.click(await screen.findByText('Front Squat'))

    await user.type(screen.getByLabelText(/^weight/i), '225')
    await user.type(screen.getByLabelText(/^reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^weight/i), '200')
    await user.type(screen.getByLabelText(/^reps/i), '5')
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

    await user.type(screen.getByLabelText(/^weight/i), '135')
    await user.type(screen.getByLabelText(/^reps/i), '8')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^weight/i), '145')
    await user.type(screen.getByLabelText(/^reps/i), '8')
    await user.click(screen.getByRole('button', { name: /add set/i }))

    expect(await screen.findByText(/145.*8/)).toBeInTheDocument()
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()
  })
})

describe('LogLift program day + navigation', () => {
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

  it('navigates to the next day with the next-day arrow', async () => {
    const user = userEvent.setup()
    const exerciseId1 = await addExercise('Test Monday Exercise')
    await seedTestProgramDay(1, exerciseId1) // Monday 2026-07-20

    const exerciseId2 = await addExercise('Test Tuesday Exercise')
    const programId = await createProgram('Second Program', '2026-08-01', '2026-08-05')
    await addProgramWeek(programId, 1, '2026-08-01', '2026-08-05')
    const dayId = await addProgramDay(programId, 2)
    await addProgramExercise({
      dayId,
      exerciseId: exerciseId2,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    render(<LogLift />)

    expect(await screen.findByText('Test Monday Exercise')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next day/i }))

    expect(await screen.findByText('Test Tuesday Exercise')).toBeInTheDocument()
    expect(screen.queryByText('Test Monday Exercise')).not.toBeInTheDocument()
  })

  it('lets you log against a day other than today, using that day\'s computed calendar date', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Loggable Day')
    // Week must actually contain the mocked "today" (2026-07-20) for the
    // week to be live/loggable; day 2's computed date (2026-07-16) is
    // deliberately a different day than today, which is what this test
    // exercises — logging against a non-today day within the live week.
    const programId = await createProgram('July Program', '2026-07-15', '2026-07-21')
    await addProgramWeek(programId, 1, '2026-07-15', '2026-07-21')
    const dayId = await addProgramDay(programId, 2) // dayNumber 2 -> 2026-07-16
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [5],
      isTest: false,
    })

    render(<LogLift />)

    await user.click(await screen.findByRole('button', { name: /previous day/i }))

    await user.type(await screen.findByLabelText(/weight \(lbs\) — set 1/i), '135')
    await user.clear(screen.getByLabelText(/reps — set 1/i))
    await user.type(screen.getByLabelText(/reps — set 1/i), '5')
    await user.click(screen.getByRole('button', { name: /log set/i }))

    await waitFor(async () => {
      const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
      expect(entries).toHaveLength(1)
    })
    const [entry] = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
    const session = await db.workoutSessions.get(entry.sessionId)
    expect(session?.date).toBe('2026-07-16')
    expect(entry.programExerciseId).toBe(slotId)
    expect(entry.weekNumber).toBe(1)
  })

  it('still allows logging on a day in a past week that has already ended', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Stale Week Exercise')
    const programId = await createProgram('Ended Program', '2026-06-01', '2026-06-05')
    await addProgramWeek(programId, 1, '2026-06-01', '2026-06-05')
    const dayId = await addProgramDay(programId, 1)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [5],
      isTest: false,
    })

    render(<LogLift />)

    await user.click(await screen.findByRole('button', { name: /previous day/i }))

    expect(await screen.findByText('Test Stale Week Exercise')).toBeInTheDocument()
    expect(screen.getByText(/2026-06-01/)).toBeInTheDocument()
    expect(await screen.findByLabelText(/weight \(lbs\) — set 1/i)).toBeInTheDocument()
  })

  it('shows the date and disables logging for a week that has not started yet', async () => {
    const exerciseId = await addExercise('Test Future Week Exercise')
    const programId = await createProgram('Future Program', '2026-07-27', '2026-07-31')
    await addProgramWeek(programId, 1, '2026-07-27', '2026-07-31')
    const dayId = await addProgramDay(programId, 1)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
    })
    await addProgramPrescription({
      programExerciseId: slotId,
      weekNumber: 1,
      rir: null,
      warmupTargets: [],
      workingTargets: [5],
      isTest: false,
    })

    render(<LogLift />)

    expect(await screen.findByText('Test Future Week Exercise')).toBeInTheDocument()
    expect(screen.getByText(/2026-07-27/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/weight \(lbs\) — set 1/i)).not.toBeInTheDocument()
  })
})
