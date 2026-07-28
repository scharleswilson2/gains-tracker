import Dexie, { type Table } from 'dexie'

export interface Exercise {
  id?: number
  name: string
  category?: string
  description?: string
}

export interface WorkoutSession {
  id?: number
  date: string
  notes?: string
}

export interface ExerciseEntry {
  id?: number
  sessionId: number
  exerciseId: number
  programExerciseId?: number
  weekNumber?: number
}

export interface SetRecord {
  id?: number
  exerciseEntryId: number
  weightLbs: number
  reps: number
  isWarmup?: boolean
}

export interface CatchingSession {
  id?: number
  date: string
  notes?: string
}

export interface PopTimeRep {
  id?: number
  catchingSessionId: number
  seconds: number
}

export interface BlockingDrill {
  id?: number
  catchingSessionId: number
  repCount: number
  successCount: number
}

export interface FramingDrill {
  id?: number
  catchingSessionId: number
  repCount: number
  successCount: number
}

export interface BodyweightEntry {
  id?: number
  date: string
  weightLbs: number
}

export type MeasureType = 'weight' | 'bodyweight_reps' | 'time' | 'distance' | 'category_choice'
export type Rir = 'L' | 'M' | 'H'

export interface CategoryOption {
  categoryLabel: string
  exercises: string[]
}

export interface Program {
  id?: number
  name: string
  startDate: string
  endDate: string
}

export interface ProgramWeek {
  id?: number
  programId: number
  weekNumber: number
  startDate: string
  endDate: string
}

export interface ProgramDay {
  id?: number
  programId: number
  dayNumber: number
  note?: string
}

export interface ProgramExercise {
  id?: number
  dayId: number
  exerciseId: number
  blockLabel: string | null
  orderIndex: number
  measureType: MeasureType
  eachSide: boolean
  tempo: string | null
  categoryOptions?: CategoryOption[]
  categoriesToPick?: number
}

export interface ProgramPrescription {
  id?: number
  programExerciseId: number
  weekNumber: number
  rir: Rir | null
  warmupTargets: number[]
  workingTargets: number[]
  isTest: boolean
}

export interface ProgramLogEntry {
  id?: number
  programExerciseId: number
  date: string
  weekNumber: number
  values: number[]
  isWarmup: boolean[]
  chosenCategory?: string
  chosenExercise?: string
}

export class GainsTrackerDB extends Dexie {
  exercises!: Table<Exercise, number>
  workoutSessions!: Table<WorkoutSession, number>
  exerciseEntries!: Table<ExerciseEntry, number>
  sets!: Table<SetRecord, number>
  catchingSessions!: Table<CatchingSession, number>
  popTimeReps!: Table<PopTimeRep, number>
  blockingDrills!: Table<BlockingDrill, number>
  framingDrills!: Table<FramingDrill, number>
  bodyweightEntries!: Table<BodyweightEntry, number>
  programs!: Table<Program, number>
  programWeeks!: Table<ProgramWeek, number>
  programDays!: Table<ProgramDay, number>
  programExercises!: Table<ProgramExercise, number>
  programPrescriptions!: Table<ProgramPrescription, number>
  programLogEntries!: Table<ProgramLogEntry, number>

  constructor() {
    super('gains-tracker')
    this.version(1).stores({
      exercises: '++id, name',
      workoutSessions: '++id, date',
      exerciseEntries: '++id, sessionId, exerciseId',
      sets: '++id, exerciseEntryId',
      catchingSessions: '++id, date',
      popTimeReps: '++id, catchingSessionId',
      blockingDrills: '++id, catchingSessionId',
      framingDrills: '++id, catchingSessionId',
      bodyweightEntries: '++id, date',
    })
    this.version(2).stores({
      programs: '++id, name',
      programWeeks: '++id, programId, weekNumber',
      programDays: '++id, programId, dayNumber',
      programExercises: '++id, dayId',
      programPrescriptions: '++id, programExerciseId, weekNumber',
      programLogEntries: '++id, programExerciseId, date',
    })
  }
}

export const db = new GainsTrackerDB()
