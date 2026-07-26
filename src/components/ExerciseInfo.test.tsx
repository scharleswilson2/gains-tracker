import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseInfo } from './ExerciseInfo'
import { addExercise } from '../db/exercises'

describe('ExerciseInfo', () => {
  it('shows the description when tapped, and hides it again on a second tap', async () => {
    const user = userEvent.setup()
    await addExercise('Front Squat', undefined, 'A barbell squat held in the front rack.')

    render(<ExerciseInfo name="Front Squat" />)

    expect(screen.queryByText(/front rack/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Front Squat' }))
    expect(await screen.findByText(/front rack/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Front Squat' }))
    expect(screen.queryByText(/front rack/i)).not.toBeInTheDocument()
  })

  it('shows a fallback message when the exercise has no description', async () => {
    const user = userEvent.setup()
    await addExercise('Mystery Move')

    render(<ExerciseInfo name="Mystery Move" />)
    await user.click(screen.getByRole('button', { name: 'Mystery Move' }))
    expect(await screen.findByText(/no description/i)).toBeInTheDocument()
  })
})
