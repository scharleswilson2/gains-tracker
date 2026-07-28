import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayNavigator } from './DayNavigator'
import type { DatedProgramDay } from '../db/programs'

function makeDay(overrides: Partial<DatedProgramDay> = {}): DatedProgramDay {
  return {
    program: { id: 1, name: 'July Program', startDate: '2026-06-29', endDate: '2026-07-24' },
    week: { id: 1, programId: 1, weekNumber: 1, startDate: '2026-06-29', endDate: '2026-07-03' },
    day: { id: 1, programId: 1, dayNumber: 1, note: 'Recovery' },
    date: '2026-06-29',
    ...overrides,
  }
}

describe('DayNavigator', () => {
  it('shows the current day, week, and program name', () => {
    const days = [makeDay()]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={() => {}} />)

    expect(screen.getByText(/Day 1/)).toBeInTheDocument()
    expect(screen.getByText(/2026-06-29/)).toBeInTheDocument()
    expect(screen.getByText(/Week 1/)).toBeInTheDocument()
    expect(screen.getByText('July Program')).toBeInTheDocument()
  })

  it('calls onNavigate with index - 1 when the previous arrow is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const days = [makeDay({ date: '2026-06-29' }), makeDay({ date: '2026-06-30' })]
    render(<DayNavigator days={days} currentIndex={1} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: /previous day/i }))
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('calls onNavigate with index + 1 when the next arrow is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const days = [makeDay({ date: '2026-06-29' }), makeDay({ date: '2026-06-30' })]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: /next day/i }))
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('disables the previous arrow at the start of the list', () => {
    const days = [makeDay()]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: /previous day/i })).toBeDisabled()
  })

  it('disables the next arrow at the end of the list', () => {
    const days = [makeDay()]
    render(<DayNavigator days={days} currentIndex={0} onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: /next day/i })).toBeDisabled()
  })

  it('renders nothing when there is no current day (empty list)', () => {
    const { container } = render(<DayNavigator days={[]} currentIndex={-1} onNavigate={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
