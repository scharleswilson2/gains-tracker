import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Program } from './Program'
import { addExercise } from '../db/exercises'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription } from '../db/programExercises'

vi.mock('../lib/dates', () => ({ todayIso: () => '2026-06-29' }))

describe('Program', () => {
  it('shows the current week\'s schedule by default, with exercise names and targets', async () => {
    const exerciseId = await addExercise('Test Front Squat')
    const programId = await createProgram('July Program', '2026-06-29', '2026-07-24')
    await addProgramWeek(programId, 1, '2026-06-29', '2026-07-03')
    const dayId = await addProgramDay(programId, 1)
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

    render(<Program />)

    expect(await screen.findByText('Test Front Squat')).toBeInTheDocument()
    expect(screen.getByText(/Working: 3, 3, 3, 5/)).toBeInTheDocument()
  })

  it('lets the user browse a past program', async () => {
    const user = userEvent.setup()
    const exerciseId1 = await addExercise('Test Current Exercise')
    const currentProgramId = await createProgram('Current Program', '2026-06-29', '2026-07-24')
    await addProgramWeek(currentProgramId, 1, '2026-06-29', '2026-07-03')
    const currentDayId = await addProgramDay(currentProgramId, 1)
    await addProgramExercise({
      dayId: currentDayId,
      exerciseId: exerciseId1,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    const exerciseId2 = await addExercise('Test Old Program Exercise')
    const oldProgramId = await createProgram('Old Program', '2026-01-05', '2026-02-01')
    await addProgramWeek(oldProgramId, 1, '2026-01-05', '2026-01-09')
    const oldDayId = await addProgramDay(oldProgramId, 1)
    await addProgramExercise({
      dayId: oldDayId,
      exerciseId: exerciseId2,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'bodyweight_reps',
      eachSide: false,
      tempo: null,
    })

    render(<Program />)

    expect(await screen.findByText('Test Current Exercise')).toBeInTheDocument()

    await user.selectOptions(await screen.findByLabelText(/program/i), 'Old Program')

    expect(await screen.findByText('Test Old Program Exercise')).toBeInTheDocument()
    expect(screen.queryByText('Test Current Exercise')).not.toBeInTheDocument()
  })
})
