export type ProgressBadge = 'beat' | 'matched' | 'fell-short'

export interface WeightResult {
  weightLbs: number
  reps: number
}

export function compareWeightSets(
  thisWeek: WeightResult,
  lastWeek: WeightResult | null,
  targetReps: number | null
): ProgressBadge | null {
  if (!lastWeek) return null

  if (thisWeek.weightLbs === lastWeek.weightLbs && thisWeek.reps === lastWeek.reps) {
    return 'matched'
  }

  const heavierAndHitTarget =
    thisWeek.weightLbs > lastWeek.weightLbs &&
    targetReps !== null &&
    thisWeek.reps >= targetReps
  const sameWeightMoreReps =
    thisWeek.weightLbs === lastWeek.weightLbs && thisWeek.reps > lastWeek.reps

  if (heavierAndHitTarget || sameWeightMoreReps) return 'beat'
  return 'fell-short'
}

export function compareSimpleValues(
  thisWeek: number,
  lastWeek: number | null | undefined
): ProgressBadge | null {
  if (lastWeek === null || lastWeek === undefined) return null
  if (thisWeek === lastWeek) return 'matched'
  return thisWeek > lastWeek ? 'beat' : 'fell-short'
}
