import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { History } from './History'
import { getOrCreateSessionForDate } from '../db/workouts'
import { getOrCreateCatchingSessionForDate } from '../db/catching'
import { addBodyweightEntry } from '../db/bodyweight'
import { addExercise } from '../db/exercises'
import { addProgramDay, createProgram } from '../db/programs'
import { addProgramExercise } from '../db/programExercises'
import { upsertProgramLogEntry } from '../db/programLogEntries'

describe('History', () => {
  it('lists all session types combined, newest first', async () => {
    await getOrCreateSessionForDate('2026-07-10')
    await getOrCreateCatchingSessionForDate('2026-07-15')
    await addBodyweightEntry('2026-07-20', 190)

    render(<History />)

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('2026-07-20')
    expect(items[1]).toHaveTextContent('2026-07-15')
    expect(items[2]).toHaveTextContent('2026-07-10')
  })

  it('includes a row for a program log entry, alongside the other row types', async () => {
    const exerciseId = await addExercise('Test Copenhagen Plank')
    const programId = await createProgram('Test Program', '2026-06-29', '2026-07-24')
    const dayId = await addProgramDay(programId, 2)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'time',
      eachSide: true,
      tempo: null,
    })
    await upsertProgramLogEntry({
      programExerciseId: slotId,
      date: '2026-07-15',
      weekNumber: 3,
      values: [20, 20, 20],
      isWarmup: [false, false, false],
    })

    render(<History />)

    expect(await screen.findByText(/Test Copenhagen Plank/)).toBeInTheDocument()
  })
})
