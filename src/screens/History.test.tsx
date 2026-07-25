import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { History } from './History'
import { getOrCreateSessionForDate } from '../db/workouts'
import { getOrCreateCatchingSessionForDate } from '../db/catching'
import { addBodyweightEntry } from '../db/bodyweight'

describe('History', () => {
  it('lists all session types combined, newest first', async () => {
    await getOrCreateSessionForDate('2026-07-10')
    await getOrCreateCatchingSessionForDate('2026-07-15')
    await addBodyweightEntry('2026-07-20', 190)

    render(<History />)

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('2026-07-20')
    expect(items[1]).toHaveTextContent('2026-07-15')
    expect(items[2]).toHaveTextContent('2026-07-10')
  })
})
