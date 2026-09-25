import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { History } from './History'
import { getOrCreateSessionForDate, getOrCreateExerciseEntry, addSet } from '../db/workouts'
import { getOrCreateCatchingSessionForDate } from '../db/catching'
import { addBodyweightEntry } from '../db/bodyweight'
import { addExercise } from '../db/exercises'
import { addProgramDay, createProgram } from '../db/programs'
import { addProgramExercise } from '../db/programExercises'
import { upsertProgramLogEntry } from '../db/programLogEntries'

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>
  )
}

describe('History', () => {
  it('lists all session types combined, newest first', async () => {
    const exerciseId = await addExercise('Test Combined Row Lift')
    const session = await getOrCreateSessionForDate('2026-07-10')
    const entry = await getOrCreateExerciseEntry(session, exerciseId)
    await addSet(entry, 100, 5)
    await getOrCreateCatchingSessionForDate('2026-07-15')
    await addBodyweightEntry('2026-07-20', 190)

    renderHistory()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('2026-07-20')
    expect(items[1]).toHaveTextContent('2026-07-15')
    expect(items[2]).toHaveTextContent('2026-07-10')
  })

  it('groups every exercise logged on a date into one clickable "Lift session" row, not one row per exercise', async () => {
    const exerciseId1 = await addExercise('Test Grouped Squat')
    const exerciseId2 = await addExercise('Test Grouped Bench')
    const session = await getOrCreateSessionForDate('2026-07-15')
    const entry1 = await getOrCreateExerciseEntry(session, exerciseId1)
    await addSet(entry1, 200, 5)
    const entry2 = await getOrCreateExerciseEntry(session, exerciseId2)
    await addSet(entry2, 150, 5)

    renderHistory()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Lift session (2 exercises)')
    expect(screen.getByRole('link', { name: /lift session/i })).toHaveAttribute(
      'href',
      '/history/2026-07-15'
    )
  })

  it('includes a program-log exercise in the same day\'s lift session count', async () => {
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

    renderHistory()

    expect(await screen.findByText(/Lift session \(1 exercise\)/)).toBeInTheDocument()
  })

  it('does not show a lift session row for a session with no sets logged', async () => {
    const exerciseId = await addExercise('Test Empty Entry')
    const session = await getOrCreateSessionForDate('2026-07-10')
    await getOrCreateExerciseEntry(session, exerciseId) // entry created, no set ever added

    renderHistory()

    await addBodyweightEntry('2026-07-20', 190) // gives the live query something to resolve
    expect(await screen.findByText(/Bodyweight/)).toBeInTheDocument()
    expect(screen.queryByText(/Lift session/)).not.toBeInTheDocument()
  })
})
