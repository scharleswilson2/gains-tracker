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

    expect(await screen.findByText(/190/)).toBeInTheDocument()
  })
})
