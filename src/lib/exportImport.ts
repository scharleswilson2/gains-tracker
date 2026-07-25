import { db } from '../db/schema'

const CURRENT_EXPORT_VERSION = 1

export interface ExportEnvelope {
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export async function exportAllData(): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) {
    tables[table.name] = await table.toArray()
  }
  const envelope: ExportEnvelope = {
    version: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  }
  return JSON.stringify(envelope, null, 2)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates that `parsed` is a well-formed export envelope BEFORE any table
 * is touched, so a malformed/unrelated JSON file can never wipe existing
 * data. Throws a descriptive Error on any shape mismatch.
 */
function validateEnvelope(parsed: unknown): ExportEnvelope {
  if (!isPlainObject(parsed)) {
    throw new Error('Invalid backup file: expected a JSON object at the top level.')
  }
  if (parsed.version !== CURRENT_EXPORT_VERSION) {
    throw new Error(
      `Invalid backup file: unsupported export version "${String(parsed.version)}" (expected ${CURRENT_EXPORT_VERSION}).`
    )
  }
  if (typeof parsed.exportedAt !== 'string') {
    throw new Error('Invalid backup file: missing or invalid "exportedAt" field.')
  }
  if (!isPlainObject(parsed.tables)) {
    throw new Error('Invalid backup file: missing or invalid "tables" field.')
  }
  for (const [tableName, rows] of Object.entries(parsed.tables)) {
    if (!Array.isArray(rows)) {
      throw new Error(`Invalid backup file: table "${tableName}" is not an array of rows.`)
    }
  }
  return {
    version: parsed.version,
    exportedAt: parsed.exportedAt,
    tables: parsed.tables as Record<string, unknown[]>,
  }
}

export async function importAllData(json: string): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid backup file: not valid JSON.')
  }

  // Validate the full envelope shape before the transaction below touches
  // any table — a bad/unrelated file must never clear existing data.
  const envelope = validateEnvelope(parsed)

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const rows = envelope.tables[table.name]
      if (rows && rows.length > 0) {
        await table.bulkAdd(rows)
      }
    }
  })
}
