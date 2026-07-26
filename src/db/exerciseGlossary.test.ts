import { describe, it, expect } from 'vitest'
import { addExercise, findExerciseByName, listExercises } from './exercises'
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

  it('backfills a description onto a pre-existing exercise with no description', async () => {
    // Simulates a user who already logged "Front Squat" free-form before
    // this exercise glossary existed - the row exists with no description.
    await addExercise('Front Squat')
    const before = await findExerciseByName('Front Squat')
    expect(before?.description).toBeFalsy()

    await seedExerciseGlossary()

    const after = await findExerciseByName('Front Squat')
    expect(after?.id).toBe(before?.id)
    expect(after?.description).toContain('front rack')
  })

  it('does not overwrite an existing description on a pre-existing exercise', async () => {
    // Simulates a user-provided description (e.g. from a future edit
    // feature) that a glossary reseed must not silently clobber.
    await addExercise('Front Squat', undefined, 'My own custom notes')

    await seedExerciseGlossary()

    const after = await findExerciseByName('Front Squat')
    expect(after?.description).toBe('My own custom notes')
  })
})
