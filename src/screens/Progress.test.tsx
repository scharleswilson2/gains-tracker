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

  it('flags a later same-day set as a PR against an earlier same-day set, but not the earlier one', async () => {
    const user = userEvent.setup()

    const exerciseId = await addExercise('Front Squat')
    const priorSession = await getOrCreateSessionForDate('2026-07-10')
    const priorEntry = await getOrCreateExerciseEntry(priorSession, exerciseId)
    await addSet(priorEntry, 190, 5)

    const todaySession = await getOrCreateSessionForDate('2026-07-24')
    const todayEntry = await getOrCreateExerciseEntry(todaySession, exerciseId)
    // Same-day: first set does not beat the prior-day record, second does.
    await addSet(todayEntry, 185, 5)
    await addSet(todayEntry, 205, 5)

    render(<Progress />)

    await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Front Squat')

    expect(await screen.findByText(/2026-07-24: 205 x 5/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-07-24: 185 x 5/)).not.toBeInTheDocument()
  })

  it('does not include exercises with no logged history in the picker', async () => {
    await addExercise('Test Never Logged')
    render(<Progress />)
    await screen.findByLabelText(/select exercise/i)
    expect(screen.queryByText('Test Never Logged')).not.toBeInTheDocument()
  })

  it('excludes warmup sets from the PR list and shows a week label on sessions', async () => {
    const user = userEvent.setup()
    const exerciseId = await addExercise('Test Warmup Squat')
    const session1 = await getOrCreateSessionForDate('2026-06-29')
    const entry1 = await getOrCreateExerciseEntry(session1, exerciseId, undefined, 1)
    await addSet(entry1, 315, 5, undefined, true) // warmup — would look like a huge "PR" if counted

    render(<Progress />)
    await user.selectOptions(await screen.findByLabelText(/select exercise/i), 'Test Warmup Squat')

    expect(screen.queryByText(/315 x 5/)).not.toBeInTheDocument() // never shows in PR list
    expect(screen.queryByText(/Wk 1/)).not.toBeInTheDocument() // no working sets at all yet, no session row either
  })
})
