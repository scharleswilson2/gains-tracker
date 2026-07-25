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

  it('does not import when the user cancels the replace-all-data confirmation', async () => {
    const user = userEvent.setup()
    await db.exercises.add({ name: 'Back Squat' })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<Settings />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([JSON.stringify({ version: 1, exportedAt: 'x', tables: {} })], 'backup.json', {
      type: 'application/json',
    })
    await user.upload(fileInput, file)

    expect(confirmSpy).toHaveBeenCalled()
    // Existing data must survive a cancelled import.
    const exercises = await db.exercises.toArray()
    expect(exercises.map((e) => e.name)).toEqual(['Back Squat'])

    confirmSpy.mockRestore()
  })

  it('shows an inline error and preserves data when the imported file is invalid', async () => {
    const user = userEvent.setup()
    await db.exercises.add({ name: 'Deadlift' })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<Settings />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['not valid json'], 'backup.json', { type: 'application/json' })
    await user.upload(fileInput, file)

    expect(await screen.findByText(/import failed/i)).toBeInTheDocument()

    const exercises = await db.exercises.toArray()
    expect(exercises.map((e) => e.name)).toEqual(['Deadlift'])

    vi.restoreAllMocks()
  })
})
