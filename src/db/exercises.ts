import { db } from './schema'
import type { Exercise } from './schema'

export async function listExercises(): Promise<Exercise[]> {
  return db.exercises.orderBy('name').toArray()
}

export async function findExerciseByName(name: string): Promise<Exercise | undefined> {
  return db.exercises.where('name').equalsIgnoreCase(name).first()
}

export async function addExercise(
  name: string,
  category?: string,
  description?: string
): Promise<number> {
  const existing = await findExerciseByName(name)
  if (existing) return existing.id!
  return db.exercises.add({ name, category, description })
}

export async function listExercisesWithHistory(): Promise<Exercise[]> {
  const entries = await db.exerciseEntries.toArray()
  const exerciseIds = new Set(entries.map((e) => e.exerciseId))
  const all = await listExercises()
  return all.filter((ex) => exerciseIds.has(ex.id!))
}
