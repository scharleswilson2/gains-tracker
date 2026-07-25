import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Progress } from './Progress'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'

describe('Progress', () => {
  it('shows PRs for a selected exercise and lets me log bodyweight', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Back Squat')
    const session1 = await getOrCreateSessionForDate('2026-07-10')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId)
    await addSet(entry1, 225, 5)
    const session2 = await getOrCreateSessionForDate('2026-07-17')
    const entry2 = await getOrCreateExerciseEntry(session2, exerciseId)
    await addSet(entry2, 235, 5)

    render(<Progress />)

    await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Back Squat')

    expect(await screen.findByText(/235 x 5/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/bodyweight/i), '190')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    expect(await screen.findByText(/190/)).toBeInTheDocument()
  })
})
