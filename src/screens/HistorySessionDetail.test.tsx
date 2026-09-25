import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HistorySessionDetail } from './HistorySessionDetail'
import { getOrCreateSessionForDate, getOrCreateExerciseEntry, addSet } from '../db/workouts'
import { addExercise } from '../db/exercises'
import { addProgramDay, createProgram } from '../db/programs'
import { addProgramExercise } from '../db/programExercises'
import { upsertProgramLogEntry, logCategoryChoice } from '../db/programLogEntries'

function renderDetail(date: string) {
  return render(
    <MemoryRouter initialEntries={[`/history/${date}`]}>
      <Routes>
        <Route path="/history/:date" element={<HistorySessionDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('HistorySessionDetail', () => {
  it('lists each weighted exercise logged that day with its sets, not the whole history at once', async () => {
    const squatId = await addExercise('Test Detail Squat')
    const benchId = await addExercise('Test Detail Bench')
    const session = await getOrCreateSessionForDate('2026-07-15')
    const squatEntry = await getOrCreateExerciseEntry(session, squatId)
    await addSet(squatEntry, 225, 5)
    await addSet(squatEntry, 225, 5)
    const benchEntry = await getOrCreateExerciseEntry(session, benchId)
    await addSet(benchEntry, 185, 8)

    // A different day's lift must not leak into this day's detail view.
    const otherDaySession = await getOrCreateSessionForDate('2026-07-16')
    const otherEntry = await getOrCreateExerciseEntry(otherDaySession, squatId)
    await addSet(otherEntry, 999, 1)

    renderDetail('2026-07-15')

    expect(await screen.findByText(/225 lbs x 5, 225 lbs x 5/)).toBeInTheDocument()
    expect(screen.getByText(/185 lbs x 8/)).toBeInTheDocument()
    expect(screen.queryByText(/999/)).not.toBeInTheDocument()
  })

  it('marks a warmup set inline', async () => {
    const exerciseId = await addExercise('Test Detail Warmup')
    const session = await getOrCreateSessionForDate('2026-07-15')
    const entry = await getOrCreateExerciseEntry(session, exerciseId)
    await addSet(entry, 135, 5, true)
    await addSet(entry, 225, 5, false)

    renderDetail('2026-07-15')

    expect(await screen.findByText(/135 lbs x 5 \(warmup\), 225 lbs x 5/)).toBeInTheDocument()
  })

  it('includes a program-log (bodyweight/time/distance) exercise alongside weighted ones', async () => {
    const exerciseId = await addExercise('Test Detail Plank')
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

    renderDetail('2026-07-15')

    expect(await screen.findByText('Test Detail Plank')).toBeInTheDocument()
    expect(screen.getByText(/20, 20, 20/)).toBeInTheDocument()
  })

  it('shows the chosen category and exercise for a category_choice slot', async () => {
    const exerciseId = await addExercise('Test Detail Arm Farm')
    const programId = await createProgram('Test Program', '2026-06-29', '2026-07-24')
    const dayId = await addProgramDay(programId, 5)
    const slotId = await addProgramExercise({
      dayId,
      exerciseId,
      blockLabel: 'C',
      orderIndex: 0,
      measureType: 'category_choice',
      eachSide: false,
      tempo: null,
      categoryOptions: [{ categoryLabel: 'Triceps', exercises: ['Cable Push Downs'] }],
      categoriesToPick: 1,
    })
    await logCategoryChoice({
      programExerciseId: slotId,
      date: '2026-07-15',
      weekNumber: 1,
      value: 12,
      chosenCategory: 'Triceps',
      chosenExercise: 'Cable Push Downs',
      categoriesToPick: 1,
    })

    renderDetail('2026-07-15')

    expect(await screen.findByText(/Triceps: Cable Push Downs — 12/)).toBeInTheDocument()
  })

  it('shows nothing for a date with no activity', async () => {
    renderDetail('2026-01-01')

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(await screen.findByText('2026-01-01')).toBeInTheDocument()
  })
})
