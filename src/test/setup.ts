import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { db } from '../db/schema'

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
