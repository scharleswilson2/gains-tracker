import Dexie, { type Table } from 'dexie'

export interface Exercise {
  id?: number
  name: string
  category?: string
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
}

export interface SetRecord {
  id?: number
  exerciseEntryId: number
  weightLbs: number
  reps: number
  rpe?: number
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
  }
}

export const db = new GainsTrackerDB()
