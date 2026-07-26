import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlotHeader } from './SlotHeader'
import type { ResolvedSlot } from '../db/programExercises'

function makeSlot(
  overrides: Partial<ResolvedSlot['programExercise']> = {},
  prescription: ResolvedSlot['prescription'] = null
): ResolvedSlot {
  return {
    programExercise: {
      id: 1,
      dayId: 1,
      exerciseId: 1,
      blockLabel: 'B',
      orderIndex: 0,
      measureType: 'weight',
      eachSide: false,
      tempo: null,
      ...overrides,
    },
    exerciseName: 'Test Exercise',
    prescription,
  }
}

describe('SlotHeader', () => {
  it('renders the exercise name, tempo, RIR and target summary', () => {
    const slot = makeSlot(
      { tempo: '4/1/0' },
      {
        id: 1,
        programExerciseId: 1,
        weekNumber: 1,
        rir: 'M',
        warmupTargets: [5, 4],
        workingTargets: [3, 3, 3, 5],
        isTest: false,
      }
    )

    render(<SlotHeader slot={slot} />)

    expect(screen.getByRole('button', { name: 'Test Exercise' })).toBeInTheDocument()
    expect(screen.getByText(/Tempo: 4\/1\/0/)).toBeInTheDocument()
    expect(screen.getByText(/RIR: M/)).toBeInTheDocument()
    expect(screen.getByText(/Warmup: 5, 4 \| Working: 3, 3, 3, 5/)).toBeInTheDocument()
  })

  it('renders TEST instead of numeric targets for a test prescription', () => {
    const slot = makeSlot(
      {},
      {
        id: 2,
        programExerciseId: 1,
        weekNumber: 4,
        rir: null,
        warmupTargets: [],
        workingTargets: [3, 3],
        isTest: true,
      }
    )

    render(<SlotHeader slot={slot} />)

    expect(screen.getByText('TEST')).toBeInTheDocument()
    expect(screen.queryByText(/Working:/)).not.toBeInTheDocument()
  })

  it('shows an each-side indicator when the slot is prescribed per side', () => {
    const slot = makeSlot(
      { eachSide: true },
      {
        id: 3,
        programExerciseId: 1,
        weekNumber: 1,
        rir: null,
        warmupTargets: [],
        workingTargets: [20, 20],
        isTest: false,
      }
    )

    render(<SlotHeader slot={slot} />)

    expect(screen.getByText(/each side/i)).toBeInTheDocument()
  })

  it('omits the each-side indicator when the slot is not per side', () => {
    const slot = makeSlot(
      { eachSide: false },
      {
        id: 4,
        programExerciseId: 1,
        weekNumber: 1,
        rir: null,
        warmupTargets: [],
        workingTargets: [20, 20],
        isTest: false,
      }
    )

    render(<SlotHeader slot={slot} />)

    expect(screen.queryByText(/each side/i)).not.toBeInTheDocument()
  })
})
