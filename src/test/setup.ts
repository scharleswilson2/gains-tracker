import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { configure } from '@testing-library/react'
import { db } from '../db/schema'

// The default 1000ms `waitFor`/`findBy*` timeout is occasionally too tight
// for a legitimately-passing assertion under heavy parallel test-worker CPU
// contention (many suites' fake-indexeddb/React effect chains competing for
// the event loop) — confirmed by the same tests passing 100% of the time
// with file parallelism disabled. A longer ceiling doesn't hide an
// actually-broken assertion; it just stops a busy machine from failing a
// correct one.
configure({ asyncUtilTimeout: 2500 })

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
