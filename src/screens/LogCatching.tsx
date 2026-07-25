import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addPopTimeRep,
  getOrCreateCatchingSessionForDate,
  getPopTimeReps,
  popTimeStats,
  recordBlockingDrill,
  recordFramingDrill,
} from '../db/catching'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LogCatching() {
  const today = todayIso()
  const [popTimeInput, setPopTimeInput] = useState('')
  const [blockingReps, setBlockingReps] = useState('')
  const [blockingSuccesses, setBlockingSuccesses] = useState('')
  const [framingReps, setFramingReps] = useState('')
  const [framingSuccesses, setFramingSuccesses] = useState('')
  const [savedBlocking, setSavedBlocking] = useState<{ reps: number; successes: number }[]>([])
  const [savedFraming, setSavedFraming] = useState<{ reps: number; successes: number }[]>([])

  // Deliberately NOT a useLiveQuery: getOrCreateCatchingSessionForDate performs
  // a write (db.catchingSessions.add) when no session exists yet for today, and
  // Dexie's useLiveQuery runs its querier inside a read-only transaction — a
  // write there throws "ReadOnlyError: Readwrite transaction in liveQuery
  // context". A plain useState + useEffect one-time fetch-or-create avoids that
  // while preserving the same shape other consumers rely on: sessionId starts
  // `undefined` and only flips to a real id once the async lookup/creation
  // resolves, so the loading gate below still protects "Add Rep" from being
  // clickable before a session exists.
  const [sessionId, setSessionId] = useState<number | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getOrCreateCatchingSessionForDate(today).then((id) => {
      if (!cancelled) setSessionId(id)
    })
    return () => {
      cancelled = true
    }
  }, [today])
  const reps = useLiveQuery(
    () => (sessionId ? getPopTimeReps(sessionId) : Promise.resolve([])),
    [sessionId]
  ) ?? []
  const stats = popTimeStats(reps)

  if (sessionId === undefined) {
    return (
      <div>
        <h1>Log Catching</h1>
        <p>Loading...</p>
      </div>
    )
  }

  async function addRep() {
    if (!sessionId || !popTimeInput) return
    await addPopTimeRep(sessionId, Number(popTimeInput))
    setPopTimeInput('')
  }

  async function saveBlocking() {
    if (!sessionId) return
    const repCount = Number(blockingReps)
    const successCount = Number(blockingSuccesses)
    await recordBlockingDrill(sessionId, repCount, successCount)
    setSavedBlocking((prev) => [...prev, { reps: repCount, successes: successCount }])
    setBlockingReps('')
    setBlockingSuccesses('')
  }

  async function saveFraming() {
    if (!sessionId) return
    const repCount = Number(framingReps)
    const successCount = Number(framingSuccesses)
    await recordFramingDrill(sessionId, repCount, successCount)
    setSavedFraming((prev) => [...prev, { reps: repCount, successes: successCount }])
    setFramingReps('')
    setFramingSuccesses('')
  }

  return (
    <div>
      <h1>Log Catching</h1>

      <section>
        <h2>Pop Time</h2>
        <label htmlFor="pop-time-input">Pop time (seconds)</label>
        <input
          id="pop-time-input"
          type="number"
          step="0.01"
          value={popTimeInput}
          onChange={(e) => setPopTimeInput(e.target.value)}
        />
        <button type="button" onClick={addRep}>
          Add Rep
        </button>
        {stats.best !== null && (
          <p>
            Best: {stats.best.toFixed(2)} | Average: {stats.average!.toFixed(2)}
          </p>
        )}
        <ul>
          {reps.map((r) => (
            <li key={r.id}>{r.seconds.toFixed(2)}s</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Blocking</h2>
        <label htmlFor="blocking-reps">Blocking reps</label>
        <input id="blocking-reps" type="number" value={blockingReps} onChange={(e) => setBlockingReps(e.target.value)} />
        <label htmlFor="blocking-successes">Blocking successes</label>
        <input
          id="blocking-successes"
          type="number"
          value={blockingSuccesses}
          onChange={(e) => setBlockingSuccesses(e.target.value)}
        />
        <button type="button" onClick={saveBlocking}>
          Save Blocking
        </button>
        <ul>
          {savedBlocking.map((b, i) => (
            <li key={i}>
              {b.reps} reps, {b.successes} successful
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Framing</h2>
        <label htmlFor="framing-reps">Framing reps</label>
        <input id="framing-reps" type="number" value={framingReps} onChange={(e) => setFramingReps(e.target.value)} />
        <label htmlFor="framing-successes">Framing successes</label>
        <input
          id="framing-successes"
          type="number"
          value={framingSuccesses}
          onChange={(e) => setFramingSuccesses(e.target.value)}
        />
        <button type="button" onClick={saveFraming}>
          Save Framing
        </button>
        <ul>
          {savedFraming.map((f, i) => (
            <li key={i}>
              {f.reps} reps, {f.successes} successful
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
