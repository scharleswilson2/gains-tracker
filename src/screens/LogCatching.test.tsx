import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogCatching } from './LogCatching'

describe('LogCatching', () => {
  it('adds pop time reps and shows live best/average', async () => {
    const user = userEvent.setup()
    render(<LogCatching />)

    // findBy* polls until the element appears, which only happens once the
    // session lookup (an async IndexedDB call) has resolved and the "ready"
    // state has rendered — this avoids a race where Add Rep is clicked before
    // the session id is available.
    const popTimeInput = await screen.findByLabelText(/pop time/i)
    await user.type(popTimeInput, '1.95')
    await user.click(screen.getByRole('button', { name: /add rep/i }))
    await user.type(popTimeInput, '1.89')
    await user.click(screen.getByRole('button', { name: /add rep/i }))

    expect(await screen.findByText(/best: 1\.89/i)).toBeInTheDocument()
    expect(await screen.findByText(/average: 1\.92/i)).toBeInTheDocument()
  })

  it('records a blocking drill with reps and successes', async () => {
    const user = userEvent.setup()
    render(<LogCatching />)

    await user.type(await screen.findByLabelText(/blocking reps/i), '20')
    await user.type(screen.getByLabelText(/blocking successes/i), '16')
    await user.click(screen.getByRole('button', { name: /save blocking/i }))

    expect(await screen.findByText(/20 reps, 16 successful/i)).toBeInTheDocument()
  })
})
