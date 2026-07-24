import { describe, it, expect } from 'vitest'
import { estimateOneRepMax } from './oneRepMax'

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a 1-rep set', () => {
    expect(estimateOneRepMax(225, 1)).toBe(225)
  })

  it('applies the Epley formula for multi-rep sets', () => {
    // 225 * (1 + 5/30) = 262.5
    expect(estimateOneRepMax(225, 5)).toBeCloseTo(262.5)
  })
})
