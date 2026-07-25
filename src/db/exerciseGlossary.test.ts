import { describe, it, expect } from 'vitest'
import { listExercises } from './exercises'
import { EXERCISE_DESCRIPTIONS, seedExerciseGlossary } from './exerciseGlossary'

describe('exerciseGlossary', () => {
  it('seeds every exercise with its description', async () => {
    await seedExerciseGlossary()
    const all = await listExercises()
    expect(all.length).toBe(Object.keys(EXERCISE_DESCRIPTIONS).length)
    const frontSquat = all.find((e) => e.name === 'Front Squat')
    expect(frontSquat?.description).toContain('front rack')
  })

  it('is idempotent - running twice does not duplicate exercises', async () => {
    await seedExerciseGlossary()
    await seedExerciseGlossary()
    const all = await listExercises()
    expect(all.length).toBe(Object.keys(EXERCISE_DESCRIPTIONS).length)
  })
})
