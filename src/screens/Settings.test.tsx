import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from './Settings'
import { db } from '../db/schema'

describe('Settings', () => {
  it('exports current data as downloadable JSON when Export is clicked', async () => {
    const user = userEvent.setup()
    await db.exercises.add({ name: 'Back Squat' })

    const createObjectURL = vi.fn(() => 'blob:mock-url')
    // jsdom doesn't implement these, and leaving them unmocked makes the
    // component's later revokeObjectURL call throw "Not implemented"
    // inside the async click handler.
    // @ts-expect-error - jsdom doesn't implement this
    global.URL.createObjectURL = createObjectURL
    // @ts-expect-error - jsdom doesn't implement this
    global.URL.revokeObjectURL = vi.fn()

    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /export/i }))

    // The click handler awaits an IndexedDB read (via Dexie/fake-indexeddb)
    // before calling createObjectURL. That read resolves on a real macrotask,
    // which user.click() does not wait for, so poll instead of asserting
    // immediately to avoid a race under full-suite load.
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })
})
