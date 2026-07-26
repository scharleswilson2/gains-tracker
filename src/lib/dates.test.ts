import { describe, it, expect } from 'vitest'
import { addDays, todayIso } from './dates'

describe('todayIso', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches the local date components at call time', () => {
    // Small tolerance for a test running right at a day boundary: compute
    // "now" both before and after calling todayIso, and accept either as a
    // match rather than trying to freeze the system clock.
    const before = new Date()
    const result = todayIso()
    const after = new Date()

    const expected = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    expect([expected(before), expected(after)]).toContain(result)
  })
})

describe('addDays', () => {
  it('adds days within the same month', () => {
    expect(addDays('2026-07-20', 4)).toBe('2026-07-24')
  })

  it('rolls over into the next month', () => {
    expect(addDays('2026-07-30', 4)).toBe('2026-08-03')
  })

  it('supports zero days', () => {
    expect(addDays('2026-07-20', 0)).toBe('2026-07-20')
  })
})
