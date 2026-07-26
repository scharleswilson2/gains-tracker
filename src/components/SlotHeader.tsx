import type { ResolvedSlot } from '../db/programExercises'
import { ExerciseInfo } from './ExerciseInfo'

function targetSummary(slot: ResolvedSlot): string {
  const { prescription } = slot
  if (!prescription) return ''
  if (prescription.isTest) return 'TEST'
  const parts: string[] = []
  if (prescription.warmupTargets.length > 0)
    parts.push(`Warmup: ${prescription.warmupTargets.join(', ')}`)
  if (prescription.workingTargets.length > 0)
    parts.push(`Working: ${prescription.workingTargets.join(', ')}`)
  return parts.join(' | ')
}

/**
 * The prescription header shared by the Log Lift program-day cards
 * (`ProgramSlotCard`) and the Program tab's schedule view: exercise name (with
 * its glossary affordance), tempo, RIR, and the warmup/working target summary
 * — plus an "(each side)" marker for per-side prescriptions.
 */
export function SlotHeader({ slot }: { slot: ResolvedSlot }) {
  const { programExercise, prescription } = slot

  return (
    <div>
      <ExerciseInfo name={slot.exerciseName} />
      {programExercise.tempo && <span> Tempo: {programExercise.tempo}</span>}
      {prescription?.rir && <span> RIR: {prescription.rir}</span>}
      <p>
        {targetSummary(slot)}
        {programExercise.eachSide && <span> (each side)</span>}
      </p>
    </div>
  )
}
