import {
  addSet,
  flattenHistorySets,
  getOrCreateExerciseEntry,
  getOrCreateSessionForDate,
  getWorkingSetHistory,
} from '../db/workouts'
import { detectPr } from './prDetection'
import type { PrResult } from './prDetection'

export interface LogWeightSetInput {
  exerciseId: number
  date: string
  weightLbs: number
  reps: number
  rpe?: number
  isWarmup?: boolean
  programExerciseId?: number
  weekNumber?: number
}

export async function logWeightSet(input: LogWeightSetInput): Promise<PrResult> {
  const sessionId = await getOrCreateSessionForDate(input.date)
  const entryId = await getOrCreateExerciseEntry(
    sessionId,
    input.exerciseId,
    input.programExerciseId,
    input.weekNumber
  )

  if (input.isWarmup) {
    await addSet(entryId, input.weightLbs, input.reps, input.rpe, true)
    return { isWeightPr: false, isEstimated1RmPr: false }
  }

  const priorHistory = await getWorkingSetHistory(input.exerciseId)
  const priorSets = flattenHistorySets(priorHistory)
  const pr = detectPr({ weightLbs: input.weightLbs, reps: input.reps }, priorSets)
  await addSet(entryId, input.weightLbs, input.reps, input.rpe, false)
  return pr
}
