import type { SetRecord } from '../db/schema'
import { estimateOneRepMax } from './oneRepMax'

type SetLike = Pick<SetRecord, 'weightLbs' | 'reps'>

export interface PrResult {
  isWeightPr: boolean
  isEstimated1RmPr: boolean
}

export function detectPr(newSet: SetLike, priorSets: SetLike[]): PrResult {
  const priorAtSameReps = priorSets.filter((s) => s.reps === newSet.reps)
  const bestWeightAtReps = priorAtSameReps.reduce((max, s) => Math.max(max, s.weightLbs), 0)
  const isWeightPr = newSet.weightLbs > bestWeightAtReps

  const newEstimate = estimateOneRepMax(newSet.weightLbs, newSet.reps)
  const bestPriorEstimate = priorSets.reduce(
    (max, s) => Math.max(max, estimateOneRepMax(s.weightLbs, s.reps)),
    0
  )
  const isEstimated1RmPr = newEstimate > bestPriorEstimate

  return { isWeightPr, isEstimated1RmPr }
}
