import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../db/schema'
import { listExercisesWithHistory } from '../db/exercises'
import { flattenHistorySets, getWorkingSetHistory } from '../db/workouts'
import { estimateOneRepMax } from '../lib/oneRepMax'
import { detectPr } from '../lib/prDetection'
import { popTimeStats, successRate } from '../db/catching'

export function Progress() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)
  const [metric, setMetric] = useState<'weight' | 'estimated1rm'>('weight')

  const exercisesQuery = useLiveQuery(() => listExercisesWithHistory(), [])
  const exercises = exercisesQuery ?? []

  const history = useLiveQuery(
    () => (selectedExerciseId ? getWorkingSetHistory(selectedExerciseId) : Promise.resolve([])),
    [selectedExerciseId]
  ) ?? []

  const chartData = history.map((h) => {
    const topSet = h.sets.reduce(
      (best, s) => (s.weightLbs > (best?.weightLbs ?? 0) ? s : best),
      h.sets[0]
    )
    const volume = h.sets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0)
    return {
      date: h.date,
      weight: topSet?.weightLbs ?? 0,
      estimated1rm: topSet ? Math.round(estimateOneRepMax(topSet.weightLbs, topSet.reps)) : 0,
      volume,
    }
  })

  const prSets: { date: string; weightLbs: number; reps: number }[] = []
  history.forEach((h, i) => {
    const priorSets = flattenHistorySets(history.slice(0, i))
    h.sets.forEach((s) => {
      const pr = detectPr(s, priorSets)
      if (pr.isWeightPr || pr.isEstimated1RmPr) {
        prSets.push({ date: h.date, weightLbs: s.weightLbs, reps: s.reps })
      }
      priorSets.push(s)
    })
  })

  const catchingSessions = useLiveQuery(() => db.catchingSessions.orderBy('date').toArray(), []) ?? []
  const popTimeChartData = useLiveQuery(async () => {
    const rows = []
    for (const session of catchingSessions) {
      const reps = await db.popTimeReps.where('catchingSessionId').equals(session.id!).toArray()
      const stats = popTimeStats(reps)
      if (stats.best !== null) {
        rows.push({ date: session.date, best: stats.best, average: stats.average })
      }
    }
    return rows
  }, [catchingSessions]) ?? []

  const drillChartData = useLiveQuery(async () => {
    const rows = []
    for (const session of catchingSessions) {
      const blocking = await db.blockingDrills.where('catchingSessionId').equals(session.id!).toArray()
      const framing = await db.framingDrills.where('catchingSessionId').equals(session.id!).toArray()
      const blockingReps = blocking.reduce((s, d) => s + d.repCount, 0)
      const blockingSuccesses = blocking.reduce((s, d) => s + d.successCount, 0)
      const framingReps = framing.reduce((s, d) => s + d.repCount, 0)
      const framingSuccesses = framing.reduce((s, d) => s + d.successCount, 0)
      if (blockingReps === 0 && framingReps === 0) {
        continue
      }
      rows.push({
        date: session.date,
        blockingRate: successRate(blockingReps, blockingSuccesses),
        framingRate: successRate(framingReps, framingSuccesses),
      })
    }
    return rows
  }, [catchingSessions]) ?? []

  // All hooks above run unconditionally every render (Rules of Hooks). This
  // gate only affects which JSX is returned — it waits for the exercise list
  // specifically, since `userEvent.selectOptions` (used in tests, and
  // functionally identical to a real user picking an option) requires the
  // <option> to already exist; unlike `findByText`, it does not retry.
  if (exercisesQuery === undefined) {
    return (
      <div>
        <h1>Progress</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Progress</h1>

      <section>
        <h2>Lift Progress</h2>
        <label htmlFor="exercise-select">Select exercise</label>
        <select
          id="exercise-select"
          onChange={(e) => setSelectedExerciseId(Number(e.target.value) || null)}
          defaultValue=""
        >
          <option value="" disabled>
            Choose...
          </option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {selectedExerciseId && (
          <>
            <div>
              <button type="button" onClick={() => setMetric('weight')}>
                Top Weight
              </button>
              <button type="button" onClick={() => setMetric('estimated1rm')}>
                Est. 1RM
              </button>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey={metric} stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>

            <h3>Volume</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="volume" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>

            <h3>PRs</h3>
            <ul>
              {prSets.map((pr, i) => (
                <li key={i}>
                  {pr.date}: {pr.weightLbs} x {pr.reps}
                </li>
              ))}
            </ul>

            <h3>Sessions</h3>
            <ul>
              {history.map((h) => {
                const topSet = h.sets.reduce(
                  (best, s) => (s.weightLbs > (best?.weightLbs ?? 0) ? s : best),
                  h.sets[0]
                )
                return (
                  <li key={h.date}>
                    {h.date}
                    {h.weekNumber ? ` (Wk ${h.weekNumber})` : ''} — top set: {topSet?.weightLbs} lbs x{' '}
                    {topSet?.reps} reps
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Pop Time</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={popTimeChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="best" stroke="#dc2626" />
            <Line type="monotone" dataKey="average" stroke="#f97316" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2>Blocking / Framing Success Rate</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={drillChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="blockingRate" fill="#2563eb" />
            <Bar dataKey="framingRate" fill="#9333ea" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
