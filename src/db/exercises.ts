import { db } from './schema'
import type { Exercise } from './schema'

export async function listExercises(): Promise<Exercise[]> {
  return db.exercises.orderBy('name').toArray()
}

export async function findExerciseByName(name: string): Promise<Exercise | undefined> {
  return db.exercises.where('name').equalsIgnoreCase(name).first()
}

export async function addExercise(name: string, category?: string): Promise<number> {
  const existing = await findExerciseByName(name)
  if (existing) return existing.id!
  return db.exercises.add({ name, category })
}
