import { db } from './schema'
import type { BodyweightEntry } from './schema'

export async function addBodyweightEntry(date: string, weightLbs: number): Promise<number> {
  const existing = await db.bodyweightEntries.where('date').equals(date).first()
  if (existing) {
    await db.bodyweightEntries.update(existing.id!, { weightLbs })
    return existing.id!
  }
  return db.bodyweightEntries.add({ date, weightLbs })
}

export async function listBodyweightEntries(): Promise<BodyweightEntry[]> {
  return db.bodyweightEntries.orderBy('date').toArray()
}
