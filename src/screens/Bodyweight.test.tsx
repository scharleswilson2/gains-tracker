import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bodyweight } from './Bodyweight'

describe('Bodyweight', () => {
  it('logs an entry and shows it in the list', async () => {
    const user = userEvent.setup()

    render(<Bodyweight />)

    await user.type(screen.getByLabelText(/bodyweight/i), '190')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    expect(await screen.findByText(/: 190$/)).toBeInTheDocument()
  })

  it('shows an empty state before any entries are logged', () => {
    render(<Bodyweight />)

    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })

  it('hides the empty state once an entry is logged', async () => {
    const user = userEvent.setup()

    render(<Bodyweight />)

    await user.type(screen.getByLabelText(/bodyweight/i), '190')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    await screen.findByText(/: 190$/)
    expect(screen.queryByText(/no entries yet/i)).not.toBeInTheDocument()
  })

  it('does not log a non-positive bodyweight', async () => {
    const user = userEvent.setup()

    render(<Bodyweight />)

    await user.type(screen.getByLabelText(/bodyweight/i), '0')
    await user.click(screen.getByRole('button', { name: /log bodyweight/i }))

    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument()
  })
})
