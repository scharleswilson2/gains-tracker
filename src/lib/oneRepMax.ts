export function estimateOneRepMax(weightLbs: number, reps: number): number {
  if (reps <= 1) return weightLbs
  return weightLbs * (1 + reps / 30)
}
