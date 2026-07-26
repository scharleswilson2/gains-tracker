import { describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Progress } from './Progress'
import { History } from './History'
import { ProgramSlotCard } from '../components/ProgramSlotCard'
import { addExercise } from '../db/exercises'
import { addProgramDay, addProgramWeek, createProgram } from '../db/programs'
import { addProgramExercise, addProgramPrescription, getDaySlots } from '../db/programExercises'
import { db } from '../db/schema'

vi.mock('../lib/dates', () => ({ todayIso: () => '2026-07-06' }))

const PROGRAM_DATE = '2026-07-06'
const WEEK_NUMBER = 2

async function seedProgramSlot() {
  const exerciseId = await addExercise('Test Integration Front Squat')
  const programId = await createProgram('Test Program', '2026-06-29', '2026-07-24')
  await addProgramWeek(programId, WEEK_NUMBER, '2026-07-06', '2026-07-10')
  const dayId = await addProgramDay(programId, 1)
  const slotId = await addProgramExercise({
    dayId,
    exerciseId,
    blockLabel: 'B',
    orderIndex: 0,
    measureType: 'weight',
    eachSide: false,
    tempo: '4/1/0',
  })
  await addProgramPrescription({
    programExerciseId: slotId,
    weekNumber: WEEK_NUMBER,
    rir: 'M',
    warmupTargets: [],
    workingTargets: [3, 3, 3, 5],
    isTest: false,
  })

  const slots = await getDaySlots(dayId, WEEK_NUMBER)
  return { exerciseId, slot: slots[0] }
}

// End-to-end across Tasks 1, 4, 5, 7 and 8: logging a weight set from a
// program-day card tags the exercise entry with its week number, which
// Progress renders as a "(Wk N)" session label, while the same log shows up
// as a lift session in the combined History feed. Each hop is unit-tested in
// isolation elsewhere; this test is the one that proves the chain is wired.
describe('program day -> week label -> history', () => {
  it('carries weekNumber from a program slot log through to Progress and History', async () => {
    const user = userEvent.setup()
    const { exerciseId, slot } = await seedProgramSlot()

    render(<ProgramSlotCard slot={slot} date={PROGRAM_DATE} weekNumber={WEEK_NUMBER} />)

    await user.type(screen.getByLabelText(/weight/i), '225')
    await user.type(screen.getByLabelText(/reps/i), '5')
    await user.click(screen.getByRole('button', { name: /add set/i }))
    expect(await screen.findByText(/pr!/i)).toBeInTheDocument()

    // The set landed on an entry tagged with both the program slot and week.
    const entries = await db.exerciseEntries.where('exerciseId').equals(exerciseId).toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].programExerciseId).toBe(slot.programExercise.id)
    expect(entries[0].weekNumber).toBe(WEEK_NUMBER)

    cleanup()

    render(<Progress />)
    await user.selectOptions(
      await screen.findByLabelText(/select exercise/i),
      'Test Integration Front Squat'
    )
    expect(
      await screen.findByText(new RegExp(`${PROGRAM_DATE} \\(Wk ${WEEK_NUMBER}\\)`))
    ).toBeInTheDocument()

    cleanup()

    render(<History />)
    expect(await screen.findByText(`${PROGRAM_DATE} — Lift session`)).toBeInTheDocument()
  })
})
