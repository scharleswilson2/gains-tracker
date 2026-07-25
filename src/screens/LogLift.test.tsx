import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogLift } from './LogLift'
import { addExercise } from '../db/exercises'
import { addSet, getOrCreateExerciseEntry, getOrCreateSessionForDate } from '../db/workouts'

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
})
