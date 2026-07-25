import { db } from '../db/schema'

export async function exportAllData(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const table of db.tables) {
    data[table.name] = await table.toArray()
  }
  return JSON.stringify(data, null, 2)
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json) as Record<string, unknown[]>
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const rows = data[table.name]
      if (rows && rows.length > 0) {
        await table.bulkAdd(rows as never[])
      }
    }
  })
}
