import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addBodyweightEntry, listBodyweightEntries } from '../db/bodyweight'
import { todayIso } from '../lib/dates'
import './Bodyweight.css'

export function Bodyweight() {
  const [bodyweightInput, setBodyweightInput] = useState('')

  const bodyweightEntries = useLiveQuery(() => listBodyweightEntries(), []) ?? []

  async function logBodyweight() {
    if (!bodyweightInput || Number(bodyweightInput) <= 0) return
    await addBodyweightEntry(todayIso(), Number(bodyweightInput))
    setBodyweightInput('')
  }

  return (
    <div className="bodyweight-screen">
      <h1>Weight</h1>
      <div className="bodyweight-entry">
        <label htmlFor="bodyweight-input">Bodyweight (lbs)</label>
        <input
          id="bodyweight-input"
          className="field"
          type="number"
          min="0"
          value={bodyweightInput}
          onChange={(e) => setBodyweightInput(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={logBodyweight}>
          Log Bodyweight
        </button>
      </div>
      {bodyweightEntries.length === 0 ? (
        <p className="bodyweight-empty">No entries yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={bodyweightEntries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-text-muted)" />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} stroke="var(--color-text-muted)" />
              <Tooltip />
              <Line type="monotone" dataKey="weightLbs" stroke="var(--color-accent)" />
            </LineChart>
          </ResponsiveContainer>
          <ul className="bodyweight-list">
            {bodyweightEntries.map((b) => (
              <li key={b.id}>
                {b.date}: {b.weightLbs}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
