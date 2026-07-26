import { describe, it, expect } from 'vitest'
import { compareSimpleValues, compareWeightSets } from './compareProgress'

describe('compareWeightSets', () => {
  it('returns null when there is no prior week to compare against', () => {
    expect(compareWeightSets({ weightLbs: 205, reps: 5 }, null, 5)).toBeNull()
  })

  it('returns matched when weight and reps are identical to last week', () => {
    const result = compareWeightSets({ weightLbs: 205, reps: 5 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('matched')
  })

  it('returns beat when heavier and the target reps are hit', () => {
    const result = compareWeightSets({ weightLbs: 215, reps: 5 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('beat')
  })

  it('returns beat when the same weight is lifted for more reps than last week', () => {
    const result = compareWeightSets({ weightLbs: 205, reps: 6 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('beat')
  })

  it('returns fell-short when heavier but the target reps are missed', () => {
    const result = compareWeightSets({ weightLbs: 215, reps: 3 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('fell-short')
  })

  it('returns fell-short when lighter than last week', () => {
    const result = compareWeightSets({ weightLbs: 195, reps: 5 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('fell-short')
  })

  it('returns fell-short when the same weight is lifted for fewer reps', () => {
    const result = compareWeightSets({ weightLbs: 205, reps: 3 }, { weightLbs: 205, reps: 5 }, 5)
    expect(result).toBe('fell-short')
  })
})

describe('compareSimpleValues', () => {
  it('returns null when there is no prior week to compare against', () => {
    expect(compareSimpleValues(12, null)).toBeNull()
    expect(compareSimpleValues(12, undefined)).toBeNull()
  })

  it('returns matched when equal', () => {
    expect(compareSimpleValues(12, 12)).toBe('matched')
  })

  it('returns beat when greater', () => {
    expect(compareSimpleValues(15, 12)).toBe('beat')
  })

  it('returns fell-short when less', () => {
    expect(compareSimpleValues(10, 12)).toBe('fell-short')
  })
})
