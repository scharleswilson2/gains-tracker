import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavBar } from './NavBar'

describe('NavBar', () => {
  it('renders links to all four primary screens', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /log lift/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /log catching/i })).toHaveAttribute('href', '/catching')
    expect(screen.getByRole('link', { name: /progress/i })).toHaveAttribute('href', '/progress')
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '/history')
  })
})
