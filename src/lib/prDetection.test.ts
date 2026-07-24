import { describe, it, expect } from 'vitest'
import { detectPr } from './prDetection'

describe('detectPr', () => {
  it('flags a weight PR when the new set beats the best weight at the same rep count', () => {
    const result = detectPr(
      { weightLbs: 235, reps: 5 },
      [{ weightLbs: 225, reps: 5 }, { weightLbs: 300, reps: 1 }]
    )
    expect(result.isWeightPr).toBe(true)
  })

  it('does not flag a weight PR when a heavier set exists at the same rep count', () => {
    const result = detectPr(
      { weightLbs: 220, reps: 5 },
      [{ weightLbs: 225, reps: 5 }]
    )
    expect(result.isWeightPr).toBe(false)
  })

  it('flags an estimated 1RM PR based on the Epley formula across all prior sets', () => {
    // new: 225 * (1 + 5/30) = 262.5 vs prior best 300*(1+1/30)=310 -> not a PR
    const notPr = detectPr(
      { weightLbs: 225, reps: 5 },
      [{ weightLbs: 300, reps: 1 }]
    )
    expect(notPr.isEstimated1RmPr).toBe(false)

    // new: 250 * (1 + 5/30) = 291.67 vs prior best 280*(1+1/30)=289.33 -> PR
    const isPr = detectPr(
      { weightLbs: 250, reps: 5 },
      [{ weightLbs: 280, reps: 1 }]
    )
    expect(isPr.isEstimated1RmPr).toBe(true)
  })

  it('treats an empty prior-sets list as any new set being a PR', () => {
    const result = detectPr({ weightLbs: 135, reps: 8 }, [])
    expect(result.isWeightPr).toBe(true)
    expect(result.isEstimated1RmPr).toBe(true)
  })
})
